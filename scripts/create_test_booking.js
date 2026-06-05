const dotenv = require('dotenv');
dotenv.config({ override: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const student = await prisma.user.findUnique({ where: { email: 'student1@badya.edu' } });
    const facility = await prisma.facility.findUnique({ where: { name: 'Tennis Court A' } });

    if (!student) {
      console.error('Student not found (student1@badya.edu)');
      process.exit(1);
    }
    if (!facility) {
      console.error('Facility not found (Tennis Court A)');
      process.exit(1);
    }

    const start = new Date(Date.now() + 1 * 60 * 1000); // 1 minute from now
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour

    const booking = await prisma.booking.create({
      data: {
        userId: student.id,
        facilityId: facility.id,
        startTime: start,
        endTime: end,
        participants: 1,
        status: 'CONFIRMED',
        termsAccepted: true,
      },
    });

    console.log('Created booking:', booking.id);
    await prisma.$disconnect();
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
