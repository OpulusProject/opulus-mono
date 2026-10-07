import { getSession } from "@/services/session/getSession.js";
import {
  CreateLinkEventRequestSchema,
  logger,
  UnauthorizedError,
} from "@opulus/core";
import { NextFunction, Request, Response } from "express";

export const createLinkEventBodySchema = CreateLinkEventRequestSchema;

/**
 * Plaid Link events the frontend reports. Link runs in the browser, so this is
 * the only way its events (and the session and request ids Plaid support asks
 * for) reach our logs. Errors are logged as warnings.
 *
 * POST /api/link-events
 */
export async function createLinkEventController(
  req: Request,
  res: Response<void>,
  next: NextFunction
) {
  try {
    const session = await getSession(req.headers);
    if (!session?.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const event = createLinkEventBodySchema.parse(req.body);

    const fields = {
      user_id: session.user.id,
      link_event: event.eventName,
      link_mode: event.mode,
      item_id: event.itemId,
      link_session_id: event.linkSessionId,
      plaid_request_id: event.requestId,
      institution_id: event.institutionId,
      institution_name: event.institutionName,
      view_name: event.viewName,
      exit_status: event.exitStatus,
      error_type: event.errorType,
      error_code: event.errorCode,
      error_message: event.errorMessage,
    };

    if (event.eventName === "ERROR") {
      logger.warn(fields, "Plaid Link error");
    } else {
      logger.info(fields, "Plaid Link event");
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
