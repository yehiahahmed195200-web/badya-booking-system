import "dotenv/config";
import { app } from "./app";
import { startCronJobs } from "./services/cronService";
import { startNotificationWorker } from "./services/notificationService";

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Booking API running on http://localhost:${port}`);
  startCronJobs();
  startNotificationWorker();
});
