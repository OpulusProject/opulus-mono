import { uniqueEmail, uniqueId } from "../client.js";
import { testDb } from "../db.js";

/**
 * Put a user straight into the isolated test DB. For the suites that do not run
 * the backend (the webhook receiver's), which therefore cannot sign anyone up;
 * everything else makes a user through sign-up (`createAuthedUser`).
 */
export async function seedUser(): Promise<{ id: string; email: string }> {
  const user = await testDb().user.create({
    data: { id: uniqueId("user"), name: "Seeded User", email: uniqueEmail("seeded") },
  });
  return { id: user.id, email: user.email };
}
