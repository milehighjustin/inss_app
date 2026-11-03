# INSS App v2

The React Native (Expo) app for INSS. It talks to the API in
[`../inss-app-backend`](../inss-app-backend), which owns the data and the auth
rules. ([`../inssapp`](../inssapp) — v1 — is the website, and never ships to
production.)

Design language: [`METRO.md`](METRO.md). Port plan: [`MIGRATION.md`](MIGRATION.md).

## Run it

```bash
npm install
npx expo start          # then i / a / w, or scan the QR code
```

The app needs the API running for anything behind sign-in:

```bash
cd ../inss-app-backend && npm run dev     # http://localhost:3001
```

`EXPO_PUBLIC_API_URL` in `.env` points at it. For a physical device use your
machine's LAN IP rather than `localhost`; release builds must set it to the
deployed backend.

Windows, Linux and macOS run the web build in a browser; there is no native
desktop target on this SDK.

## Kiosk mode

On a device that is handed to INSS, Account → Kiosk mode takes a kiosk device ID
(from Admin → Kiosk Connect). The app then opens straight into that kiosk on
every launch — no sign-in, no nav. To leave kiosk mode, press and hold the
top-left corner of the kiosk screen for three seconds. Kiosk mode is for the
installed apps only; the web build never offers it.

Native builds need a development build (`npx expo run:ios` / `run:android` or
`eas build --profile development`) because the app uses `expo-secure-store`, the
`inssappv2://` deep-link scheme and `react-native-webrtc` for Kiosk Connect
calls; Expo Go cannot run those.

## Installable web app

The web build is a PWA: Chrome, Edge and Samsung Internet offer an install
prompt, Safari installs from its own menu (iOS: Share → Add to Home Screen,
macOS: File → Add to Dock), and the installed window opens without browser
chrome.

| Piece | Where |
| --- | --- |
| Manifest — name, colours, start URL, icons | `public/manifest.webmanifest` |
| Icons — 192, 512, maskable 512, apple-touch 180, favicon 16/32 | `public/` |
| Offline fallback page | `public/offline.html` |
| Service worker — app shell cache, push, notification clicks | `public/sw.js` |
| Manifest, theme colour and Apple meta tags | `public/index.html` (the SPA shell template) |
| Registration on every launch | `src/lib/pwa/register.web.ts` |
| The install block on Account | `src/lib/pwa/install.web.ts` |

Two things are easy to get wrong and are deliberate:

- **The head lives in `public/index.html`, not `+html.tsx`.** With
  `web.output: "single"` Expo builds the SPA shell from a template in `public/`
  (`+html.tsx` is only read for static rendering), so that file is where the
  manifest link and Apple tags belong. It still needs `%LANG_ISO_CODE%`, the
  `#root` element and a `</head>`/`</body>` for Expo to append its CSS and script.
- **The worker is registered for everyone**, not only when someone turns on
desktop alerts. Without it a browser will not offer to install the app at all.
  It answers navigations — never `/api/*` — keeping the newest copy of the app
  document, and it caches the build's content-hashed files (`entry-<hash>.js`)
  cache-first, so an installed window opens with no network. Development paths
  without a hash are left to the network: caching those would fight hot reload.
  Data still needs a connection; the offline page (or the shell's own empty
  states) says so.
- **The maskable icon is its own file.** Launchers crop maskable icons to their
  own shape, so it is the mark on the accent field at ~55% width — inside the
  safe circle — rather than a copy of `icon.png`, whose mark reaches 90% of the
  radius and would lose its tips.

Regenerating the icons after the artwork changes:

```bash
sips -z 192 192 assets/images/icon.png --out public/icon-192.png
sips -z 512 512 assets/images/icon.png --out public/icon-512.png
sips -z 180 180 assets/images/icon.png --out public/apple-touch-icon.png
sips -z 32 32 assets/images/icon.png --out public/favicon-32.png
sips -z 16 16 assets/images/icon.png --out public/favicon-16.png
```

The maskable 512 is the mark from `android-icon-monochrome.png` tinted white on
`#208AEF`; it was rendered rather than resized, so redo it the same way by hand
if the mark changes.

## Where things live

```
src/app/            routes (expo-router, file based)
  (app)/            signed-in area: hub, account, and future sections
  sign-in.tsx       password + magic-link sign-in
  auth/callback.tsx deep-link landing for the magic link
src/components/
  metro/            the design kit (screen, list, fields, controls, overlays,
                    banner/empty/error, pivot, swatches, tile) — re-exported by
                    index.tsx
  admin/            the admin console's screens (users list, user detail, create)
  kpi/              the KPI board (v1's table with frozen header/name column,
                    facility detail)
  investor/         portfolio (snapshot, report, property detail, files) and the
                    QuickBooks report screen
  rtc/              Kiosk Connect: operator console, kiosk player, stream view
                    and playlist playback (native and web files)
  kiosk/            kiosk mode shell and its staff exit gesture
  nav/              the app's own top bar + nav drawer
src/constants/      metro tokens (palette, radius, type, spacing), app name, sections
src/lib/api/        typed API client: bearer token, ApiError, 401 signs out
src/lib/auth/       token storage, auth endpoints, role gating, session provider
src/lib/admin/      admin users API client, photo upload, list search/sort/filter
src/lib/kpi/        KPI API client, number/percent/currency formatting
src/lib/media/      image picker + direct-to-Azure upload (native and web paths)
src/lib/rtc/       call session API, signaling socket, and the WebRTC/camera
                    layer split per platform (`webrtc.ts`, `browser.ts`)
src/lib/kiosk/     kiosk mode: stored device ID and the provider the root
                    layout reads before the first screen paints
src/lib/reports.ts  investor report API client and its labels
src/lib/pdf.ts      PDF save/share (native) and download (web) from the API's one
                    print endpoint
src/lib/preferences/ user accent colour (presets, persistence)
src/lib/pwa/        installability: worker registration and the install hook
                    (native no-ops, `.web.ts` files for the browser)
public/             web-only files served as-is: the SPA shell template
                    (index.html), manifest, PWA icons, service worker, offline
                    page, notification icon and badge
```

## Checks

```bash
npx tsc --noEmit
```
