const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  await page.goto('http://localhost:8086/?tab=boxes&sub=box_t0012', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000); // wait for 5 seconds to let React settle
  await page.screenshot({ path: 'scratch/screenshot.png' });
  await browser.close();
})();
