const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Upserting Multipurpose Court in plural facilities table...");
  const mpCourt = await prisma.facilities.upsert({
    where: { name: "Multipurpose Court" },
    update: {
      sports: "Basketball,Volleyball",
      active: true,
      status: "OPEN"
    },
    create: {
      name: "Multipurpose Court",
      category: "Main Sports",
      open_time: "08:00",
      close_time: "15:00",
      openTime: "08:00",
      closeTime: "15:00",
      default_slot_mins: 60,
      defaultSlotMins: 60,
      min_participants: 6,
      minParticipants: 6,
      max_participants: 20,
      maxParticipants: 20,
      active: true,
      status: "OPEN",
      sports: "Basketball,Volleyball"
    }
  });
  console.log("✅ Plural facilities court upserted:", mpCourt.id);

  // Also upsert in singular facility table just in case
  const mpCourtSingular = await prisma.facility.upsert({
    where: { name: "Multipurpose Court" },
    update: {
      sports: "Basketball,Volleyball",
      isActive: true,
      status: "OPEN"
    },
    create: {
      id: "multipurpose-court",
      name: "Multipurpose Court",
      category: "Main Sports",
      openTime: "08:00",
      closeTime: "15:00",
      defaultSlotMins: 60,
      minParticipants: 6,
      maxParticipants: 20,
      isActive: true,
      status: "OPEN",
      sports: "Basketball,Volleyball"
    }
  });
  console.log("✅ Singular facility court upserted:", mpCourtSingular.id);

  await prisma.$disconnect();
}

run().catch(err => console.error(err));
