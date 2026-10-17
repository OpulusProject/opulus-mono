/**
 * Put a dead webhook event back on the queue.
 *
 *   pnpm --filter @opulus/webhooks replay <webhookEventId>
 *
 * For an operator after a fix or an outage: the normal path is the queue's own
 * retries. An event can be replayed once. The new job is recorded as an event of
 * its own, so if it fails again it is dead again, under a new id.
 */
import { prisma } from "@opulus/core";
import { webhookQueue } from "../queue/webhookQueue.js";
import { replayWebhookEvent } from "../services/webhookEvents.js";

async function main(): Promise<void> {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: pnpm --filter @opulus/webhooks replay <webhookEventId>");
    process.exit(1);
  }

  const { jobId, event } = await replayWebhookEvent(id, async (name, event) => {
    const job = await webhookQueue.add(name, event);
    return job.id;
  });

  console.log(
    `Replayed webhook event ${id} (${event.webhook_type}/${event.webhook_code}) as job ${jobId}`
  );
}

main()
  .catch((error) => {
    console.error("Replay failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await webhookQueue.close();
    await prisma.$disconnect();
  });
