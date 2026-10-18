import { getRequestSession } from "@/middleware/session/requireSession.js";
import { createLinkEvent } from "@/services/linkEvents/createLinkEvent.js";
import { CreateLinkEventRequestSchema } from "@opulus/core";
import { Request, Response } from "express";

export const createLinkEventBodySchema = CreateLinkEventRequestSchema;

/**
 * A Plaid Link event the frontend reports. Link runs in the browser, so this is
 * the only way its events (and the session and request ids Plaid support asks
 * for) reach us. It is stored with the login session it was reported in.
 *
 * POST /api/link-events
 */
export async function createLinkEventController(
  req: Request,
  res: Response<void>
) {
  const { user, session } = getRequestSession(res);

  await createLinkEvent({
    userId: user.id,
    sessionId: session.id,
    event: createLinkEventBodySchema.parse(req.body),
  });

  res.status(204).send();
}
