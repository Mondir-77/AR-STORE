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

await prisma.orderItem.deleteMany();
await prisma.order.deleteMany();
await prisma.product.deleteMany();
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
console.log("Catalog reseeded:", CATALOG.length, "products");
await prisma.$disconnect();
