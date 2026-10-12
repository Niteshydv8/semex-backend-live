// Experiment: why do expiry (BT iframe) and name/address (top frame) miss?
import { chromium } from 'playwright';
const WHOP_URL = process.env.WHOP_URL || 'https://whop.com/checkout/plan_gXTa5fieE3T1L';
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: '/repl/tools/bin/chromium', headless: true,
});
const page = await ctx.newPage();
await page.goto(WHOP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);

// Top frame: check ALL matches for name/address selectors (duplicates?)
const topDup = await page.evaluate(() => {
  const all = sel => Array.from(document.querySelectorAll(sel)).map(el => ({
    id: el.id, name: el.name, value: el.value,
    visible: !!(el.offsetWidth || el.offsetHeight),
    display: getComputedStyle(el).display,
    disabled: el.disabled, readOnly: el.readOnly,
  }));
  return { name: all('input[name="name"]'), line1: all('input[name="line1"]') };
});
console.log('TOP name matches:', JSON.stringify(topDup.name));
console.log('TOP line1 matches:', JSON.stringify(topDup.line1));

// Try a setFormValue-style fill on the first name field and read back
const nameTest = await page.evaluate(() => {
  const el = document.querySelector('input[name="name"]');
  if (!el) return 'no el';
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  el.focus();
  set.call(el, 'Test Person');
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: 'Test Person' }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
  return el.value;
});
console.log('name after manual setFormValue:', JSON.stringify(nameTest));
await page.waitForTimeout(800);
console.log('name after 800ms settle:', await page.evaluate(() => document.querySelector('input[name="name"]').value));

// Expiry iframe: try paste "12/28" vs "1228" vs human typing
for (const f of page.frames()) {
  if (!f.url().includes('card-expiration-date')) continue;
  const r1 = await f.evaluate(() => {
    const el = document.querySelector('#expirationDate');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus();
    set.call(el, '12/28');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertFromPaste', data: '12/28' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  });
  await page.waitForTimeout(400);
  const r1b = await f.evaluate(() => document.querySelector('#expirationDate').value);
  console.log('expiry paste "12/28":', JSON.stringify(r1), '→ after settle:', JSON.stringify(r1b));

  const r2 = await f.evaluate(async () => {
    const el = document.querySelector('#expirationDate');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus();
    set.call(el, '');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    let cur = '';
    for (const ch of '1228') {
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ch }));
      cur += ch;
      set.call(el, cur);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ch }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: ch }));
      await new Promise(r => setTimeout(r, 20));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  });
  await page.waitForTimeout(400);
  const r2b = await f.evaluate(() => document.querySelector('#expirationDate').value);
  console.log('expiry typed "1228":', JSON.stringify(r2), '→ after settle:', JSON.stringify(r2b));
}
await ctx.close();
