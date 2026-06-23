import "dotenv/config";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, label) {
  console.log(`\n[render-start] ${label}...`);
  execSync(cmd, { stdio: "inherit", cwd: serverRoot, env: process.env });
}

function shouldBootstrap() {
  if (String(process.env.RUN_DB_SEED || "").toLowerCase() === "true") return true;
  try {
    const out = execSync("node scripts/needs-bootstrap.js", {
      cwd: serverRoot,
      env: process.env,
      encoding: "utf8"
    });
    return String(out || "").trim() === "yes";
  } catch (err) {
    console.warn("[render-start] Bootstrap check failed — will seed:", err?.message || err);
    return true;
  }
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
    run("npx prisma db push", "Sync MongoDB schema");
    if (shouldBootstrap()) {
      run("node prisma/seed.js", "Bootstrap database (empty or RUN_DB_SEED=true)");
    } else {
      console.log("[render-start] Database already initialized — skipping seed.");
    }
  } catch (err) {
    console.error("\n[render-start] Database setup failed.");
    console.error("Check: MongoDB Atlas → Network Access → 0.0.0.0/0");
    console.error("Check: DATABASE_URL username, password, and /arstore database name");
    if (err?.message) console.error(err.message);
    process.exit(1);
  }

  if (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn(
      "[render-start] WARNING: Cloudinary not configured. Uploaded images/videos are stored on ephemeral disk and will be lost on restart/deploy."
    );
    console.warn("[render-start] Add CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME + API_KEY + API_SECRET) in Render Environment.");
  } else {
    console.log("[render-start] Media storage: Cloudinary (persistent uploads).");
  }

  run("node src/index.js", "Start HTTP server");
}

main();
