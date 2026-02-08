import { Client } from "@notionhq/client";
import { config, GENERATION_VERSION } from "./config.js";
import type { NotionPageInput, GenerationOutput, Channel } from "./types.js";
import { CHANNELS, CHANNEL_TO_NOTION_PROPERTY } from "./types.js";

// ============================================================
// Client
// ============================================================

const notion = new Client({ auth: config.NOTION_API_KEY });

// ============================================================
// Rate limiter (token bucket, 2.5 req/s — under Notion's 3/s)
// ============================================================

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
      await sleep(waitMs);
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rateLimiter = new RateLimiter(2.5);

// ============================================================
// Retry wrapper with exponential backoff
// ============================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.acquire();
      return await fn();
    } catch (error: unknown) {
      const isLast = attempt === maxRetries;
      if (!isRetryableError(error) || isLast) throw error;

      const retryAfter = getRetryAfterMs(error);
      const backoff = retryAfter ?? baseDelayMs * Math.pow(2, attempt);
      console.warn(`Notion API error (attempt ${attempt + 1}/${maxRetries}), retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
  throw new Error("Unreachable");
}

function isRetryableError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status === 502 || status === 503;
  }
  return false;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "headers" in error) {
    const headers = (error as { headers: Record<string, string> }).headers;
    const retryAfter = headers?.["retry-after"];
    if (retryAfter) return parseFloat(retryAfter) * 1000;
  }
  return undefined;
}

// ============================================================
// Query: fetch pages with Status == "Ready for Comms"
// ============================================================

export async function fetchReadyPages(): Promise<NotionPageInput[]> {
  const pages: NotionPageInput[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await withRetry(() =>
      notion.databases.query({
        database_id: config.NOTION_DATABASE_ID,
        filter: {
          property: "Status",
          status: { equals: "Ready for Comms" },
        },
        page_size: 100,
        start_cursor: cursor,
      }),
    );

    for (const page of response.results) {
      if (!("properties" in page)) continue;
      const parsed = extractPageInput(page);
      if (parsed) pages.push(parsed);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages.slice(0, config.MAX_PAGES_PER_RUN);
}

// ============================================================
// Extract structured input from a Notion page
// ============================================================

function extractPageInput(page: any): NotionPageInput | null {
  const props = page.properties;
  try {
    const title = getTitle(props["Title"] ?? props["Name"]);
    const coreBrief = getRichText(props["Core Brief"]);

    if (!title) {
      console.warn(`Skipping page ${page.id}: missing Title`);
      return null;
    }
    if (!coreBrief) {
      console.warn(`Skipping page ${page.id} ("${title}"): missing Core Brief`);
      return null;
    }

    return {
      pageId: page.id,
      title,
      status: getStatus(props["Status"]),
      type: getSelect(props["Type"]),
      pillar: getSelect(props["Pillar"]),
      primaryAudience: getMultiSelect(props["Primary Audience"]),
      coreBrief,

      eventDate: getDate(props["Event Date"]),
      eventTime: getRichText(props["Event Time"]) || undefined,
      location: getRichText(props["Location"]) || undefined,
      deadline: getDate(props["Deadline"]),
      signupLink: getUrl(props["Signup Link"]),
      partnersSpeakers: getRichText(props["Partners or Speakers"] ?? props["Partners/Speakers"]) || undefined,
      selectivityLevel: getSelect(props["Selectivity Level"]) || undefined,
      incentives: getRichText(props["Incentives"]) || undefined,

      lastGeneratedAt: getDate(props["Last Generated At"]),
      generationVersion: getRichText(props["Generation Version"]) || undefined,
    };
  } catch (err) {
    console.error(`Failed to parse page ${page.id}:`, err);
    return null;
  }
}

// ============================================================
// Property extraction helpers
// ============================================================

function getTitle(prop: any): string {
  return prop?.title?.map((t: any) => t.plain_text).join("") ?? "";
}

function getRichText(prop: any): string {
  return prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
}

function getSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

function getMultiSelect(prop: any): string[] {
  return prop?.multi_select?.map((s: any) => s.name) ?? [];
}

function getStatus(prop: any): string {
  return prop?.status?.name ?? "";
}

function getDate(prop: any): string | undefined {
  return prop?.date?.start ?? undefined;
}

function getUrl(prop: any): string | undefined {
  return prop?.url ?? undefined;
}

// ============================================================
// Fetch brand voice text from a dedicated Notion page
// ============================================================

let brandVoiceCache: { text: string; fetchedAt: number } | null = null;
const BRAND_VOICE_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchBrandVoice(): Promise<string> {
  if (brandVoiceCache && Date.now() - brandVoiceCache.fetchedAt < BRAND_VOICE_CACHE_TTL_MS) {
    return brandVoiceCache.text;
  }

  const blocks: string[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await withRetry(() =>
      notion.blocks.children.list({
        block_id: config.NOTION_BRAND_VOICE_PAGE_ID,
        page_size: 100,
        start_cursor: cursor,
      }),
    );

    for (const block of response.results) {
      if ("type" in block) {
        const text = extractBlockText(block);
        if (text) blocks.push(text);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const text = blocks.join("\n");
  brandVoiceCache = { text, fetchedAt: Date.now() };

  if (!text.trim()) {
    console.warn("Brand voice page is empty. Drafts will be generated without brand voice rules.");
  }

  return text;
}

function extractBlockText(block: any): string {
  const type = block.type;
  const content = block[type];
  if (!content?.rich_text) return "";

  const prefix =
    type === "heading_1" ? "# " :
    type === "heading_2" ? "## " :
    type === "heading_3" ? "### " :
    type === "bulleted_list_item" ? "- " :
    type === "numbered_list_item" ? "- " :
    "";

  return prefix + content.rich_text.map((t: any) => t.plain_text).join("");
}

// ============================================================
// Write generated drafts back to page properties
// ============================================================

export async function writeGeneratedDrafts(
  pageId: string,
  drafts: GenerationOutput,
): Promise<void> {
  const properties: Record<string, any> = {};

  // Write all 8 channel outputs
  for (const channel of CHANNELS) {
    const notionPropName = CHANNEL_TO_NOTION_PROPERTY[channel];
    const text = drafts[channel];
    properties[notionPropName] = {
      rich_text: splitIntoRichTextChunks(text),
    };
  }

  // Set metadata — all in the same update call for atomicity
  properties["Status"] = { status: { name: "Generated" } };
  properties["Last Generated At"] = {
    date: { start: new Date().toISOString() },
  };
  properties["Generation Version"] = {
    rich_text: [{ type: "text" as const, text: { content: GENERATION_VERSION } }],
  };

  await withRetry(() =>
    notion.pages.update({
      page_id: pageId,
      properties,
    }),
  );
}

// ============================================================
// Rich text chunking (2000 char limit per chunk)
// ============================================================

const NOTION_RICH_TEXT_LIMIT = 2000;

function splitIntoRichTextChunks(
  text: string,
): Array<{ type: "text"; text: { content: string } }> {
  if (text.length <= NOTION_RICH_TEXT_LIMIT) {
    return [{ type: "text", text: { content: text } }];
  }

  const chunks: Array<{ type: "text"; text: { content: string } }> = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= NOTION_RICH_TEXT_LIMIT) {
      chunks.push({ type: "text", text: { content: remaining } });
      break;
    }

    // Split at natural boundaries within the limit
    let splitIndex = remaining.lastIndexOf("\n\n", NOTION_RICH_TEXT_LIMIT);
    if (splitIndex <= 0) splitIndex = remaining.lastIndexOf("\n", NOTION_RICH_TEXT_LIMIT);
    if (splitIndex <= 0) splitIndex = remaining.lastIndexOf(" ", NOTION_RICH_TEXT_LIMIT);
    if (splitIndex <= 0) splitIndex = NOTION_RICH_TEXT_LIMIT;

    chunks.push({ type: "text", text: { content: remaining.slice(0, splitIndex) } });
    remaining = remaining.slice(splitIndex).replace(/^\n+/, "");
  }

  if (chunks.length > 100) {
    console.warn(`Text required ${chunks.length} chunks (max 100). Truncating.`);
    return chunks.slice(0, 100);
  }

  return chunks;
}
