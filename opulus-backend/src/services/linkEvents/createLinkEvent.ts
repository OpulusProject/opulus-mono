import {
  linkEventRepository,
  logger,
  type CreateLinkEventRequest,
} from "@opulus/core";

export interface CreateLinkEventParams {
  userId: string;
  /** The login session the event was reported in. */
  sessionId: string;
  event: CreateLinkEventRequest;
}

/**
 * Keep a Plaid Link event the browser reported. Link runs there, so this is the
 * only way its events, and the ids Plaid support asks for, reach us. The event
 * is stored with the user and the login session it happened in, and also
 * logged (an ERROR as a warning) so it shows up next to the request logs.
 */
export async function createLinkEvent(
  params: CreateLinkEventParams
): Promise<void> {
  const { userId, sessionId, event } = params;

  await linkEventRepository.create({ userId, sessionId, ...event });

  const fields = {
    user_id: userId,
    session_id: sessionId,
    link_event: event.eventName,
    link_mode: event.mode,
    plaid_link_session_id: event.plaidLinkSessionId,
    plaid_request_id: event.plaidRequestId,
    error_code: event.errorCode,
  };
  if (event.eventName === "ERROR") {
    logger.warn(fields, "Plaid Link error");
  } else {
    logger.info(fields, "Plaid Link event");
  }
}
