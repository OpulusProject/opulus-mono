/**
 * Factory function to get the appropriate API client based on environment
 * Returns demo client in demo mode (no network calls), real axios client otherwise
 */

import { apiClient } from "./client.js";
import { demoApiClient, isDemoMode } from "./demoClient.js";

export interface ApiClient {
  get<T>(url: string): Promise<{ data: T }>;
  post<T>(url: string, data?: unknown): Promise<{ data: T }>;
}

/**
 * Get the appropriate API client based on demo mode
 * @returns API client instance (real axios or demo mock)
 */
export function getApiClient(): ApiClient {
  if (isDemoMode()) {
    return demoApiClient;
  }
  return apiClient as ApiClient;
}

