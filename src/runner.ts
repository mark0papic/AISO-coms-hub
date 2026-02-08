import { fetchReadyPages, fetchBrandVoice, writeGeneratedDrafts } from "./notion.js";
import { generateDrafts } from "./generator.js";
import type { PageResult, RunResult } from "./types.js";

// ============================================================
// Single run: process all ready pages
// ============================================================

export async function runOnce(): Promise<RunResult> {
  const runStart = Date.now();
  const results: PageResult[] = [];

  console.log("Fetching brand voice...");
  const brandVoice = await fetchBrandVoice();
  console.log(`Brand voice loaded (${brandVoice.length} chars).`);

  console.log("Querying Notion for pages with Status = 'Ready for Comms'...");
  const pages = await fetchReadyPages();
  console.log(`Found ${pages.length} page(s) to process.`);

  if (pages.length === 0) {
    return {
      processedPages: 0,
      successCount: 0,
      failureCount: 0,
      pages: [],
      totalDurationMs: Date.now() - runStart,
    };
  }

  // Process pages sequentially (respects rate limits, keeps prompt cache warm)
  for (const page of pages) {
    const pageStart = Date.now();
    console.log(`\nProcessing: "${page.title}" (${page.pageId})`);

    try {
      // Idempotency guard: skip if generated very recently
      if (page.lastGeneratedAt) {
        const generatedAt = new Date(page.lastGeneratedAt).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (generatedAt > fiveMinutesAgo) {
          console.log("  Skipping: generated less than 5 minutes ago.");
          results.push({
            pageId: page.pageId,
            title: page.title,
            success: true,
            durationMs: Date.now() - pageStart,
          });
          continue;
        }
      }

      // Generate drafts via LLM
      console.log("  Generating drafts...");
      const drafts = await generateDrafts(page, brandVoice);

      // Write back to Notion (drafts + status + metadata in one call)
      console.log("  Writing to Notion...");
      await writeGeneratedDrafts(page.pageId, drafts);

      const duration = Date.now() - pageStart;
      console.log(`  Done (${duration}ms)`);
      results.push({
        pageId: page.pageId,
        title: page.title,
        success: true,
        durationMs: duration,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - pageStart;
      console.error(`  FAILED (${duration}ms): ${message}`);
      if (error instanceof Error && error.stack) {
        console.error(`  Stack: ${error.stack.split("\n").slice(1, 4).join("\n  ")}`);
      }
      results.push({
        pageId: page.pageId,
        title: page.title,
        success: false,
        error: message,
        durationMs: duration,
      });
      // Continue processing remaining pages
    }
  }

  const runResult: RunResult = {
    processedPages: results.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
    pages: results,
    totalDurationMs: Date.now() - runStart,
  };

  console.log(
    `\nRun complete: ${runResult.successCount}/${runResult.processedPages} succeeded in ${runResult.totalDurationMs}ms`,
  );

  return runResult;
}
