import { Router } from "express";
import { getItemsController } from "@/controllers/items/getItemsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";

const router: ReturnType<typeof Router> = Router();

/**
 * Items routes
 * All routes require authentication
 */
router.get("/", requireSession, getItemsController);

export default router;

