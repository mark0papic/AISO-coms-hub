import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "./config.js";
import type { NotionPageInput, GenerationOutput } from "./types.js";
import { GenerationOutputSchema } from "./types.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts/system.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export async function generateDrafts(
  page: NotionPageInput,
  brandVoice: string,
): Promise<GenerationOutput> {
  const systemPrompt = buildSystemPrompt(brandVoice);
  const userPrompt = buildUserPrompt(page);

  // Attempt 1
  const response = await anthropic.messages.create({
    model: config.CLAUDE_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block in response. Stop reason: ${response.stop_reason}`);
  }

  if (response.stop_reason === "max_tokens") {
    throw new Error("Response truncated due to max_tokens. The brief may be too complex.");
  }

  // Extract JSON from the response (handle possible markdown fences)
  const jsonText = extractJson(textBlock.text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.warn(`JSON parse failed for page ${page.pageId}. Attempting repair...`);
    return await repairGeneration(systemPrompt, userPrompt, textBlock.text);
  }

  const validated = GenerationOutputSchema.safeParse(parsed);
  if (validated.success) {
    return validated.data;
  }

  // Zod validation failed (e.g. text too long) — attempt repair
  console.warn(
    `Zod validation failed for page ${page.pageId}. Attempting repair...`,
    validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  );

  return await repairGeneration(systemPrompt, userPrompt, textBlock.text, validated.error);
}

async function repairGeneration(
  systemPrompt: string,
  originalUserPrompt: string,
  brokenOutput: string,
  zodError?: z.ZodError,
): Promise<GenerationOutput> {
  const errorDetails = zodError
    ? zodError.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")
    : "- The output was not valid JSON. Ensure you respond with ONLY a JSON object, no markdown fences or extra text.";

  const repairPrompt = `The previous generation had issues:

${errorDetails}

Here was the problematic output:
\`\`\`
${brokenOutput.slice(0, 6000)}
\`\`\`

Please fix these issues and return a corrected JSON object with exactly these keys:
whatsapp_message, member_email_subject, member_email_body, linkedin_post, instagram_caption, luma_description, ambassador_message, internal_aiso_brief

If text was too long for a channel, trim it while keeping the key message. Return ONLY the JSON object.`;

  const response = await anthropic.messages.create({
    model: config.CLAUDE_MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: "user", content: originalUserPrompt },
      { role: "assistant", content: brokenOutput.slice(0, 6000) },
      { role: "user", content: repairPrompt },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Repair attempt returned no text");
  }

  const jsonText = extractJson(textBlock.text);
  const parsed = JSON.parse(jsonText);
  return GenerationOutputSchema.parse(parsed); // throws on failure — no second repair
}

/**
 * Extract JSON from text that might be wrapped in markdown code fences.
 */
function extractJson(text: string): string {
  const trimmed = text.trim();

  // Try to find JSON within code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // If it starts with {, assume it's raw JSON
  if (trimmed.startsWith("{")) return trimmed;

  // Last resort: find the first { and last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}
