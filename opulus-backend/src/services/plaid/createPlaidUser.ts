import { UserCreateRequest } from "plaid";
import { plaidClient } from "@/client/plaid.js";
import { handlePlaidError } from "@/utils/plaidErrors.js";

/**
 * Create a Plaid user
 * @param userId - User ID from your database
 * @returns Plaid user creation response
 */
export async function createPlaidUser(userId: string) {
  try {
    const request: UserCreateRequest = {
      client_user_id: userId,
    };

    const response = await plaidClient.userCreate(request);
    return response.data;
  } catch (error) {
    throw handlePlaidError(error);
  }
}

