import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const [admins, products] = await Promise.all([
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.product.count()
    ]);
    process.stdout.write(admins === 0 || products === 0 ? "yes" : "no");
  } catch (e) {
    console.error(e);
    process.stdout.write("yes");
  } finally {
    await prisma.$disconnect();
  }
}

main();
