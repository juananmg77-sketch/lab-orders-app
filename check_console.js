import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => console.log('PAGE REPONSE:', response.status(), response.url()));
  page.on('requestfailed', request => console.log('PAGE REQUEST FAILED:', request.failure().errorText, request.url()));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await browser.close();
})();
