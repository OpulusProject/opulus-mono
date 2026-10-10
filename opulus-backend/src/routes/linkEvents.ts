import {
  createLinkEventBodySchema,
  createLinkEventController,
} from "@/controllers/linkEvents/createLinkEventController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Link event routes
 * All routes require authentication
 */
router.post(
  "/",
  requireSession,
  validate(createLinkEventBodySchema),
  createLinkEventController
);

export default router;
