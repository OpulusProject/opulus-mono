import { PlaidWebhookEvent } from "@/types/plaid/webhookSchema";
import {
  AppError,
  linkSessionService,
  logger,
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
        logger.warn(
          {
            event: {
              webhook_type: event.webhook_type,
              webhook_code: event.webhook_code,
              item_id: event.item_id,
            },
            institution_id: item.institution_id,
            error_type:
              error instanceof Error ? error.constructor.name : typeof error,
            error_message:
              error instanceof Error ? error.message : String(error),
            recoverable: true,
          },
          "Failed to fetch institution (optional)"
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

    logger.info(
      {
        event: {
          webhook_type: event.webhook_type,
          webhook_code: event.webhook_code,
          item_id: event.item_id,
        },
        user_id: linkSessionResponse.userId,
        accounts_count: accountsResponse.accounts.length,
      },
      "Item and accounts created successfully"
    );
  } catch (error) {
    logger.error(
      {
        event: {
          webhook_type: event.webhook_type,
          webhook_code: event.webhook_code,
          item_id: event.item_id,
        },
        error_type:
          error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      },
      "Handler execution failed"
    );
    throw error;
  }
}
