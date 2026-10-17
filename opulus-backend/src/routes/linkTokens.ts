import { createLinkTokenController } from "@/controllers/linkTokens/createLinkTokenController.js";
import {
  createUpdateLinkTokenController,
  updateLinkTokenBodySchema,
} from "@/controllers/linkTokens/createUpdateLinkTokenController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Link token routes
 * All routes require authentication
 */
router.post("/", requireSession, createLinkTokenController);

router.post(
  "/update",
  requireSession,
  validate(updateLinkTokenBodySchema),
  createUpdateLinkTokenController
);

export default router;
