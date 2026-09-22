/**
 * Replay a dead-lettered webhook event back onto the queue.
 *
 * Usage:
 *   pnpm --filter @opulus/webhooks replay <deadLetterId>
 *
 * Looks up the WebhookDeadLetter row, re-enqueues its payload on the "webhooks"
 * queue, and stamps `replayedAt`. Intended for manual operator use after a
 * fix/outage; the normal path is BullMQ's automatic retries.
 */
import { prisma } from "@opulus/core";

import { webhookQueue } from "../src/queue/webhookQueue.js";
import type { PlaidWebhookEvent } from "../src/types/plaid/webhookSchema.js";

async function main(): Promise<void> {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: pnpm --filter @opulus/webhooks replay <deadLetterId>");
    process.exit(1);
  }

  const record = await prisma.webhookDeadLetter.findUnique({ where: { id } });
  if (!record) {
    console.error(`No dead-letter record found for id: ${id}`);
    process.exit(1);
  }

  const event = record.payload as PlaidWebhookEvent;
  const job = await webhookQueue.add(
    `process-${event.webhook_type.toLowerCase()}`,
    event
  );

  await prisma.webhookDeadLetter.update({
    where: { id },
    data: { replayedAt: new Date() },
  });

  console.log(
    `Replayed dead-letter ${id} (${event.webhook_type}/${event.webhook_code}) as job ${job.id}`
  );
}

main()
  .catch((error) => {
    console.error("Replay failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void webhookQueue.close();
    void prisma.$disconnect();
  });
