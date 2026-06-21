"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    await prisma.facility.createMany({
        data: [
            {
                name: "Tennis Court A",
                category: "Sport",
                openTime: "09:00",
                closeTime: "14:00",
                minParticipants: 2,
                maxParticipants: 4,
            },
            {
                name: "Basketball Court",
                category: "Sport",
                openTime: "09:00",
                closeTime: "14:00",
                minParticipants: 6,
                maxParticipants: 12,
            },
            {
                name: "Gym Main Hall",
                category: "Fitness",
                openTime: "09:00",
                closeTime: "14:00",
                minParticipants: 1,
                maxParticipants: 30,
            }
        ],
        skipDuplicates: true,
    });
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
