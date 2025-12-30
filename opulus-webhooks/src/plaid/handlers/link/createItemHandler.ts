import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  linkSessionService,
  normalizePlaidAccount,
  normalizePlaidItem,
  plaidService,
  prisma,
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
    // Get link session by link token
    const linkSessionResponse = await linkSessionService.getByToken(
      event.link_token
    );

    // Exchange public token for access token
    const accessTokenRespone = await plaidService.exchangePublicToken(
      event.public_token
    );

    // Retrieve the item from Plaid
    const itemResponse = await plaidService.getItem(
      accessTokenRespone.access_token
    );
    const { item } = itemResponse;

    // Retrieve the institution from Plaid (skip if item doesn't have institution_id)
    let institution = null;
    if (item.institution_id) {
      try {
        const institutionResponse = await plaidService.getInstitutionById(
          item.institution_id
        );
        institution = institutionResponse.institution;
      } catch (error) {
        // Log error but continue - institution data is optional
        console.warn(
          `[ITEM WEBHOOK] Failed to fetch institution ${item.institution_id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    // Fetch accounts from Plaid for this item
    const accountsResponse = await plaidService.getAccounts(
      accessTokenRespone.access_token
    );

    // Transform Plaid Item to our database format
    const itemData = normalizePlaidItem(
      item,
      linkSessionResponse.userId,
      accessTokenRespone.access_token,
      institution
    );

    // Create item and accounts in a transaction
    // If any part fails, the entire transaction rolls back
    await prisma.$transaction(async (tx) => {
      // Create the item first
      const createdItem = await tx.item.create({ data: itemData });

      // Create all accounts for this item
      for (const plaidAccount of accountsResponse.accounts) {
        const accountData = normalizePlaidAccount(
          plaidAccount,
          createdItem.id,
          linkSessionResponse.userId
        );

        await tx.bankAccount.create({ data: accountData });
      }

      return createdItem;
    });

    console.log(
      `[ITEM WEBHOOK] ITEM_ADD_RESULT - Item created: ${item.item_id} for user ${linkSessionResponse.userId} with ${accountsResponse.accounts.length} accounts`
    );
  } catch (error) {
    throw error;
  }
}
