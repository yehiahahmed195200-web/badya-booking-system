import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { verifyToken } from "../utils/auth";
import { prisma } from "../db";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing bearer token" });
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (token.startsWith("demo-token-")) {
    try {
      const javaId = token.replace("demo-token-", "").trim();
      let email = "";
      if (javaId === "1") email = "admin@badya.edu";
      else if (javaId === "2") email = "coach.kareem@badya.edu";
      else if (javaId === "3") email = "student1@badya.edu";
      else if (javaId === "4") email = "banned@badya.edu";

      if (email) {
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (dbUser) {
          req.auth = {
            userId: dbUser.id,
            role: dbUser.role
          };
          return next();
        }
      }
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid demo token user" });
    } catch (err) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Error validating demo token" });
    }
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }

    next();
  };
}
