import { assertRequiredConfig } from "@opulus/core";

// Imported right after dotenv and before anything that reads the configuration,
// so a bad production environment stops the service before it does anything.
assertRequiredConfig("webhooks");
