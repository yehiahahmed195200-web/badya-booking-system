const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log("🔍 Looking up data in database...");

  const admin = await prisma.users.findFirst({
    where: { email: 'admin@badya.edu' }
  });
  const student = await prisma.users.findFirst({
    where: { email: 'student1@badya.edu' }
  });
  const mpCourt = await prisma.facilities.findFirst({
    where: { name: 'Multipurpose Court' }
  });

  if (!admin || !student || !mpCourt) {
    console.error("❌ Setup data missing. Ensure database is seeded.");
    console.log("admin:", !!admin);
    console.log("student:", !!student);
    console.log("mpCourt:", !!mpCourt);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n✅ Admin: ${admin.full_name || admin.fullName} (ID = ${admin.id})`);
  console.log(`✅ Student: ${student.full_name || student.fullName} (ID = ${student.id})`);
  console.log(`✅ Court: ${mpCourt.name} (ID = ${mpCourt.id})`);

  const API_BASE = 'http://localhost:8080';
  const studentHeaders = {
    'Authorization': `Bearer demo-token-${student.id}`,
    'Content-Type': 'application/json'
  };
  const adminHeaders = {
    'Authorization': `Bearer demo-token-${admin.id}`,
    'Content-Type': 'application/json'
  };

  await prisma.$disconnect();

  // Test 1: Try booking without a sport selection
  console.log("\n🧪 Test 1: Booking Multipurpose Court WITHOUT sport...");
  let res = await fetch(`${API_BASE}/api/bookings`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({
      userId: Number(student.id),
      facilityId: Number(mpCourt.id),
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T14:00:00", // 2 days later at 2:00 PM
      participants: 6,
      durationMins: 60
    })
  });
  let resText = await res.text();
  if (res.status === 400 && resText.includes("Sport selection (Basketball or Volleyball) is required")) {
    console.log("✅ Passed: Blocked booking without sport. Error:", resText);
  } else {
    console.error(`❌ Failed: Expected 400 with sport required error. Got status ${res.status}:`, resText);
  }

  // Test 2: Try booking with an invalid sport selection
  console.log("\n🧪 Test 2: Booking Multipurpose Court with INVALID sport (e.g. Tennis)...");
  res = await fetch(`${API_BASE}/api/bookings`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({
      userId: Number(student.id),
      facilityId: Number(mpCourt.id),
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T14:00:00",
      participants: 6,
      durationMins: 60,
      sport: 'Tennis'
    })
  });
  resText = await res.text();
  if (res.status === 400 && resText.includes("Invalid sport selection. Must be Basketball or Volleyball")) {
    console.log("✅ Passed: Blocked booking with invalid sport. Error:", resText);
  } else {
    console.error(`❌ Failed: Expected 400 with invalid sport error. Got status ${res.status}:`, resText);
  }

  // Test 3: Successful booking with valid sport (Basketball)
  console.log("\n🧪 Test 3: Booking Multipurpose Court with Basketball...");
  const testTimeStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T11:00:00";
  console.log(`Booking for slot: ${testTimeStr}`);

  res = await fetch(`${API_BASE}/api/bookings`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({
      userId: Number(student.id),
      facilityId: Number(mpCourt.id),
      startTime: testTimeStr,
      participants: 6,
      durationMins: 60,
      sport: 'Basketball'
    })
  });
  resText = await res.text();
  if (res.ok) {
    const booking = JSON.parse(resText);
    console.log("✅ Passed: Booking successful. Saved scannedIdData:", booking.scannedIdData || booking.scanned_id_data);
    if ((booking.scannedIdData || booking.scanned_id_data) === "matchmaking:Basketball") {
      console.log("✅ Passed: Sport correctly stored as matchmaking:Basketball");
    } else {
      console.error("❌ Failed: scannedIdData mismatch:", booking.scannedIdData || booking.scanned_id_data);
    }
  } else {
    console.error(`❌ Failed to create booking: Status ${res.status}:`, resText);
  }
}

runTests().catch(err => {
  console.error("💥 Unhandled Error:", err);
});
