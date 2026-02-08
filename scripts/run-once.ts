import { runOnce } from "../src/runner.js";

async function main() {
  console.log("=== AISO Comms Hub: Single Run ===\n");

  const result = await runOnce();

  // Summary
  console.log("\n--- Summary ---");
  for (const page of result.pages) {
    const status = page.success ? "OK" : "FAIL";
    console.log(`  [${status}] ${page.title} (${page.durationMs}ms)`);
    if (page.error) console.log(`         Error: ${page.error}`);
  }

  console.log(`\nTotal: ${result.successCount}/${result.processedPages} succeeded`);
  console.log(`Duration: ${result.totalDurationMs}ms`);

  // Exit with non-zero if any page failed (useful for CI)
  process.exit(result.failureCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
