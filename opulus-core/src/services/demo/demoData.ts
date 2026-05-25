/**
 * Mock data fixtures for demo mode
 * These match the DTO structure exactly - no network calls needed
 */

import type { ItemPublicDTO } from "../../types/dto/items/getItems.js";

/**
 * Demo items data - matches ItemsResponse['data']['items']
 * This is what the frontend expects from GET /api/items
 */
export const demoItems: ItemPublicDTO[] = [
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

