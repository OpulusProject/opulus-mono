const WRITES = new Set(["post", "put", "patch", "delete"]);

/**
 * A route that changes something (anything but GET) may call Plaid, and Plaid's
 * calls are billed and limited per client, so each one carries `plaidRateLimit`
 * (counted per signed-in user). A route that never reaches Plaid says so with
 * an `eslint-disable-next-line` and the reason.
 *
 * Checks `router.post|put|patch|delete(path, ...handlers)` in the route files.
 */
export default {
  meta: {
    type: "problem",
    docs: { description: "Require plaidRateLimit on routes that are not GET" },
    schema: [],
    messages: {
      missing:
        "{{method}} routes call Plaid, so they need `plaidRateLimit` (after requireSession). If this one never reaches Plaid, disable this rule for the line and say why.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== "MemberExpression" ||
          callee.object.type !== "Identifier" ||
          callee.property.type !== "Identifier" ||
          !WRITES.has(callee.property.name)
        ) {
          return;
        }
        const limited = node.arguments.some(
          (argument) =>
            argument.type === "Identifier" && argument.name === "plaidRateLimit"
        );
        if (!limited) {
          context.report({
            node,
            messageId: "missing",
            data: { method: callee.property.name.toUpperCase() },
          });
        }
      },
    };
  },
};
