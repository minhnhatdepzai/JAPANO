// Chụp màn hình thật của Storefront và Web Admin đang chạy trên máy phát triển.
// Chỉ đọc: script không đăng nhập bằng tài khoản thật, không gửi mutation nào.
const path = require('path');
const { chromium } = require(path.join('/home/nhat/Downloads/japano/web/node_modules/playwright'));

const OUT = path.join(__dirname, '..', 'assets', 'screens');
const STOREFRONT = process.env.JAPANO_SF || 'http://127.0.0.1:4200';
const ADMIN = process.env.JAPANO_ADMIN || 'http://127.0.0.1:4100/admin/';

const DESKTOP = [
  ['sf-home', `${STOREFRONT}/`],
  ['sf-products', `${STOREFRONT}/san-pham`],
  ['sf-tryon', `${STOREFRONT}/thu-do`],
  ['sf-japan', `${STOREFRONT}/du-lich-nhat-ban`],
  ['sf-store', `${STOREFRONT}/cua-hang`],
  ['sf-cart', `${STOREFRONT}/gio-hang`],
  ['sf-login', `${STOREFRONT}/dang-nhap`],
  ['sf-bestsellers', `${STOREFRONT}/ban-chay`],
  ['admin-login', ADMIN],
];
const MOBILE = [
  ['sf-home', `${STOREFRONT}/`],
  ['sf-products', `${STOREFRONT}/san-pham`],
  ['sf-tryon', `${STOREFRONT}/thu-do`],
];

async function shoot(context, name, url, suffix) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    // Dừng mọi video để ảnh chụp ổn định và không phụ thuộc khung hình.
    await page.evaluate(() => document.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch {} }));
    await page.waitForTimeout(600);
    const file = path.join(OUT, `${name}-${suffix}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`OK  ${name}-${suffix}  ${url}  console-errors=${errors.length}`);
  } catch (error) {
    console.log(`FAIL ${name}-${suffix} ${url} ${error.message.slice(0, 120)}`);
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  for (const [name, url] of DESKTOP) await shoot(desktop, name, url, 'desktop');
  await desktop.close();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  for (const [name, url] of MOBILE) await shoot(mobile, name, url, 'mobile');
  await mobile.close();
  await browser.close();
})();
