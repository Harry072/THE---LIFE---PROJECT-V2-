import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));
page.on('requestfailed', (req) => errors.push(`REQUEST_FAILED: ${req.url()} :: ${req.failure()?.errorText}`));

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);
console.log('TITLE:', await page.title());
console.log('CONSOLE_ERRORS:', JSON.stringify(errors, null, 2));
await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
await browser.close();
