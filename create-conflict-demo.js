// Create conflicts for demo purposes (don't resolve them)
const API = "http://localhost:8080";

async function main() {
  try {
    // Login as student
    console.log("1. Logging in as student...");
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student1@badya.edu", password: "student123" })
    });
    const loginData = await loginRes.json();
    console.log("   Login response:", JSON.stringify(loginData, null, 2).substring(0, 500));
    const token = loginData.token || loginData.data?.token;
    const userId = loginData.id || loginData.user?.id || loginData.data?.id;
    console.log("   Token:", token?.substring(0, 20) + "...");
    console.log("   UserId:", userId);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // Get facilities
    console.log("2. Getting facilities...");
    const facilRes = await fetch(`${API}/api/facilities`, { headers });
    const facilities = await facilRes.json();
    const court = facilities.find(f => f.name.includes("Tennis"));
    console.log(`   Found: ${court.name} (ID: ${court.id})`);

    // Create Booking 1
    console.log("\n3. Creating Booking 1 (10:00 - 11:00)...");
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const booking1Payload = {
      userId,
      facilityId: court.id,
      startTime: startDate + 'T10:00:00',
      participants: 2,
      durationMins: 60
    };
    console.log("   Payload:", JSON.stringify(booking1Payload, null, 2));
    const booking1Res = await fetch(`${API}/api/bookings`, {
      method: "POST",
      headers,
      body: JSON.stringify(booking1Payload)
    });
    if (!booking1Res.ok) {
      const errorText = await booking1Res.text();
      console.error("Failed to create booking 1 (status " + booking1Res.status + "):");
      console.error(errorText);
      return;
    }
    const b1 = await booking1Res.json();
    console.log(`   ✓ Created: ID=${b1.id}, conflictId=${b1.conflictId}`);

    // Create Booking 2 (overlapping)
    console.log("\n4. Creating Booking 2 (10:30 - 11:30, overlaps with Booking 1)...");
    const booking2Payload = {
      userId,
      facilityId: court.id,
      startTime: startDate + 'T10:30:00',
      participants: 2,
      durationMins: 60
    };
    const booking2Res = await fetch(`${API}/api/bookings`, {
      method: "POST",
      headers,
      body: JSON.stringify(booking2Payload)
    });
    if (!booking2Res.ok) {
      const errorText = await booking2Res.text();
      console.error("Failed to create booking 2 (status " + booking2Res.status + "):");
      console.error(errorText);
      return;
    }
    const b2 = await booking2Res.json();
    console.log(`   ✓ Created: ID=${b2.id}, conflictId=${b2.conflictId}`);

    // Verify conflict display
    console.log("\n5. Verifying conflict display...");
    const conflictsRes = await fetch(`${API}/api/admin/conflicts`, { headers });
    const conflicts = await conflictsRes.json();
    console.log(`   ✓ Found ${conflicts.length} conflict(s) in admin list`);
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      console.log(`   - Conflict ID: ${conflict.id}`);
      console.log(`   - Facility: ${conflict.description}`);
      console.log(`   - Bookings: ${conflict.bookings?.length || 0} items`);
    }

    console.log("\n✓ Conflict demo created successfully!");
    console.log("  - Check the admin dashboard Conflicts tab to see the conflict");
    console.log("  - The conflict will show both bookings for admin decision");

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
