/**
 * Browser helpers for the E2E suite: starting Chrome through puppeteer-core (already a dev
 * dependency of the accessibility audit, which uses the same installed Chrome), and the few page
 * actions the scenarios share.
 *
 * Selectors are the accessible ones a person uses (an aria-label, a field id the form defines for
 * its label, a stable class that is also the component's name), never a position or a style.
 * Waits are conditions with a bound (waitForFunction / waitForSelector with a timeout), never a
 * fixed sleep.
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

/** The default bound for a UI condition. */
const WAIT_MS = 10_000;

/** The installed Chrome, or null. */
function findChrome() {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;
}

/** Starts a headless browser. */
function launch(executablePath) {
  return puppeteer.launch({ executablePath, headless: true, args: ['--lang=he-IL'] });
}

/**
 * A fresh page in its own browser context: its own localStorage and cookies, so scenarios cannot
 * leak a cart, a stored checkout attempt or a login into each other.
 */
async function newPage(browser, { cookie } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(WAIT_MS);
  await page.setViewport({ width: 1280, height: 900 });
  if (cookie) await page.setCookie(cookie);
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push({ method: request.method(), url: request.url(), body: request.postData() || null });
  });
  return { page, context, requests, close: () => context.close() };
}

/** Whether any text on the page contains `text`. */
function waitForText(page, text, timeout = WAIT_MS) {
  return page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

/** Clicks the button whose accessible name is exactly `name` (an aria-label or its text). */
async function clickButton(page, name) {
  await page.locator(`::-p-aria([role="button"][name="${name}"])`).click();
}

/** Clicks the first button whose aria-label starts with `prefix`. */
async function clickByLabelPrefix(page, prefix) {
  await page.locator(`[aria-label^="${prefix}"]`).click();
}

/** Opens a product page and adds the product to the cart with the buy bar. */
async function addToCartFromProductPage(page, baseUrl, product) {
  await page.goto(`${baseUrl}/product/${product.id}`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, product.name);
  const before = await cartCount(page);
  await page.locator('.product-buy-add').click();
  await page.waitForFunction((n) => {
    const label = document.querySelector('.navbar-cart-btn')?.getAttribute('aria-label') || '';
    const match = label.match(/(\d+)\s*פריטים/);
    return (match ? Number(match[1]) : 0) > n;
  }, {}, before);
}

/** The cart count the navbar announces, or 0. */
async function cartCount(page) {
  return page.evaluate(() => {
    const label = document.querySelector('.navbar-cart-btn')?.getAttribute('aria-label') || '';
    const match = label.match(/(\d+)\s*פריטים/);
    return match ? Number(match[1]) : 0;
  });
}

/** Opens the cart drawer through the navbar button. */
async function openCart(page) {
  await clickByLabelPrefix(page, 'עגלת קניות');
  await page.waitForSelector('.cart-rows, .cart-empty');
}

/** Picks a delivery method in the cart step by its visible name ("איסוף עצמי" or "משלוח"). */
async function chooseDelivery(page, valueName) {
  await page.waitForSelector('.delivery-option');
  const value = valueName === 'pickup' ? 'pickup' : 'delivery';
  await page.evaluate((v) => document.querySelector(`.delivery-option-input[value="${v}"]`).click(), value);
}

/** Moves from the cart step to the details step. */
async function continueToDetails(page) {
  await clickButton(page, 'המשך לפרטים ←');
  await page.waitForSelector('#checkout-name');
}

/** Fills the checkout form. */
async function fillCheckout(page, { name, phone, email, address, notes }) {
  await page.type('#checkout-name', name);
  await page.type('#checkout-phone', phone);
  if (email) await page.type('#checkout-email', email);
  if (address) await page.type('#checkout-address', address);
  if (notes) await page.type('#checkout-notes', notes);
}

/** Presses "שלח הזמנה". */
async function submitOrder(page) {
  await clickButton(page, 'שלח הזמנה');
}

/**
 * Lets a test decide what happens to each POST /api/orders the page makes. `handler(request, n)`
 * gets the request and its number (1 = the first), and must call one of the actions below; every
 * other request passes through untouched.
 */
async function interceptOrderPosts(page, handler) {
  let n = 0;
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return;
    if (request.method() === 'POST' && request.url().endsWith('/api/orders')) {
      n += 1;
      Promise.resolve(handler(request, n)).catch(() => request.abort('failed').catch(() => {}));
    } else {
      request.continue();
    }
  });
}

/** Sends the page's own request body to the real server, then drops the answer: the order is saved and the browser never hears. */
async function forwardThenDrop(request) {
  const res = await fetch(request.url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: request.postData() });
  await res.text();
  await request.abort('connectionreset');
  return res.status;
}

/** Reads the stored checkout attempt (localStorage), or null. */
function storedAttempt(page) {
  return page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('tamburia-checkout-attempt')); } catch { return null; }
  });
}

module.exports = {
  WAIT_MS, findChrome, launch, newPage, waitForText, clickButton, clickByLabelPrefix,
  addToCartFromProductPage, cartCount, openCart, chooseDelivery, continueToDetails,
  fillCheckout, submitOrder, storedAttempt, interceptOrderPosts, forwardThenDrop,
};
