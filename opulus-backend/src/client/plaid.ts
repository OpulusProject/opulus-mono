import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import config from "@/config/default.js";

const configuration = new Configuration({
  basePath: PlaidEnvironments[config.plaidEnv as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": config.plaidClientId,
      "PLAID-SECRET": config.plaidSecret,
      "Plaid-Version": config.plaidVersion,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
export default plaidClient;

