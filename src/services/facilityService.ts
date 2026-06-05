import { BookingStatus, FacilityStatus } from "@prisma/client";
import { prisma } from "../db";
import { createBulkNotifications } from "./notificationService";

type DeactivatePolicy = "CANCEL" | "KEEP";

type ChangeFacilityStatusInput = {
  facilityId: string;
  status: FacilityStatus;
  statusReason?: string;
  policy?: DeactivatePolicy;
  notifyUsers?: boolean;
};

export async function changeFacilityStatus(input: ChangeFacilityStatusInput) {
  const facility = await prisma.facility.findUnique({ where: { id: input.facilityId } });
  if (!facility) throw new Error("Facility not found");

  const updatedFacility = await prisma.facility.update({
    where: { id: input.facilityId },
    data: { 
      status: input.status,
      statusReason: input.statusReason,
      isActive: input.status === "OPEN"
    },
  });

  if (input.status === "OPEN") {
    return {
      facility: updatedFacility,
      impactedBookings: 0,
      cancelledBookings: 0,
      notificationsCreated: 0,
      policyApplied: "N/A",
    };
  }

  const futureBookings = await prisma.booking.findMany({
    where: {
      facilityId: input.facilityId,
      status: BookingStatus.CONFIRMED,
      startTime: { gte: new Date() },
    },
    include: {
      user: true,
    },
  });

  const policyToApply: DeactivatePolicy = input.policy ?? "CANCEL";

  let cancelledBookings = 0;
  if (policyToApply === "CANCEL" && futureBookings.length > 0) {
    await prisma.booking.updateMany({
      where: {
        id: {
          in: futureBookings.map((b) => b.id),
        },
      },
      data: { status: BookingStatus.CANCELLED },
    });

    cancelledBookings = futureBookings.length;
  }

  let notificationsCreated = 0;
  if (input.notifyUsers !== false && futureBookings.length > 0) {
    const message =
      policyToApply === "CANCEL"
        ? `Your booking at ${facility.name} has been cancelled due to facility deactivation.`
        : `Facility ${facility.name} has been deactivated. Your booking requires rescheduling by admin.`;

    const notifications = futureBookings.map((booking) => ({
      userId: booking.userId,
      title: "Facility Update",
      message,
      channel: "EMAIL" as const,
      type: "BOOKING" as const,
      priority: "HIGH" as const,
      dedupeKey: `facility-status:${input.facilityId}:${booking.id}:${input.status}`,
      payload: {
        facilityId: input.facilityId,
        facilityName: facility.name,
        bookingId: booking.id,
        policy: policyToApply,
        newStatus: input.status,
      },
    }));

    const result = await createBulkNotifications(notifications);
    notificationsCreated = result.total;
  }

  return {
    facility: updatedFacility,
    impactedBookings: futureBookings.length,
    cancelledBookings,
    notificationsCreated,
    policyApplied: policyToApply,
  };
}
