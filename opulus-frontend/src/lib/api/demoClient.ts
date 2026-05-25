/**
 * Demo API Client
 * Returns mock data without making any network calls
 * Implements the same interface as axios client
 */

import type { ItemPublicDTO } from "@opulus/core";

/**
 * Demo items data - matches ItemsResponse['data']['items']
 * This is what the frontend expects from GET /api/items
 */
const demoItems: ItemPublicDTO[] = [
  {
    id: "demo-item-1",
    institutionName: "Chase Bank",
    institutionLogo: "https://logo.clearbit.com/chase.com",
    institutionColor: "#117ACA",
    error: null,
    accounts: [
      {
        id: "demo-account-1",
        name: "Chase Total Checking",
        type: "depository",
        balanceAvailable: 5420.50,
        balanceCurrent: 5420.50,
        balanceLimit: null,
      },
      {
        id: "demo-account-2",
        name: "Chase Savings",
        type: "depository",
        balanceAvailable: 12500.00,
        balanceCurrent: 12500.00,
        balanceLimit: null,
      },
    ],
  },
  {
    id: "demo-item-2",
    institutionName: "Bank of America",
    institutionLogo: "https://logo.clearbit.com/bankofamerica.com",
    institutionColor: "#E31837",
    error: null,
    accounts: [
      {
        id: "demo-account-3",
        name: "Bank of America Credit Card",
        type: "credit",
        balanceAvailable: 7500.00,
        balanceCurrent: 2500.00,
        balanceLimit: 10000.00,
      },
    ],
  },
];

/**
 * Check if we're in demo mode
 */
export const isDemoMode = (): boolean => {
  return (
    import.meta.env.VITE_DEMO_MODE === "true" ||
    window.location.hostname === "demo.opulus.app"
  );
};

/**
 * Demo API Client - No network calls, returns mock data
 * Implements axios-like interface for seamless replacement
 */
class DemoApiClient {
  /**
   * Simulate axios.get() - returns mock data based on URL
   */
  async get<T>(url: string): Promise<{ data: T }> {
    // Simulate network delay (optional, makes it feel more realistic)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Route to appropriate mock data based on URL
    if (url === "/api/items" || url.startsWith("/api/items")) {
      return {
        data: {
          data: {
            items: demoItems,
          },
        } as T,
      };
    }

    // Default: return empty data
    return {
      data: {} as T,
    };
  }

  /**
   * Simulate axios.post() - returns mock data based on URL
   */
  async post<T>(url: string, _data?: unknown): Promise<{ data: T }> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Route to appropriate mock data based on URL
    if (url === "/api/plaid/link-token" || url.startsWith("/api/plaid/link-token")) {
      return {
        data: {
          data: {
            linkToken: "demo-link-token",
            expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        } as T,
      };
    }

    // Default: return empty data
    return {
      data: {} as T,
    };
  }
}

// Export singleton instance
export const demoApiClient = new DemoApiClient();

