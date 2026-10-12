/* SEMEX Generic Identity Autofill (v2.8.6)
 * Fills identity fields (email / username / name / phone / password) on
 * NON-checkout pages — login forms, signup forms, email capture, contact
 * forms — so the extension is useful everywhere, not just on gateways.
 *
 * Rules:
 * - Skips checkout/payment pages (the main fill pipeline in content.js owns
 *   those, including card fields).
 * - Only fills EMPTY, visible, editable inputs — never overwrites user data.
 * - Respects settings.formFilling (enabled / randomName / randomEmail /
 *   customName / customEmail) from chrome.storage.local.
 * - Uses the native value setter + input/change events so React/Vue forms
 *   register the value.
 */
(function () {
  "use strict";
  if (window.top !== window) return; // top frame only
  if (window.__SEMEX_IDENTITY_FILL_LOADED__) return;
  window.__SEMEX_IDENTITY_FILL_LOADED__ = true;

  // ---------- checkout / gateway pages are owned by the main fill pipeline ----------
  function isCheckoutPage() {
    try { if (sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true") return true; } catch (_e) {}
    const h = (location.hostname || "").toLowerCase();
    if (["checkout.stripe.com", "pay.stripe.com", "buy.stripe.com", "donate.stripe.com",
         "invoice.stripe.com", "billing.stripe.com", "pay.openai.com"].includes(h)) return true;
    const p = (location.pathname || "").toLowerCase();
    const payish = /\/(c\/pay|pay|checkout|payment|purchase|buy|subscribe|subscription|hpp|paystation)/.test(p);
    if (h.includes("checkoutshopper")) return true;
    if (h.includes("adyen.com")) return payish;
    if (h.includes("checkout.com")) return h.startsWith("pay.") || payish;
    if (h.includes("recurly.com")) return payish;
    if (h.includes("xsolla.com")) return h.startsWith("secure.") || h.startsWith("pay.") || payish;
    if (h.includes("roblox.com")) return /\/(upgrades|payment|purchase|transactions|premium)/.test(p);
    if (h.includes("epicgames.com")) return payish;
    return false;
  }

  // ---------- identity pools (moderate; checkout fill uses the big pools) ----------
  const FIRST = ["James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Daniel","Matthew","Anthony","Mark","Steven","Paul","Andrew","Joshua","Kevin","Brian","Timothy","Jason","Jeffrey","Ryan","Jacob","Nicholas","Eric","Jonathan","Stephen","Justin","Brandon","Benjamin","Samuel","Alexander","Patrick","Jack","Tyler","Aaron","Nathan","Henry","Peter","Noah","Ethan","Jeremy","Austin","Sean","Dylan","Jordan","Bryan","Gabriel","Logan","Mary","Patricia","Jennifer","Linda","Elizabeth","Barbara","Susan","Jessica","Sarah","Karen","Lisa","Nancy","Margaret","Ashley","Emily","Michelle","Amanda","Melissa","Stephanie","Rebecca","Laura","Amy","Angela","Anna","Nicole","Emma","Samantha","Rachel","Olivia","Ava","Sophia","Isabella","Mia","Charlotte","Amelia","Harper","Evelyn","Luna","Camila","Sofia","Scarlett","Grace","Chloe","Zoey","Lily","Eleanor","Hazel","Violet","Aurora","Mateo","Diego","Santiago","Miguel","Alejandro","Rafael","Liam","Lucas","Oliver","Elijah","Sebastian","Julian","Levi","Kai","Hiroshi","Kenji","Yuki","Wei","Arjun","Rahul","Omar","Felix","Hugo","Marco","Luca","Leon","Finn","Elias","Theo","Nora","Freya","Astrid","Ingrid","Saoirse","Priya","Ananya","Mei","Sakura","Yuna","Amara","Zara","Layla","Aisha","Fatima","Elena","Valentina","Camille","Chloe","Ines","Margaux"];
  const LAST = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Tanaka","Suzuki","Sato","Watanabe","Kim","Park","Choi","Wang","Li","Zhang","Chen","Liu","Schmidt","Muller","Fischer","Weber","Rossi","Russo","Ferrari","Silva","Santos","Oliveira","Costa","Dubois","Moreau","Laurent","Bernard","Kumar","Sharma","Patel","Singh","Novak","Kowalski","Jansen","Bakker","Larsen","Nilsson","Virtanen","Santoro","Marino","Ricci","Bruno","Greco","Conte","Moretti","Rinaldi","Ferrara","Greco","Wagner","Becker","Hoffmann","Schulz","Koch","Bauer","Richter","Klein","Wolf","Neumann"];
  const EMAIL_DOMAINS = ["gmail.com","outlook.com","yahoo.com","icloud.com","proton.me","aol.com","hotmail.com"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const randChars = (n) => { let s = ""; for (let i = 0; i < n; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]; return s; };
  function randomPassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnpqrstuvwxyz", digits = "23456789", sym = "!@#$%&*";
    let p = upper[Math.floor(Math.random() * upper.length)] + lower[Math.floor(Math.random() * lower.length)] + digits[Math.floor(Math.random() * digits.length)] + sym[Math.floor(Math.random() * sym.length)];
    const all = upper + lower + digits + sym;
    while (p.length < 14) p += all[Math.floor(Math.random() * all.length)];
    return p.split("").sort(() => Math.random() - 0.5).join("");
  }

  // ---------- field heuristics ----------
  function fieldKey(el) {
    const hay = [el.name, el.id, el.autocomplete, el.placeholder, el.getAttribute("aria-label"), el.getAttribute("data-testid")]
      .filter(Boolean).join(" ").toLowerCase();
    const type = (el.type || "").toLowerCase();
    if (type === "password") return "password";
    if (type === "email" || /(^|\b)(e-?mail|email-?address)\b/.test(hay)) return "email";
    if (el.autocomplete === "username" || /user-?name|login|handle|screen-?name/.test(hay)) return "username";
    if (el.autocomplete === "given-name" || /first-?name|fname|given/.test(hay)) return "firstName";
    if (el.autocomplete === "family-name" || /last-?name|lname|surname|family/.test(hay)) return "lastName";
    if (el.autocomplete === "name" || /(^|\b)(full-?name|your-?name|display-?name)\b/.test(hay) || /(^|\s)name(\s|$)/.test(hay)) return "name";
    if (type === "tel" || el.autocomplete === "tel" || /phone|mobile|cell/.test(hay)) return "phone";
    return null;
  }
  function isFillable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.value && el.value.trim()) return false; // never overwrite
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 10) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  }
  function setNativeValue(el, value) {
    try {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(el, value); else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (_e) {}
  }

  async function runFill() {
    let settings = {};
    try {
      const s = await chrome.storage.local.get(["settings"]);
      settings = (s && s.settings) || {};
    } catch (_e) { return; }
    const ff = settings.formFilling || {};
    if (ff.enabled === false) return;
    if (isCheckoutPage()) return;
    if (document.getElementById("semex-overlay")) return; // overlay flow owns this page

    const inputs = Array.from(document.querySelectorAll("input, textarea"));
    const targets = [];
    for (const el of inputs) {
      const t = (el.type || "").toLowerCase();
      if (["hidden", "submit", "button", "checkbox", "radio", "file", "image", "range", "color", "date", "number", "search"].includes(t)) continue;
      const key = fieldKey(el);
      if (key && isFillable(el)) targets.push({ el, key });
    }
    if (!targets.length) return;
    // v4.0: never fire on a LONE field — a single email/username input is a
    // newsletter box or login field (e.g. Namecheap's email box was filled on
    // every page load). Only fill when the page shows a real identity form:
    // at least 2 distinct field types (email+password, name+email, etc).
    if (new Set(targets.map(t => t.key)).size < 2) return;

    // One identity per page so all fields agree with each other.
    // v4.0: millions of unique identities — 149 firsts × 27 middle-initial
    // variants × 108 lasts × optional hyphenated second surname ≈ 45M+ combos.
    // Generation is fully synchronous: filling can never run before the
    // identity exists (the fill "waits" for the name by construction).
    let firstName = "SEMEX", lastName = "Automation";
    if (ff.randomName) {
      firstName = pick(FIRST);
      lastName = pick(LAST);
      if (Math.random() < 0.35) {            // hyphenated double surname
        let s = pick(LAST);
        if (s === lastName) s = pick(LAST);
        lastName += "-" + s;
      }
      if (Math.random() < 0.4)               // middle initial
        firstName += " " + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + ".";
    } else if (ff.customName && ff.customName.trim()) {
      const parts = ff.customName.trim().split(/\s+/);
      firstName = parts[0] || "SEMEX";
      lastName = parts.slice(1).join(" ") || "Automation";
    }
    const name = (firstName + " " + lastName).trim();
    let email = "support@semex.pro";
    if (ff.randomEmail) {
      const base = firstName !== "SEMEX" ? name.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, ".") : randChars(8);
      email = base + randChars(3) + "@" + pick(EMAIL_DOMAINS);
    } else if (ff.customEmail && ff.customEmail.includes("@")) email = ff.customEmail;
    const password = randomPassword();
    const phone = "+1" + (200 + Math.floor(Math.random() * 700)) + String(1000000 + Math.floor(Math.random() * 9000000));

    const values = { email, username: email.split("@")[0], firstName, lastName, name, password, phone };
    let filled = 0;
    const filledKeys = new Set();
    for (const { el, key } of targets) {
      // One value per logical field per page (password confirmation gets the
      // SAME password so signup forms validate).
      if (key !== "password" && filledKeys.has(key)) continue;
      setNativeValue(el, values[key]);
      filledKeys.add(key);
      filled++;
    }
    if (filled > 0) {
      try { console.log("[SEMEX] identity autofill:", filled, "field(s)"); } catch (_e) {}
    }
  }

  // Initial pass + two retries for SPA/late-rendered forms.
  runFill();
  setTimeout(runFill, 1000);
  setTimeout(runFill, 3000);
})();
