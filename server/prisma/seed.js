import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATALOG = [
  { name: "Parfum", price: 299, costPrice: 120, categoryId: 1, imageUrl: "parfumes 1.jpeg", description: "" },
  { name: "Parfum", price: 150, costPrice: 60, categoryId: 1, imageUrl: "parfumes 2.jpeg", description: "" },
  { name: "Parfum", price: 100, costPrice: 40, categoryId: 1, imageUrl: "parfumes 3.jpeg", description: "" },
  { name: "Electronics", price: 899, costPrice: 500, categoryId: 2, imageUrl: "pc 1.jpeg", description: "" },
  { name: "Electronics", price: 899, costPrice: 500, categoryId: 2, imageUrl: "pc 2.jpeg", description: "" },
  { name: "Electronics", price: 899, costPrice: 500, categoryId: 2, imageUrl: "pc 4.jpeg", description: "" },
  { name: "Clothing", price: 450, costPrice: 180, categoryId: 3, imageUrl: "vetem7.jpeg", description: "" },
  { name: "Clothing", price: 450, costPrice: 180, categoryId: 3, imageUrl: "vetem8.jpeg", description: "" },
  { name: "Clothing", price: 450, costPrice: 180, categoryId: 3, imageUrl: "vetem 3.jpeg", description: "" },
  { name: "Watches", price: 1200, costPrice: 600, categoryId: 4, imageUrl: "watche 1.jpeg", description: "" },
  { name: "Watches", price: 1200, costPrice: 600, categoryId: 4, imageUrl: "watche 2.jpeg", description: "" },
  { name: "Watches", price: 1200, costPrice: 600, categoryId: 4, imageUrl: "watche 3.jpeg", description: "" },
  { name: "Shoes", price: 380, costPrice: 150, categoryId: 5, imageUrl: "chose 1.jpeg", description: "" },
  { name: "Shoes", price: 380, costPrice: 150, categoryId: 5, imageUrl: "chose 2.jpeg", description: "" },
  { name: "Shoes", price: 380, costPrice: 150, categoryId: 5, imageUrl: "chose 3.jpeg", description: "" }
];

async function main() {
  const adminEmail = String(process.env.ADMIN_EMAIL || "admin@arstore.local").toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "changeme123");
  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, passwordHash: hash, fullName: "Mondir AR", role: "ADMIN" },
    update: { role: "ADMIN", fullName: "Mondir AR" }
  });

  const guestHash = await bcrypt.hash("guest-not-used", 10);
  await prisma.user.upsert({
    where: { email: "guest@arstore.local" },
    create: { email: "guest@arstore.local", passwordHash: guestHash, fullName: "Guest", role: "USER" },
    update: {}
  });

  const count = await prisma.product.count();
  if (count === 0) {
    await prisma.product.createMany({
      data: CATALOG.map((p) => ({
        name: p.name,
        description: p.description,
        price: p.price,
        costPrice: p.costPrice,
        categoryId: p.categoryId,
        imageUrl: p.imageUrl
      }))
    });
  }

  const defaults = {
    storeName: "AR STORE",
    footerText: "© 2026 Mondir Aghbalou — All rights reserved",
    whatsapp: "212632592347",
    email: "mondiraghbalou@gmail.com",
    instagram: "https://www.instagram.com/ar_store_7/",
    supportHours: "Mon–Sat 9:00–21:00",
    catalogCategories: JSON.stringify([
      { id: 1, name: "Parfum", image: "parf.jpeg" },
      { id: 2, name: "Electronics", image: "2.jpeg" },
      { id: 3, name: "Clothing", image: "3.jpeg" },
      { id: 4, name: "Watches", image: "4.jpeg" },
      { id: 5, name: "Shoes", image: "5.jpeg" }
    ])
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.storeSetting.upsert({
      where: { key },
      create: { key, value },
      update: {}
    });
  }

  console.log("Seed OK. Admin:", adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
