import { createServiceClient } from "./supabase/functions/shared/supabase.ts";
import { processNextJob } from "./supabase/functions/queue-worker/index.ts";

async function main() {
  console.log("⚡ Starting Local Queue Worker...");
  console.log("Press Ctrl+C to stop.");

  const service = createServiceClient();
  const workerId = `local-worker:${crypto.randomUUID()}`;

  while (true) {
    try {
      // Poll for next job
      const result = await processNextJob(service, workerId);
      if (result.processed) {
        console.log(`[Worker] Processed job ${result.jobId} with status: ${result.status}`);
      }
    } catch (error: any) {
      console.error("[Worker Error]:", error.message);
    }
    // Wait 3 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

main();
