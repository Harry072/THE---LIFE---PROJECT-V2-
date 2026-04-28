const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.text().includes('[AutoLoopDebug]')) {
      console.log(`PAGE LOG: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`PAGE ERROR: ${err.message}`);
  });

  try {
    await page.goto('http://localhost:5173/onboarding');
    await page.waitForTimeout(1000);

    // Step 1
    await page.click('text="I feel lost"');
    await page.click('text="Continue"');
    await page.waitForTimeout(1000);

    // Step 2
    await page.click('text="Step into The Loop"');
    await page.waitForTimeout(1000);

    // Step 3
    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('text="Create Account"');

    // Wait for dashboard and network
    await page.waitForTimeout(5000);

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
