const path = require("path");
const { chromium } = require("playwright");

async function runPersistentTest(name, launchOptions) {
  const userDataDir = path.join(__dirname, ".tmp-playwright", name);
  let browser;

  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      ...launchOptions,
    });

    const page = await browser.newPage();
    await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = await page.title();
    console.log(`[PASS] ${name}: ${title}`);
    return true;
  } catch (error) {
    console.error(`[FAIL] ${name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function runLaunchTest(name, launchOptions) {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      ...launchOptions,
    });

    const page = await browser.newPage();
    await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = await page.title();
    console.log(`[PASS] ${name}: ${title}`);
    return true;
  } catch (error) {
    console.error(`[FAIL] ${name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function runLaunchVariantTest(name, launchOptions, newContextOptions = {}) {
  let browser;

  try {
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage(newContextOptions);
    await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = await page.title();
    console.log(`[PASS] ${name}: ${title}`);
    return true;
  } catch (error) {
    console.error(`[FAIL] ${name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  const chromePath = "C:\\Users\\alejo\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe";

  const results = [];
  results.push(await runLaunchTest("bundled-chromium-launch", {}));
  results.push(await runPersistentTest("bundled-chromium-persistent", {}));
  results.push(await runLaunchTest("system-chrome-launch", { executablePath: chromePath, channel: undefined }));
  results.push(await runPersistentTest("system-chrome-persistent", { executablePath: chromePath, channel: undefined }));
  results.push(await runLaunchVariantTest("system-chrome-headed", { executablePath: chromePath, headless: false, channel: undefined }));
  results.push(await runLaunchVariantTest("system-chrome-no-sandbox-arg-removed", {
    executablePath: chromePath,
    channel: undefined,
    headless: true,
    ignoreDefaultArgs: ["--no-sandbox"],
  }));

  if (results.every(Boolean)) {
    console.log("Smoke test completed successfully.");
    process.exit(0);
  }

  console.error("Smoke test failed.");
  process.exit(1);
}

main();
