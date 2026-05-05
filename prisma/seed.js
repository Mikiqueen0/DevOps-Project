const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const username = "demo";
  const passwordHash = await bcrypt.hash("DemoPass123!", 12);

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash }
  });

  await prisma.pnlEntry.deleteMany({ where: { userId: user.id } });

  for (let i = 0; i < 120; i += 1) {
    const day = new Date();
    day.setUTCHours(12, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - i);
    const randomAmount = Math.round((Math.random() * 1800 - 900) * 100) / 100;

    await prisma.pnlEntry.create({
      data: { userId: user.id, date: day, amount: randomAmount }
    });
  }

  console.log("Seed completed.");
  console.log("Demo user:", username, "/ password: DemoPass123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
