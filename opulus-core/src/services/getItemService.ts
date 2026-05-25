/**
 * Factory function to get the appropriate ItemService based on environment
 * Returns demo service in demo mode, real service otherwise
 * 
 * This allows controllers to use the same interface regardless of mode
 */

import { isDemoMode } from "../config/default.js";
import { demoItemService } from "./demo/demoItemService.js";
import { itemService } from "./itemService.js";

/**
 * Get the appropriate item service based on demo mode
 * @param forceDemoMode - Optional flag to force demo mode (from request context)
 * @returns ItemService instance (real or demo)
 */
export function getItemService(forceDemoMode?: boolean) {
  const shouldUseDemo = forceDemoMode ?? isDemoMode();
  if (shouldUseDemo) {
    return demoItemService;
  }
  return itemService;
}

