import { deleteItemController } from "@/controllers/items/deleteItemController.js";
import { getItemsController } from "@/controllers/items/getItemsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Items routes
 * All routes require authentication
 */
router.get("/", requireSession, getItemsController);

router.delete("/:id", requireSession, deleteItemController);

export default router;
