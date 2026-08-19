/**
 * Records a short demo video of the app driving through all three query
 * modes, then converts it to a GIF. Run this against the live stack
 * (`docker compose up`) — it's a dev tool, not part of the app itself.
 *
 * Usage:
 *   cd scripts
 *   npm init -y && npm install playwright
 *   npx playwright install chromium
 *   node record_demo.js
 *
 * Requires ffmpeg on PATH for the webm -> gif conversion step
 * (apt install ffmpeg / brew install ffmpeg).
 */

const { chromium } = require("playwright");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const APP_URL = process.env.APP_URL || "http://localhost:5173";
const OUT_DIR = path.join(__dirname, "demo-output");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  await page.goto(APP_URL);
  await page.waitForSelector(".map-container canvas", { timeout: 15000 });
  await sleep(1500); // let the basemap + zoning layer finish loading

  // --- Mode 1: nearest amenity ---
  await page.selectOption("select >> nth=0", "nearest");
  await clickMapCenter(page, 0, 0);
  await sleep(2000);

  // widen the radius to show more results
  const radiusSlider = await page.$('input[type="range"]');
  if (radiusSlider) {
    await radiusSlider.fill("3000");
    await clickMapCenter(page, 20, -15);
    await sleep(2000);
  }

  // --- Mode 2: parcel / zoning lookup ---
  await page.selectOption("select >> nth=0", "parcel");
  await clickMapCenter(page, -40, 30);
  await sleep(2000);

  // --- Mode 3: isochrone ---
  await page.selectOption("select >> nth=0", "isochrone");
  await clickMapCenter(page, 0, 0);
  await sleep(2500);

  await context.close();
  await browser.close();

  const videoFile = fs.readdirSync(OUT_DIR).find((f) => f.endsWith(".webm"));
  if (!videoFile) {
    console.error("No video file produced — check Playwright's output above.");
    return;
  }
  const webmPath = path.join(OUT_DIR, videoFile);
  const gifPath = path.join(OUT_DIR, "demo.gif");

  console.log(`Converting ${webmPath} -> ${gifPath} with ffmpeg...`);
  execSync(
    `ffmpeg -y -i "${webmPath}" -vf "fps=12,scale=960:-1:flags=lanczos" -loop 0 "${gifPath}"`,
    { stdio: "inherit" }
  );
  console.log(`Done: ${gifPath}`);
}

async function clickMapCenter(page, dx, dy) {
  const box = await page.$eval(".map-container", (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
