import { z } from "zod";

// ============================================================
// Channel identifiers
// ============================================================

export const CHANNELS = [
  "whatsapp_message",
  "member_email_subject",
  "member_email_body",
  "linkedin_post",
  "instagram_caption",
  "luma_description",
  "ambassador_message",
  "internal_aiso_brief",
] as const;

export type Channel = (typeof CHANNELS)[number];

// ============================================================
// Notion page input (read from database)
// ============================================================

export interface NotionPageInput {
  pageId: string;
  title: string;
  status: string;
  type: string;
  pillar: string;
  primaryAudience: string[];
  coreBrief: string;

  // Optional fields
  eventDate?: string;
  eventTime?: string;
  location?: string;
  deadline?: string;
  signupLink?: string;
  partnersSpeakers?: string;
  selectivityLevel?: string;
  incentives?: string;

  // Metadata
  lastGeneratedAt?: string;
  generationVersion?: string;
}

// ============================================================
// LLM generation output — Zod schema for validation
// ============================================================

export const GenerationOutputSchema = z.object({
  whatsapp_message: z.string().min(1).max(1500),
  member_email_subject: z.string().min(1).max(150),
  member_email_body: z.string().min(1).max(5000),
  linkedin_post: z.string().min(1).max(3000),
  instagram_caption: z.string().min(1).max(2200),
  luma_description: z.string().min(1).max(5000),
  ambassador_message: z.string().min(1).max(2000),
  internal_aiso_brief: z.string().min(1).max(3000),
});

export type GenerationOutput = z.infer<typeof GenerationOutputSchema>;

// ============================================================
// Notion property name mapping
// ============================================================

export const CHANNEL_TO_NOTION_PROPERTY: Record<Channel, string> = {
  whatsapp_message: "WhatsApp Message",
  member_email_subject: "Member Email Subject",
  member_email_body: "Member Email Body",
  linkedin_post: "LinkedIn Post",
  instagram_caption: "Instagram Caption",
  luma_description: "Luma Description",
  ambassador_message: "Ambassador Message",
  internal_aiso_brief: "Internal AISO Brief",
};

// ============================================================
// Processing results
// ============================================================

export interface PageResult {
  pageId: string;
  title: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface RunResult {
  processedPages: number;
  successCount: number;
  failureCount: number;
  pages: PageResult[];
  totalDurationMs: number;
}
