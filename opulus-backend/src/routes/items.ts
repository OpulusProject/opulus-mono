import {
  createItemBodySchema,
  createItemController,
} from "@/controllers/items/createItemController.js";
import { deleteItemController } from "@/controllers/items/deleteItemController.js";
import { getItemsController } from "@/controllers/items/getItemsController.js";
import { updateItemAccountsController } from "@/controllers/items/updateItemAccountsController.js";
import { requireSession } from "@/middleware/session/requireSession.js";
import { validate } from "@/middleware/validation.js";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();

/**
 * Items routes
 * All routes require authentication
 */
router.get("/", requireSession, getItemsController);

router.post(
  "/",
  requireSession,
  validate(createItemBodySchema),
  createItemController
);

router.post(
  "/:id/update-accounts",
  requireSession,
  updateItemAccountsController
);

router.delete("/:id", requireSession, deleteItemController);

export default router;
