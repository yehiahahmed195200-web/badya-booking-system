const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBackend() {
  console.log("🔍 Checking database via Prisma to find Admin User...");
  
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@badya.edu' }
  });

  if (!admin) {
    console.error("❌ Admin user 'admin@badya.edu' not found in database.");
    await prisma.$disconnect();
    return;
  }

  const adminId = admin.id;
  console.log(`\n✅ Admin found: ID = ${adminId}, Email = ${admin.email}`);
  await prisma.$disconnect();

  const token = `demo-token-${adminId}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const API_BASE = 'http://localhost:8080';

  console.log("\n🧪 Test 1: GET /api/admin/fairness-config...");
  let configResponse = await fetch(`${API_BASE}/api/admin/fairness-config`, { headers });
  if (!configResponse.ok) {
    console.error("❌ GET /api/admin/fairness-config failed:", await configResponse.text());
    return;
  }
  let config = await configResponse.json();
  console.log("✅ Config successfully retrieved:", JSON.stringify(config, null, 2));

  console.log("\n🧪 Test 2: PUT /api/admin/fairness-config (Valid update)...");
  const updatePayload = {
    basketballQuotaPercent: 65.0,
    volleyballQuotaPercent: 35.0,
    playerWeightCoeff: 0.5,
    unusedHoursWeightCoeff: 0.3,
    primeTimeDisadvantageCoeff: 0.2 // Sums to 1.0
  };
  let putResponse = await fetch(`${API_BASE}/api/admin/fairness-config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updatePayload)
  });
  if (!putResponse.ok) {
    console.error("❌ PUT failed:", await putResponse.text());
    return;
  }
  let updatedConfig = await putResponse.json();
  console.log("✅ Config successfully updated:", JSON.stringify(updatedConfig, null, 2));

  console.log("\n🧪 Test 3: PUT /api/admin/fairness-config (Invalid update — coefficients do not sum to 1.0)...");
  const invalidPayload = {
    playerWeightCoeff: 0.7,
    unusedHoursWeightCoeff: 0.3,
    primeTimeDisadvantageCoeff: 0.3 // Sums to 1.3
  };
  let putResponseInvalid = await fetch(`${API_BASE}/api/admin/fairness-config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(invalidPayload)
  });
  if (putResponseInvalid.status === 400) {
    console.log("✅ Success: Server rejected invalid coefficients with status 400. Message:", (await putResponseInvalid.json()).message);
  } else {
    console.error("❌ Error: Server did not reject invalid coefficients! Status:", putResponseInvalid.status);
  }

  console.log("\n🧪 Test 4: GET /api/analytics/fairness (Verify dynamic index computation)...");
  let analyticsResponse = await fetch(`${API_BASE}/api/analytics/fairness`, { headers });
  if (!analyticsResponse.ok) {
    console.error("❌ GET /api/analytics/fairness failed:", await analyticsResponse.text());
    return;
  }
  let analytics = await analyticsResponse.json();
  console.log("✅ Analytics output successfully retrieved:", JSON.stringify(analytics, null, 2));
}

testBackend().catch(err => {
  console.error("💥 Unhandled Error:", err);
});
