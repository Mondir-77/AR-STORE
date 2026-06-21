import "dotenv/config";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, label) {
  console.log(`\n[render-start] ${label}...`);
  execSync(cmd, { stdio: "inherit", cwd: serverRoot, env: process.env });
}

function main() {
  const dbUrl = String(process.env.DATABASE_URL || "").trim();
  if (!dbUrl) {
    console.error("[render-start] FATAL: DATABASE_URL is missing.");
    console.error("Add it in Render → Environment → DATABASE_URL");
    process.exit(1);
  }
  if (!/^mongodb(\+srv)?:\/\//.test(dbUrl)) {
    console.error("[render-start] FATAL: DATABASE_URL must start with mongodb:// or mongodb+srv://");
    process.exit(1);
  }

  try {
    run("npx prisma db push --accept-data-loss", "Sync MongoDB schema");
    run("node prisma/seed.js", "Seed database");
  } catch (err) {
    console.error("\n[render-start] Database setup failed.");
    console.error("Check: MongoDB Atlas → Network Access → 0.0.0.0/0");
    console.error("Check: DATABASE_URL username, password, and /arstore database name");
    if (err?.message) console.error(err.message);
    process.exit(1);
  }

  run("node src/index.js", "Start HTTP server");
}

main();
