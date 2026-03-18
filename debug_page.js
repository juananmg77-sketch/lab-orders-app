import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setViewport({width: 1280, height: 800});
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({path: 'debug_screenshot.png'});
    console.log('Screenshot saved to debug_screenshot.png');
  } catch (e) {
    console.log('Error during page load:', e.message);
  }
  
  await browser.close();
})();
