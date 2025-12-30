import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  itemService,
  linkSessionService,
  normalizePlaidItem,
  plaidService,
} from "@opulus/core";

export async function createItemHandler(event: PlaidWebhookEvent) {
  if (!event.link_token) {
    throw new AppError(
      "link_token is required for ITEM_ADD_RESULT webhook",
      400
    );
  }

  if (!event.public_token) {
    throw new AppError(
      "public_token is required for ITEM_ADD_RESULT webhook",
      400
    );
  }

  try {
    // Get link session by link token and exchange public token for access token
    const linkSessionResponse = await linkSessionService.getByToken(
      event.link_token
    );
    const accessTokenRespone = await plaidService.exchangePublicToken(
      event.public_token
    );

    // Retrieve the item from Plaid
    const itemResponse = await plaidService.getItem(
      accessTokenRespone.access_token
    );
    const { item } = itemResponse;

    // Transform Plaid Item to our database format
    const itemData = normalizePlaidItem(
      item,
      linkSessionResponse.userId,
      accessTokenRespone.access_token
    );

    // Create the item in our database
    await itemService.create(itemData);

    console.log(
      `[ITEM WEBHOOK] ITEM_ADD_RESULT - Item created: ${item.item_id} for user ${linkSessionResponse.userId}`
    );
  } catch (error) {
    throw error;
  }
}
