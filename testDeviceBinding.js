const BASE_URL = 'http://localhost:8080/api';

async function runTests() {
  console.log("====================================================");
  console.log("   Badya Sport Booking System - Device Binding Tests");
  console.log("====================================================");

  // We will check what users are seeded first!
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const allUsers = await prisma.users.findMany();
  console.log("Database Users list:");
  allUsers.forEach(u => {
    console.log(`ID: ${u.id}, Name: ${u.fullName}, Email: ${u.email}, StudentID: ${u.studentId}, StudentID_snake: ${u.student_id}`);
  });

  const studentUser = allUsers.find(u => u.role === 'STUDENT' && u.email === 'student1@badya.edu');
  if (!studentUser) {
    throw new Error("Could not find student1@badya.edu in database!");
  }

  // Use the actual studentId loaded from the database!
  // In Java, it uses u.student_id which maps to student_id or studentId in JPA.
  // Let's print which studentId we are using.
  const studentId = studentUser.studentId || studentUser.student_id || 'STD001';
  console.log(`\nUsing Student ID for tests: ${studentId}`);

  const deviceA = 'device-fingerprint-AAAAA';
  const deviceB = 'device-fingerprint-BBBBB';

  try {
    // Step 1: Initiate Student Login for Device A (First time - should return OTP_REQUIRED)
    console.log(`\n[Test 1] Initiating login for Student ${studentId} on Device A...`);
    const initRes = await fetch(`${BASE_URL}/auth/student-login-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, deviceId: deviceA })
    });

    const initData = await initRes.json();
    console.log("Response Status:", initData.status);
    console.log("Message:", initData.message);
    if (initData.status !== 'OTP_REQUIRED') {
      throw new Error("Expected OTP_REQUIRED on new device!");
    }
    console.log("✅ Test 1 Passed: OTP_REQUIRED triggered correctly.");

    // Step 2: Retrieve OTP code from MySQL database via Prisma
    console.log("\n[Test 2] Retrieving OTP code from MySQL database via Prisma...");
    const userInDb = await prisma.users.findFirst({
      where: { id: studentUser.id }
    });

    const otp = userInDb.otpCode || userInDb.otp_code;
    console.log(`Retrieved OTP Code from DB: ${otp}`);
    if (!otp) {
      throw new Error("No OTP code found in DB!");
    }
    console.log("✅ Test 2 Passed: OTP retrieved successfully.");

    // Step 3: Verify OTP on Device A (should succeed and bind Device A)
    console.log(`\n[Test 3] Verifying OTP on Device A...`);
    const verifyRes = await fetch(`${BASE_URL}/auth/student-login-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, deviceId: deviceA, otp })
    });

    const verifyData = await verifyRes.json();
    console.log("Response Success:", verifyData.success);
    console.log("Logged In User fullName:", verifyData.user.fullName);
    console.log("Logged In User studentId:", verifyData.user.studentId);
    if (!verifyData.success) {
      throw new Error("Expected OTP verification to succeed!");
    }
    console.log("✅ Test 3 Passed: Device A successfully bound.");

    // Step 4: Login again on Device A (should be PASSWORDLESS_SUCCESS)
    console.log(`\n[Test 4] Logging in again on Device A (Passwordless Entry)...`);
    const quickRes = await fetch(`${BASE_URL}/auth/student-login-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, deviceId: deviceA })
    });

    const quickData = await quickRes.json();
    console.log("Response Status:", quickData.status);
    console.log("User:", quickData.user.fullName);
    if (quickData.status !== 'PASSWORDLESS_SUCCESS') {
      throw new Error("Expected PASSWORDLESS_SUCCESS on bound device!");
    }
    console.log("✅ Test 4 Passed: Passwordless Quick Login worked!");

    // Step 5: Try to log in from Device B (should trigger OTP and unbind Device A)
    console.log(`\n[Test 5] Attempting login for Student ${studentId} on New Device B...`);
    const initResB = await fetch(`${BASE_URL}/auth/student-login-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, deviceId: deviceB })
    });

    const initDataB = await initResB.json();
    console.log("Response Status:", initDataB.status);
    console.log("Message:", initDataB.message);
    if (initDataB.status !== 'OTP_REQUIRED') {
      throw new Error("Expected OTP_REQUIRED on Device B!");
    }
    console.log("✅ Test 5 Passed: OTP triggered on Device B.");

    // Step 6: Verify OTP on Device B (should succeed and bind Device B, unbinding Device A)
    console.log(`\n[Test 6] Retrieving new OTP and verifying on Device B...`);
    const userInDbB = await prisma.users.findFirst({
      where: { id: studentUser.id }
    });
    const otpB = userInDbB.otpCode || userInDbB.otp_code;
    console.log(`Retrieved OTP Code for Device B: ${otpB}`);

    const verifyResB = await fetch(`${BASE_URL}/auth/student-login-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, deviceId: deviceB, otp: otpB })
    });

    const verifyDataB = await verifyResB.json();
    console.log("Response Success:", verifyDataB.success);
    if (!verifyDataB.success) {
      throw new Error("Expected OTP verification to succeed on Device B!");
    }
    console.log("✅ Test 6 Passed: Device B bound successfully.");

    // Step 7: Check Device A again (should now trigger OTP because it was unbound by Device B)
    console.log(`\n[Test 7] Checking Device A login again (should be unbound now)...`);
    const checkResA = await fetch(`${BASE_URL}/auth/student-login-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, deviceId: deviceA })
    });

    const checkDataA = await checkResA.json();
    console.log("Response Status:", checkDataA.status);
    if (checkDataA.status !== 'OTP_REQUIRED') {
      throw new Error("Expected Device A to be unbound and require OTP!");
    }
    console.log("✅ Test 7 Passed: Device A was successfully unbound automatically!");

    // Step 8: Admin Reset Device via Endpoint
    console.log(`\n[Test 8] Resetting device binding via Admin reset endpoint...`);
    const adminUser = allUsers.find(u => u.role === 'ADMIN');
    const adminToken = `demo-token-${adminUser.id}`;

    const resetRes = await fetch(`${BASE_URL}/users/admin/${studentUser.id}/reset-device`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}` 
      }
    });

    const resetData = await resetRes.json();
    console.log("Response Success:", resetData.success);
    if (!resetData.success) {
      throw new Error("Expected admin device reset to succeed!");
    }

    // Verify Device B is now unbound
    const checkResB = await fetch(`${BASE_URL}/auth/student-login-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, deviceId: deviceB })
    });

    const checkDataB = await checkResB.json();
    console.log("Device B Status after Admin Reset:", checkDataB.status);
    if (checkDataB.status !== 'OTP_REQUIRED') {
      throw new Error("Expected Device B to be unbound after admin reset!");
    }
    console.log("✅ Test 8 Passed: Admin reset binding worked perfectly!");

    await prisma.$disconnect();
    console.log("\n====================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! DEVICE BINDING IS 100% CORRECT.");
    console.log("====================================================");

  } catch (error) {
    console.error("❌ Test Failed with error:", error.message);
    process.exit(1);
  }
}

runTests();
