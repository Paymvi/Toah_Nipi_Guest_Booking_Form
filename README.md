# Toah Nipi Guest Booking Form

A one-page React + Vite form where a retreat group sends a booking request to Toah Nipi staff.

## Run it

```sh
npm install
npm run dev     # local dev server
npm test        # checks the validation and payload logic (src/formLogic.test.js)
npm run build   # production build in dist/
```

## Configuration

Set `VITE_GUEST_INQUIRY_ENDPOINT` (for example in `.env.local`) to the URL that receives the form as a JSON `POST`.
Without it, the form shows an error instead of sending.

## Light and Night themes

Same system as the booking software (see its `docs/THEMING.md`). Light is the default. Night is a choice saved in the browser under `toahNipiTheme`, set with the toggle in the form header. There is no automatic or system option.

- `index.html` sets `data-theme` on `<html>` before the page draws, so a saved Night choice never flashes Light.
- `src/theme.css` defines the `--n-*` Night tokens, only for `[data-theme="night"]` and only on screen, so printing is always Light.
- Write every color as `var(--n-token, lightValue)`, e.g. `color: var(--n-text-2, #697088)`. Solid purple fills with white text stay plain colors in both themes.
- `npm test` fails if a stylesheet uses a token that `theme.css` doesn't define.

## What the server must do

`VITE_` values are built into the public JavaScript, so anyone can find the endpoint and POST to it directly, skipping this form.
The browser checks are only for the guest's convenience. The server that receives the form must:

- Run the same checks as `validateForm` in `src/formLogic.js` (required fields, email format, whole-number counts, dates in order, stay of at most 60 days, activity dates inside the stay).
- Reject requests that include a non-empty `website` field (the hidden honeypot).
- Rate-limit requests per IP address.
- Answer within 15 seconds; the form gives up after that and shows an error.
