import express from "express";
import path from "path";
import usersRouter from "./routes/users";
import facilitiesRouter from "./routes/facilities";
import bookingsRouter from "./routes/bookings";
import feedbackRouter from "./routes/feedback";
import reportsRouter from "./routes/reports";
import analyticsRouter from "./routes/analytics";
import adminRouter from "./routes/admin";
import attendanceRouter from "./routes/attendance";
import notificationsRouter from "./routes/notifications";
import violationsRouter from "./routes/violations";
import matchmakingRouter from "./routes/matchmaking";
import { errorHandler } from "./middleware/errorHandler";

import cors from "cors";
import requestLogger from "./middleware/requestLogger";

export const app = express();
const publicDir = path.join(process.cwd(), "public");

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));
// Log incoming requests for debugging (shows masked auth preview)
app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", usersRouter);
app.use("/api/facilities", facilitiesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/violations", violationsRouter);
app.use("/api/matchmaking", matchmakingRouter);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  return res.sendFile(path.join(publicDir, "index.html"));
});

app.use(errorHandler);
