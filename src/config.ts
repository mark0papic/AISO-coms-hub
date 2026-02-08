import { z } from "zod";
import "dotenv/config";

const EnvSchema = z.object({
  NOTION_API_KEY: z.string().min(1, "NOTION_API_KEY is required"),
  NOTION_DATABASE_ID: z.string().min(1, "NOTION_DATABASE_ID is required"),
  NOTION_BRAND_VOICE_PAGE_ID: z.string().min(1, "NOTION_BRAND_VOICE_PAGE_ID is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-20250514"),
  MAX_PAGES_PER_RUN: z.coerce.number().int().min(1).max(50).default(10),
});

export type Env = z.infer<typeof EnvSchema>;

function loadConfig(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();

export const GENERATION_VERSION = "0.1.0";
