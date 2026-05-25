/**
 * Demo Mode Middleware
 * Detects demo mode from hostname and sets it in request context
 */

import { Request, Response, NextFunction } from "express";
import { config } from "@opulus/core";

/**
 * Middleware to detect demo mode from hostname
 * Sets req.isDemoMode flag for use in controllers
 */
export function detectDemoMode(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Check if hostname is demo.opulus.app
  const isDemoHostname = req.hostname === "demo.opulus.app";
  
  // Check if DEMO_MODE env var is set
  const isDemoEnv = config.demoMode;
  
  // Set demo mode flag on request
  (req as any).isDemoMode = isDemoHostname || isDemoEnv;
  
  next();
}

/**
 * Get demo mode status from request
 */
export function getDemoMode(req: Request): boolean {
  return (req as any).isDemoMode === true;
}

