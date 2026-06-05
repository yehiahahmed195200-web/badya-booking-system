import { Request, Response, NextFunction } from "express";

// Simple request logger to help debug incoming API calls
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const ts = new Date().toISOString();
  const method = req.method;
  const path = req.originalUrl || req.url;
  const auth = req.header("authorization") || "";
  let authPreview = "";
  if (auth) {
    // show only small prefix of token for tracing (do not log full token)
    authPreview = auth.length > 20 ? `${auth.slice(0, 12)}...` : auth;
  }

  console.info(`[REQ ${ts}] ${method} ${path} auth=${authPreview}`);

  // Also capture response status on finish
  res.on("finish", () => {
    console.info(`[RES ${new Date().toISOString()}] ${method} ${path} -> ${res.statusCode}`);
  });

  next();
}

export default requestLogger;
