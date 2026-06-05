const API = "http://localhost:8080";

async function jfetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const usersRes = await jfetch("/api/users");
  if (!usersRes.ok) throw new Error("Cannot load users");
  const users = usersRes.data;
  const student = users.find((u) => u.role === "STUDENT" && !u.banned && !u.isBanned);
  const coach = users.find((u) => u.role === "COACH");
  if (!student || !coach) throw new Error("Missing seeded student/coach users");

  const facilitiesRes = await jfetch("/api/facilities?activeOnly=false");
  if (!facilitiesRes.ok) throw new Error("Cannot load facilities");
  const facility = facilitiesRes.data[0];
  if (!facility) throw new Error("No facility found");

  const getRules = await jfetch("/api/admin/system-rules");
  if (!getRules.ok) throw new Error("Cannot load system rules");

  const updatedRules = {
    maxBookingsPerUserPerDay: 1,
    autoBanWarningThreshold: 999,
    advanceBookingWindowDays: 2,
    minBookingDurationMins: 45,
    maxBookingDurationMins: 120,
    priorityBookingEnabled: true,
    priorityScoreThreshold: 100,
    priorityEarlyAccessHours: 24,
    allowBackToBackBookings: false,
    globalEmailNotificationsEnabled: true,
  };

  const patchRules = await jfetch("/api/admin/system-rules", {
    method: "PATCH",
    body: JSON.stringify(updatedRules),
  });
  if (!patchRules.ok) throw new Error(`Rules update failed: ${JSON.stringify(patchRules.data)}`);

  const allBookingsRes = await jfetch("/api/bookings");
  if (!allBookingsRes.ok) throw new Error("Cannot load bookings");
  const allBookings = allBookingsRes.data || [];

  const candidateDays = [1, 2];
  let firstSlot = null;
  for (const dayOffset of candidateDays) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() + dayOffset);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const existing = allBookings.filter((b) => {
      if (String(b?.user?.id || b?.userId) !== String(student.id)) return false;
      const t = new Date(b.startTime).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime() && b.status !== "CANCELLED";
    });
    if (existing.length === 0) {
      firstSlot = new Date(dayStart);
      firstSlot.setHours(9, 0, 0, 0);
      break;
    }
  }
  if (!firstSlot) throw new Error("Could not find a free day for student within current advance window");

  const booking1 = await jfetch("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      userId: student.id,
      facilityId: facility.id,
      startTime: firstSlot.toISOString().slice(0, 19),
      participants: Math.max(2, facility.minParticipants || 1),
      durationMins: 60,
    }),
  });

  const sameDaySecond = new Date(firstSlot);
  sameDaySecond.setHours(12, 0, 0, 0);
  const booking2 = await jfetch("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      userId: student.id,
      facilityId: facility.id,
      startTime: sameDaySecond.toISOString().slice(0, 19),
      participants: Math.max(2, facility.minParticipants || 1),
      durationMins: 60,
    }),
  });

  const shortDuration = await jfetch("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      userId: student.id,
      facilityId: facility.id,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString().slice(0, 19),
      participants: Math.max(2, facility.minParticipants || 1),
      durationMins: 30,
    }),
  });

  const nonPriorityFuture = new Date();
  nonPriorityFuture.setDate(nonPriorityFuture.getDate() + 4);
  nonPriorityFuture.setHours(10, 0, 0, 0);
  const bookingFutureStudent = await jfetch("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      userId: student.id,
      facilityId: facility.id,
      startTime: nonPriorityFuture.toISOString().slice(0, 19),
      participants: Math.max(2, facility.minParticipants || 1),
      durationMins: 60,
    }),
  });

  // Keep the same advance window constraints, but raise daily cap to avoid false negatives
  // from existing seed/test data when validating priority access behavior.
  await jfetch("/api/admin/system-rules", {
    method: "PATCH",
    body: JSON.stringify({ maxBookingsPerUserPerDay: 5 }),
  });

  const priorityFuture = new Date();
  priorityFuture.setDate(priorityFuture.getDate() + 3);
  priorityFuture.setHours(11, 0, 0, 0);
  const bookingFutureCoach = await jfetch("/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      userId: coach.id,
      facilityId: facility.id,
      startTime: priorityFuture.toISOString().slice(0, 19),
      participants: Math.max(2, facility.minParticipants || 1),
      durationMins: 60,
    }),
  });

  const results = {
    rulesRead: getRules.ok,
    rulesUpdated: patchRules.ok,
    bookingFirstAllowed: booking1.ok,
    dailyLimitEnforced: !booking2.ok && /Daily booking limit/i.test(booking2.data?.message || ""),
    minDurationEnforced: !shortDuration.ok && /duration/i.test(shortDuration.data?.message || ""),
    advanceWindowEnforcedForNormalUser: !bookingFutureStudent.ok && /advance window/i.test(bookingFutureStudent.data?.message || ""),
    priorityAccessAllowed: bookingFutureCoach.ok,
  };

  console.log(JSON.stringify({ results, details: {
    booking1: { ok: booking1.ok, status: booking1.status, message: booking1.data?.message },
    booking2: { ok: booking2.ok, status: booking2.status, message: booking2.data?.message },
    shortDuration: { ok: shortDuration.ok, status: shortDuration.status, message: shortDuration.data?.message },
    bookingFutureStudent: { ok: bookingFutureStudent.ok, status: bookingFutureStudent.status, message: bookingFutureStudent.data?.message },
    bookingFutureCoach: { ok: bookingFutureCoach.ok, status: bookingFutureCoach.status, message: bookingFutureCoach.data?.message },
  } }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
