---
name: SEMEX setFormValue InputEvent fix
description: Why generic Event('input') breaks React-controlled card fields and how InputEvent fixes it
---

# setFormValue — InputEvent vs generic Event

## The rule
`setFormValue` must dispatch `InputEvent` (not generic `Event`) for all `input` events.

**Why:** Generic `Event('input')` fires React's synthetic `onChange`, but carries no `inputType` or `data` property. Stripe's habanero card number field has a per-character reformatter that checks `inputType`. When it receives an event with no `inputType`, it treats the programmatic input as unrecognised, runs its formatter with no character data, and **resets the field to empty during React reconciliation**. The native setter had set the DOM value (so post-fill validation sees a non-empty `.value` and passes — ok:true is sent), but React re-renders with the empty state and the payment attempt fires with a blank card number. Stripe's client-side validation then blocks form submission, and the overlay hangs on "Waiting response..." until timeout.

Expiry and CVC survived because their handlers are simpler (no Luhn reformatter), so they accepted the generic event.

## Symptom pattern
- Overlay shows "Waiting response..." with ATTEMPTS: 1
- Email, expiry, CVC visually filled in Stripe's UI
- Card number field shows placeholder ("Card number") — NOT filled
- CHARGED/DEAD counters stay at 0 (payment never actually submitted)
- URL: checkout.stripe.com/g/pay/ or any Stripe habanero checkout

## How to apply
In `setFormValue` (content/content.js, `setFormValue` function):
- Clear phase: `new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" })`
- Fill phase: `new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertFromPaste", data: String(value) })`
- Final echo: same as fill phase

Always wrap in try/catch with fallback to generic `Event("input")` for non-InputEvent environments.

`insertFromPaste` is the correct `inputType` because it signals a full-value clipboard paste — Stripe's handler validates and formats the pasted number into its React state, which survives reconciliation.
