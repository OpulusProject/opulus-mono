/**
 * Generic webhook queue for processing webhooks asynchronously
 * Provider-agnostic - accepts any processor function
 * In production, replace with a proper queue system (Bull, RabbitMQ, etc.)
 */

type WebhookProcessor = (event: unknown) => Promise<void>;

interface QueueItem {
  event: unknown;
  processor: WebhookProcessor;
  provider: string;
  timestamp: number;
}

class WebhookQueue {
  private queue: QueueItem[] = [];
  private processing = false;

  /**
   * Add a webhook event to the queue
   * @param event - Webhook event data (any type)
   * @param processor - Function to process the webhook
   * @param provider - Provider name (e.g., "plaid", "stripe") for logging
   */
  async add<T>(
    event: T,
    processor: (event: T) => Promise<void>,
    provider: string = "unknown",
  ): Promise<void> {
    this.queue.push({
      event,
      processor: processor as WebhookProcessor,
      provider,
      timestamp: Date.now(),
    });
    this.process();
  }

  /**
   * Process webhooks from the queue
   */
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await item.processor(item.event);
      } catch (error) {
        console.error(
          `Failed to process ${item.provider} webhook:`,
          error instanceof Error ? error.message : String(error),
        );
        // In production, add to dead letter queue or retry logic
      }
    }

    this.processing = false;
  }

  /**
   * Get queue size (for monitoring)
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get queue stats (for monitoring)
   */
  getStats(): { size: number; processing: boolean } {
    return {
      size: this.queue.length,
      processing: this.processing,
    };
  }
}

export const webhookQueue = new WebhookQueue();

