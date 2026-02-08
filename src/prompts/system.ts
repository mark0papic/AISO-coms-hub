import type { NotionPageInput } from "../types.js";
import { CHANNEL_RULES } from "./channel-rules.js";

export function buildSystemPrompt(brandVoice: string): string {
  const channelSection = Object.entries(CHANNEL_RULES)
    .map(([channel, rules]) => `### ${channel}\n${rules}`)
    .join("\n\n");

  return `You are a communications specialist for AISO, a student society. Your job is to generate channel-specific communication drafts from a core brief.

## Brand Voice
${brandVoice || "No brand voice rules provided. Use a professional, friendly, announcement-oriented tone."}

## Global Rules
- Never use em dashes (--). Use commas, periods, or semicolons instead.
- Write in British English.
- All content must be factually consistent across channels.
- Never fabricate details not present in the brief. If information is missing, omit it rather than making it up.
- Each channel draft must be self-contained (a reader should understand it without seeing other channels).
- Prioritise clarity over cleverness.
- Every channel must have a clear call to action.

## Output Format
You MUST respond with a JSON object containing exactly these keys:
- whatsapp_message
- member_email_subject
- member_email_body
- linkedin_post
- instagram_caption
- luma_description
- ambassador_message
- internal_aiso_brief

Each value must be a string containing the draft for that channel. Do not wrap the JSON in markdown code fences.

## Per-Channel Rules
${channelSection}`;
}

export function buildUserPrompt(page: NotionPageInput): string {
  const parts: string[] = [
    `# Communication Brief`,
    ``,
    `**Title:** ${page.title}`,
    `**Type:** ${page.type}`,
    `**Pillar:** ${page.pillar}`,
    `**Primary Audience:** ${page.primaryAudience.join(", ")}`,
    ``,
    `## Core Brief`,
    page.coreBrief,
  ];

  // Add optional fields only if present
  const logistics: string[] = [];
  if (page.eventDate) logistics.push(`**Event Date:** ${page.eventDate}`);
  if (page.eventTime) logistics.push(`**Event Time:** ${page.eventTime}`);
  if (page.location) logistics.push(`**Location:** ${page.location}`);
  if (page.deadline) logistics.push(`**Deadline:** ${page.deadline}`);
  if (page.signupLink) logistics.push(`**Signup Link:** ${page.signupLink}`);

  if (logistics.length > 0) {
    parts.push(``, `## Logistics`);
    parts.push(...logistics);
  }

  if (page.partnersSpeakers) parts.push(``, `**Partners/Speakers:** ${page.partnersSpeakers}`);
  if (page.selectivityLevel) parts.push(`**Selectivity Level:** ${page.selectivityLevel}`);
  if (page.incentives) parts.push(`**Incentives:** ${page.incentives}`);

  parts.push(``, `Generate all 8 channel drafts based on this brief. Respond with only the JSON object.`);

  return parts.join("\n");
}
