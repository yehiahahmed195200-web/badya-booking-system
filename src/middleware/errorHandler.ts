import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const field = firstIssue?.path?.join(".") || "field";
    const msg = firstIssue?.message || "Invalid request data";
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: `${field}: ${msg}`,
      details: err.issues,
    });
  }

  if (err instanceof Error) {
    return res.status(400).json({
      code: "REQUEST_FAILED",
      message: err.message,
    });
  }

  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Unexpected server error",
  });
}
