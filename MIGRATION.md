# Porting v1 into v2

**v1** = `../inssapp` — the Next.js website. Server components, NextAuth cookies;
development only, never deployed.
**v2** = this app — Expo / React Native, iOS + Android + web from one codebase.
**API** = `../inss-app-backend` — the Hono service that serves `/api/mobile/*`.
v2's only backend; v1 carries no mobile routes any more.

The plan is to move v1 over deliberately, one vertical slice at a time, not to
reimplement everything and hope it lines up.

---

## Where v2 stands

- **Auth done.** Same accounts and password check as v1 (`/api/mobile/auth/*` on
  the API hands back a bearer token; the session lives in the keychain on
  device). Password and magic-link sign-in both work.
- **Own chrome.** Metro top bar with a menu button; one nav drawer mounted at
  the shell, so it opens from any signed-in screen. No tab row, no Expo starter
  tabs.
- **Design tokens.** `src/constants/metro.ts` holds the palette, radius set, type
  scale, spacing and the tile field maths from METRO.md.
- **Design kit.** `src/components/metro` — `MetroScreen`, `Tile`, `MetroButton`,
  `MetroRule`, `MetroLabel`, `MetroList`/`MetroListRow`/`MetroBadge`,
  `MetroField`/`MetroTextArea`, `MetroSelect`, `MetroCheckbox`/`MetroToggle`/
  `MetroRadioGroup`, `MetroFileField`, `MetroSheet`/`MetroDialog`/`MetroPanel`,
  `MetroBanner`/`MetroEmpty`/`MetroError`/`MetroLoading`, `MetroPivot`,
  `MetroSwatches`, `MetroStat`/`MetroStatRow`.
- **Page width.** `MetroScreen` defaults to a centred column; dashboards, KPI
  and list screens pass `width="wide"` to use the whole window.
- **Accent colour.** The user's accent is a preference (`src/lib/preferences`),
  chosen on the account screen and persisted per device; every screen follows it.
- **Plumbing.** `src/lib/api/client.ts` (bearer token, normalized `ApiError`,
  401 signs out), `src/lib/auth/roles.ts` (v1's access models).
- **Sections.** `src/constants/sections.ts` drives the nav drawer: Home, KPI,
  Kiosk Connect (administrators, developers, managers and supervisors),
  Portfolio and Files (investors only), Admin (administrators only) and Account.
  A nested route marks only its closest section as current, so `/investor/files`
  lights Files, not Portfolio. Role-gated sections get appended as they land.
- **Kiosk Connect.** `(app)/kioskconnect` is the operator console (live device
  list, call stage, mic/camera, screen share, photo tool) and
  `/kioskconnect/kiosk/[rtcDeviceId]` is the kiosk player, public and outside the
  app shell at v1's exact address so a programmed screen needs no change. Both
  are web builds only; see Phase 6.
- **Admin → Users.** `(app)/admin` is the user console: list with search, role
  filter and last-name sort, create user, detail form with roles, photo upload
  and deactivate/reactivate. Its API lives in the backend at
  `/api/mobile/admin/users`. The admin sections share one tab row (`AdminPivot`),
  as v1 shares its side nav.
- **Admin → Integrations (QuickBooks).** `(app)/admin/integrations` shows the one
  integration v1 has: whether QuickBooks is linked, the company read live from
  Intuit, both token expiries and what to do when either is running out.
  Connecting is a browser errand — the app asks the API for Intuit's authorize
  URL, opens it in a tab and re-reads when the window comes back; the callback
  lands on v1's `/admin/integration/intuit/oauth`, so the redirect URI registered
  with Intuit is unchanged. Tokens sit in `global.integrations` sealed exactly as
  v1 sealed them, so the existing connection was picked up without re-authorising,
  and `src/quickbooks/` exposes `companyInfo`, `query` and `report` for the
  screens that follow.
- **KPI (read-only).** `(app)/kpi` is the facility board, for administrators,
  managers and supervisors. The list is v1's table: all 25 metric columns, in
  v1's order and with v1's short headers, scrolling both ways inside a framed
  area with the header row and the facility column held still. Tapping a row
  opens a detail screen with the same numbers grouped for reading. Header clicks
  sort by the raw value (v1's toggle), and the frame keeps a footer row of v1's
  sums and non-zero averages under the table. Saved lists work end to end:
  `loglady.savedKpiLists`, the same documents v1's admin panel manages, with the
  board filtered to a list and a sheet to save the current set. The API returns
  raw numbers from `loglady.locations`; the app owns all formatting. Nothing is
  left of v1's board — it has no print or export.
- **Investor portal.** `(app)/investor` is v1's `/investor`: the Portfolio
  Snapshot tab (equity allocation, the two portfolio totals, the confidentiality
  note) and the Portfolio Report tab (every property beside this investor's
  portfolio and the organization's, in v1's sections and arithmetic). The
  allocation chart opens as v1's pie — v1's slice colours, outboard labels with
  leader lines, tappable slices — and a Pie/Bar switch beside the heading swaps
  in the flat bar; the choice is remembered per device. Selecting
  a property opens the detail v1 shows in its big modal — the same three-column
  comparison, property notes, property details, investment allocation and the
  report links. `(app)/investor/files` lists the documents v1 shares,
  grouped by folder; images preview inline and everything else opens through a
  short-lived read SAS. The API assembles all of it from `loglady` in
  `src/investor.ts`, scoped to the caller's own investor record.
  *Reports:* Profit & Loss and Budget Vs Actuals print from the API's own
  QuickBooks client, and export to PDF through the one PDF endpoint. Management
  Summary is deferred — its data came from SiteLink, which is gone; see Phase 4
  below for the Cubby note.

---

## What v1 does

### Screens

| Area | Route | Who | What it is |
|---|---|---|---|
| Hub | `/` | any signed-in | Role-filtered tiles to the areas below. An investor holding *only* the investor role is redirected straight to `/investor`. |
| KPI | `/kpi` | administrator, manager, supervisor | Per-facility table, ~28 metrics per location (OER, storage/parking/unit occupancy, move-ins/outs, delinquency buckets, vacant-unrentable, concessions, waived rent, reservations and conversions, autopay and insured occupancy, income/expense/NOI vs budget, last dividend). Sum + average footer row, sort, saved lists, print/export. |
| Investor portal | `/investor` | investor | Portfolio Snapshot and Portfolio Report tabs for the signed-in investor. |
| Investor files | `/investor/files` | investor | Documents grouped by folder, opened through Azure SAS links. |
| Investor preview | `/admin/investors/[userId]/{view,files,report}` | administrator | v1's "Investor View": that investor's portfolio, documents and reports, read-only. |
| Admin | `/admin` | administrator | Side-nav console: Users, KPI (saved lists), Investor Portal (investors, locations, documents, equity, dividends), Kiosk Connect (devices, media, schedules), QR codes, Integrations (QuickBooks/Intuit OAuth). |
| Kiosk Connect | `/kioskconnect` | manager+ | WebRTC operator console on web, iOS and Android: device list, connect, mic/camera/screen share, photo tool (browser only), upload to Google Drive. |
| Kiosk device | `/kioskconnect/kiosk/[rtcDeviceId]` | device | The other end of that call, as a browser page or as this app on a phone or tablet. |
| QR | `/qr/[id]`, `/qr/[id]/kiosk` | public | Resolves an active QR record to its target URL. |
| Sign in | `/auth/signin` | public | Password + Postmark magic link. |
| Crons | `/cron/updateData/{quickbooks,cubby,cubbyprocess,users}` | Vercel cron | Keeps the data warehouses fresh. |

### Roles and gating

`administrator`, `developer`, `manager`, `supervisor`, `investor`. v1 gates with an
`AppShell` "model" prop (`all`, `development`, `administrator`, `manager`,
`supervisor`, `investor`) where each level includes the more privileged roles.
The nav bar shows Admin (administrator), KPI + Kiosk Connect (manager and up),
Portfolio + Files (investor). Note: the nav's `Dev` item points at `/dev`, which
has no page in v1 — dead link.

### Data and integrations

- Mongo **`global`**: `users`, `integrations`, `investors`, `files`, `dividends`,
  `ipLocationNotes`, `qr`, `mobileAuthTokens`.
- Mongo **`loglady`**: `locations` (used by both KPI and location lookups) plus
  the ingested warehouse collections — `cubbyRentRoll`, `cubbyPricingGroups`,
  `cubbyAgedReceivables`, `accounts`, `quickbooks*` (budget, P&L, departments,
  loan balances, dividends, entities invested).
- **BigQuery** via `lib/cubby` for the Cubby side.
- **Intuit QuickBooks** OAuth (`lib/intuit`), refreshed by cron.
- **Azure Blob** SAS URLs for documents; **Google Drive** for kiosk photos.
- **Twilio** ICE servers + **socket.io** signalling for Kiosk Connect.

### v1 UI kit (`ui/`, ~50 components)

`AppShell`, `NavBarV2`, `TopBarV2`, `TopBarContainer`, `PageStandard`,
`PageStandardTabs`, `PageStandardList`, `PageStandardSideNav`,
`PageStandardSideContent`, `PageStandardRing`, `PageHeader`, `Crumbs`,
`NavigationTabs`, `NavigationHorizontal`, `Drawer`, `ModalStandard`,
`PopoverStandard`, `Notification`, `ResultDialog`, `LoadingFullScreen`,
`Spinner`, `Button`, `ButtonDiv`, `Card`, `CardList`, `MiniCard`, `MasterList`,
`ListContainer`, `ListBuilder`, `StackedList`, `SectionBlock`, `StatsV2`,
`BadgeV2`, `VerticalProgress`, `Expandable`, `ZeroResults`, `EmptyShell`,
`InputText`, `InputArea`, `InputCombobox`, `InputRadio`, `InputToggle`,
`InputUpload`, `FormToggle`, `Checkbox`, `CheckboxGroup`, `LinkWithCopyV2`,
`TextCopy`, `PreviewFileV2`, `NotAuthorized`, `ContainerStandard`.

---

## The architectural gap

v1 reads Mongo and BigQuery **inside server components**. v2 is a client app: it
has no server of its own and no cookie session. So:

1. Every v2 screen needs an HTTP endpoint, and they live in
   `../inss-app-backend` under `/api/mobile/<area>/...`: Hono routes that read
   Mongo (and, later, BigQuery) directly and authorize with a bearer token.
2. One endpoint per screen need, not one per collection. Shape responses for the
   screen (computed totals, formatted values) rather than dumping raw Mongo docs.
3. v1's `lib/*` functions are the reference implementation, not an import: the
   backend has its own copy of the rules it needs (users, login, magic links,
   Azure). Writes (create user, save KPI list, QR edits) each need a
   POST/PATCH route — Server Actions are unusable from v2.
4. Document viewing keeps using Azure SAS links — no proxying of files.
5. Kiosk Connect is the exception: WebRTC + socket.io is not request/response.
   Its signaling socket now lives in the backend, on the same host as the API
   (`rtcSignaling.ts`), and v2 reaches it through `/api/mobile/rtc/*` for a token
   and ICE servers. Both screens are built — see Phase 6.

---

## Phases

### Phase 1 — design system and plumbing (done)
- Metro list rows and a `MetroList` (v1's `MasterList`/`ListContainer`/`StackedList`).
- Form controls: checkbox, toggle, radio, combobox, textarea, upload.
- Sheet/modal, notification banner, empty state, loading and error states, pull-to-refresh.
- A typed API client that attaches the bearer token, normalizes errors and
  handles 401 by dropping the session (extends `src/lib/auth/api.ts`).
- Role helper (`hasRole`/`atLeast`) mirroring v1's model hierarchy, so sections
  can be gated in `sections.ts`.
- Exit: Home + Account use the same list/form primitives every later screen will.

What is left for later phases: `MetroStat` and `MetroProgress` (KPI), a desktop
side rail (`PageStandardSideNav`), breadcrumbs for detail screens, and the
platform picker behind `MetroFileField` (`expo-document-picker` for documents,
`expo-image-picker` for kiosk photos) — the field takes `onPick`, so no screen
has to care which one it is.

### Phase 2 — Locations (first vertical slice)
- API: `GET /api/mobile/locations` and `GET /api/mobile/locations/:id`,
  porting `getLocations`/`getLocation` from v1's `lib/*`, gated by role.
- v2: `(app)/locations/index.tsx` + `(app)/locations/[id].tsx`, a `Locations`
  section, tile on the hub.
- Exit: a manager signs in on a phone *and* on desktop web, sees their locations,
  opens one; a role without access sees a clean refusal.

### Phase 3 — KPI (done)
- **Done:** the board itself — v1's 25 metric columns with a frozen header row,
  frozen facility column and a pinned totals row, two scroll directions inside one
  frame, header-click sorting on the raw values, search, saved lists (create,
  switch, delete, stored in `loglady.savedKpiLists`), and a detail screen grouping
  the same metrics into Occupancy, Movement, Delinquency, Revenue, Leads,
  Autopay/insurance and Budget with `MetroStat` headline numbers.
- v1's board has no print or export, so there is nothing to port there. Writes
  for lists go through `/api/mobile/kpi/lists`.
- Exit: a supervisor can answer "how is this store doing this month" in two taps
  — met.

### Phase 4 — Investor portal (snapshot, report, files, reports done)
- Snapshot, report and files for the investor role, including SAS-backed previews.
- **Reports, done.** The two buttons on a property (Profit And Loss, Budget Vs
  Actuals) open `/investor/report?locationId=…&kind=…`: date
  fields, `Run report`, and a PDF button, in v1's order. The screen draws the
  report from the API's tables, so it reads on a phone where v1's injected HTML
  did not, and the columns scroll sideways. Dates open on v1's defaults and obey
  v1's limits.
- **PDF, done.** One backend endpoint (`POST /api/mobile/pdf`) takes markup and
  answers with a PDF, printed by Puppeteer. The app posts the report's printable
  HTML and either downloads it (web) or hands it to the share sheet (native).
  v1 posted the same markup to a third-party PDF service, which is no longer
  needed.
- Management Summary is deliberately not ported: v1's version rendered only its
  heading, and the data behind it came from SiteLink, which is gone. The company
  now uses the Cubby API for the same figures. When that integration is wired up,
  the summary comes back as a third report kind (the reports screen already takes
  its buttons from `REPORT_MENU`, so it is one entry plus a builder).
- Exit: an investor-only account lands on their portfolio (matching v1's redirect)
  and can open a document and print a report.

### Phase 5 — Admin (done)
- **Users, end to end.** Admin appears in the nav for administrators only;
  `/admin` is the user list (search, role filter, last-name sort, create) and
  `/admin/user/[id]` is the detail form (profile, roles, photo,
  deactivate/reactivate).
- Backing routes in the backend: `GET|POST /api/mobile/admin/users`,
  `GET|PATCH /api/mobile/admin/users/:userId` and
  `POST|PATCH /api/mobile/admin/users/:userId/photo`, administrator-only bearer
  auth, using the backend's own `users` module (ported from v1's `lib/users`).
- **Photos.** The API hands out permission for one blob and the app does the
  upload itself, like the website does. `POST …/:userId/photo` checks the caller
  and the declared type, then answers `{ uploadUrl, blobUrl }`: a write-only SAS
  scoped to a single blob name (`master-open/userPhotos/<random>.png|jpg|webp`)
  valid for ten minutes. The app `PUT`s the bytes straight to Azure, then
  `PATCH`es `blobName` back; the backend reads the blob's real size and content
  type (PNG, JPEG or WebP, 8 MB max), deletes it if it fails either, and only
  then saves `photoUrl`. Nothing is written to the document until the bytes are
  there, so a cancelled or failed upload leaves no half-made user. The account
  key never leaves the server, and no Azure SDK ships in the app — the native
  path uses `expo-file-system/legacy`'s `uploadAsync`, the web path a `fetch`
  `PUT`. Photos land in the same `master-open/userPhotos/` folder the website
  uses, so both read the same set, and replacing one does not delete the old
  blob (the website does not either).
- Two guards v1 does not have: an administrator cannot deactivate their own
  account or drop their own administrator role.
- **Integrations, done.** `(app)/admin/integrations` reads the QuickBooks
  connection live and connects or renews it through the browser. The API holds
  the tokens, refreshes them, and exposes `report()` and `query()` for the
  QuickBooks-backed screens.
- **KPI, done.** `/admin/kpi` keeps v1's two tabs. Location Settings is the
  board's opt-in: a switch for `kpiActive`, the year's OER score, and a search
  over every property. Saved Lists lists the shared subsets and can remove one.
- **Investor Portal, done.** `/admin/investors` is v1's five tabs. Investors
  associates QuickBooks equity accounts (with a holdings preview), Locations
  edits status, the QuickBooks link, the manual inputs and the notes, Documents
  uploads through a write-only SAS and opens through a read SAS, Equity is the
  whole book with a total, Dividends stays the placeholder v1 always had.
- **Investor preview, done.** v1's "Investor View" tab is back: an
  administrator's investor panel has **View their portal**, which opens
  `/admin/investors/[userId]/view` — that investor's portfolio, files and
  property reports, with a strip naming whose portal it is. The screens are the
  portal's own with `actingAs`, so a preview cannot drift from what the investor
  sees, and the API builds both from the same functions behind
  `/api/mobile/admin/investors/:userId/…` (portfolio, files, and the same
  property reports). It
  sits under `/admin` because the portal's routes are behind the investor role,
  which an administrator need not have.
- **QR codes, done.** `/admin/qr` lists active codes (deactivated ones behind a
  switch), draws the code from the API's own SVG, hands over the public and kiosk
  addresses, retargets the destination, and deactivates after a confirm. Each
  code also has a **Notification tags** section: pick the tags to tell, and the
  message and loud-or-quiet choice appear with them. There is no on/off toggle —
  choosing tags is what makes a code notify, and clearing them is what stops it,
  so a code can never claim to alert while pointing at nobody. Codes set up before
  tags existed keep their named people, shown separately and removable once the
  tags cover them. Scans of a notifying code are delivered to every
  registered device of the tagged accounts — browsers by web push, phones through
  Notification Hubs — and the log row says what each channel did. A **loud** code
  also rings: the alert arrives over the Kiosk Connect socket and takes over the
  screen with Answer and Ignore, ringing with a synthesised tone, so it behaves
  like a call rather than a banner. Quiet codes stay notification-only.
- **Notifications, done.** `/admin/notifications` owns the tag registry (create,
  rename, describe, turn off, delete only when unused) and a composer that sends
  to any set of tags, with the audience count and the send history underneath.
  Users → a person gains a Notification tags block; Account shows the signed-in
  person their own tags and the two alert channels.
- **The public QR pages are this app's**, at v1's paths: `/qr/[id]` asks the API
  where the code points and sends the visitor on, `/qr/[id]/kiosk` draws it large
  on white. They are why a printed sign never has to be reprinted for a backend
  change — the code encodes the app's hostname (`QR_PUBLIC_BASE_URL`), and the API
  is only asked two questions behind the scenes. Both render without a session —
  the root navigator skips the session check on those paths.
- **Kiosk Connect admin, done.** `/admin/kiosk` has v1's Devices and Media
  Library tabs: register a device, copy its `kioskUrl`, edit the profile, pick the
  on-hold image and call tone, build the playlist from the library, deactivate;
  upload images, video and audio (up to 200 MB, straight to Azure) and delete.
  The player itself is Phase 6, below.
- The admin tab row carries all six sections instead of v1's side nav, so every
  panel is one tap from every other, on any screen size.
- Exit: user management works end to end from a phone — met for every section;
  what remains in this phase is the Management Summary, waiting on Cubby.

### Phase 6 — Kiosk Connect (done)
- **Transport, settled: socket.io + Twilio ICE, moved into the backend.** The old
  `../cooperrtc` process is folded in (`inss-app-backend/src/rtcSignaling.ts`):
  same events and payloads, same relay-by-socket-id handshake, presence written
  to the same `rtcDevices` rows, tokens minted and verified with v1's
  `jwtSecret`. `/api/mobile/rtc/token` gives a signed-in operator a socket token
  plus TURN credentials; `/api/mobile/rtc/kiosk/:deviceId` gives a kiosk its
  token, playlist and the same credentials, so no page has to mint its own.
- **Console, done, on every platform.** `/kioskconnect` is v1's screen: the device list (pushed by
  `devicesRefresh`, refreshed when a kiosk comes or goes), connect, the call
  stage with a self preview, mute/camera (sending `callOnHold` when both are
  off), screen share by replacing the outbound video track, the photo tool
  (capture the kiosk's frame, download it, or file it in Drive through the API)
  and Disconnect, which tells the kiosk to reset. The console is the offerer and
  holds ICE candidates until the answer lands, so a fast answer cannot drop one.
- **Player, done.** `/kioskconnect/kiosk/[rtcDeviceId]` is public, has no
  session, no nav and no page column, and keeps v1's exact path: existing
  devices are untouched, and `KIOSK_PUBLIC_BASE_URL` points `kioskUrl` at this
  build. Idle it plays the device's playlist (priority order; images hold for
  their duration, video/audio advance on end). On `initializeConnection` it
  opens the camera, adds the tracks and answers the offer; the kiosk's own
  camera stays in the corner, the operator takes the full picture, `selfFocus` /
  `partnerFocus` / `callOnHold` swap the views, the on-hold image and call tone
  come from the device's media, and `resetYourself` starts a fresh session and
  goes back to the playlist (v1 reloaded the page; a phone cannot reload its
  bundle, so a new session does the same job on both).
  A kiosk outlives its four-day token: a refused handshake fetches a fresh one
  and reconnects, and a failed session load retries every fifteen seconds.
- **Calls on iOS and Android.** WebRTC comes from `react-native-webrtc`, reached
  only through `src/lib/rtc/webrtc.ts` (`webrtc.web.ts` for the browser); the
  camera, screen share, stream rendering and playlist live behind the same split
  (`browser.ts` / `browser.web.ts`, `stream-view.tsx` / `.web.tsx`, the latter
  using expo-video and expo-audio where a browser has `<video>`). One console
  and one player run on every platform: an operator can call a kiosk from a
  phone, and a phone or tablet can be the kiosk, at its usual address
  (`inssappv2://kioskconnect/kiosk/<rtcDeviceId>` for the deep link).
- **Kiosk mode, app only.** Account → Kiosk mode takes a kiosk device id typed
  by hand, saves it with expo-secure-store, and from then on every launch is that
  player: no sign-in, no nav, no other screen. Staff leave it with a three-second
  press in the player's top-left corner, which confirms and clears the stored id.
  The web build has no kiosk mode (`src/lib/kiosk/storage.web.ts` reports it
  unsupported), so a browser always starts in the normal app.
- **Desktop.** Windows, Linux and macOS run the web build in a browser — the only
  desktop target Expo supports. A native desktop build is not available on this
  stack: react-native-windows 0.85 and react-native-macos 0.83 require React
  Native 0.85 / 0.83 while this app is on 0.88 (Expo SDK 58), and React Native
  has no Linux target at all.
- **Two limits, on purpose.** The photo tool draws a browser stream into a
  canvas and native WebRTC exposes no frame, so the app hides that button rather
  than save a black image. iOS screen sharing needs a broadcast extension
  bundled with the app; Android captures the display, and on iOS the console
  says screen sharing is in the browser build. Neither touches calls.
- **Verified** with two real Chromium pages (fake camera/mic, development
  magic-link session): the kiosk went online, the console listed it, a call ran
  video both ways, the photo tool captured a frame, Disconnect reset the kiosk to
  its playlist, and the API refused a photo with no session, a non-PNG body and
  an unknown device. The Drive save itself was not exercised — it writes to the
  real shared drive and needs `googleClientEmail`/`googlePrivateKey` on the host.
  `npx tsc --noEmit` is clean and the iOS/Android JS bundles build; the native
  camera, microphone and call have not been exercised on a device or simulator,
  and a physical kiosk and TURN across a strict network remain deployment
  checks.

---

### Phase 7 — Answering and performance (done)

v1 could tell you a sign had been scanned. This phase makes the scan an event
somebody owns, and measures how they handled it.

- **A code now has a place and a device.** Admin → QR Codes gained a location
  picker and a kiosk picker (`qr-placement.tsx`), beside the notification tags.
  The alert it raises names both — "L005 — Havana (Aurora) · Door 3" — and
  performance is grouped by property because the code knows where it is.
- **Answering goes to the kiosk, not to a menu.** The incoming-alert takeover's
  Answer opens `/kioskconnect?device=<rtcDeviceId>&alert=<id>`: the console comes
  up on the screen beside the sign with the alert in hand, and Connect dials it.
  A code with no kiosk still answers; an administrator lands on that code's
  panel.
- **On a call means unreachable, not missing.** The API tracks who is on a call
  (`call-started` / `call-ended` from the console, and a disconnect ends it).
  Their alerts are not rung and not pushed: they are held, five deep, and ring
  when the call ends. The log records `alert-held` separately from
  `alert-offered`, so "nobody answered" and "nobody was free" stay different
  problems.
- **Every response is measured.** Offers, holds, answers, ignores, calls and
  their lengths are appended to `global.activity` with the alert's code,
  property and device; answering records the latency from the offer. An
  acknowledgement is idempotent and refused for an alert that was never offered
  to that person, so a replay cannot invent a response time.
- **Admin → Performance** reads it: window picker (7/30/90 days), a headline row
  (offered, answered, answer rate, median answer, calls, talk time, held), then
  per-person rows and a per-property rollup. A person with no calls in the window
  does not appear, and the report says so rather than showing an empty table.
- **Verified** against the live database with a fake operator socket: a scan
  rang through with the property and kiosk names, `callStarted` held the next
  scan's alert with no `incomingAlert` delivered, `callEnded` rang it, the
  activity log held `alert-offered, call-started, alert-held, call-ended`, an
  acknowledgement recorded a 17.5s latency, a replay added no row and an
  invented id answered 404, and the performance rollup returned the expected
  totals per person and property. Both routes answer 401 without a session.
  `npx tsc --noEmit` is clean in both projects and the web, iOS and Android
  bundles export. The ringing takeover itself was not clicked through on a
  device — it needs a signed-in account with notification tags.

---

## Component mapping (v1 → v2)

| v1 | v2 | Status |
|---|---|---|
| `Button`, `ButtonDiv` | `MetroButton` | exists |
| `Card`, `MiniCard` | `Tile` | exists |
| `InputText`, `InputArea` | `MetroField`, `MetroTextArea` | exists |
| `InputToggle`, `FormToggle`, `Checkbox`, `InputRadio` | `MetroToggle`, `MetroCheckbox`, `MetroRadioGroup` | exists |
| `InputCombobox` | `MetroSelect` (a sheet, not a dropdown) | exists |
| `InputUpload` | `MetroFileField` (screen supplies the picker) | exists |
| `MasterList`, `ListContainer`, `StackedList`, `ListBuilder` | `MetroList`, `MetroListRow` | exists |
| `BadgeV2` | `MetroBadge` | exists |
| `StatsV2` | `MetroStat` / `MetroStatRow` | exists |
| `VerticalProgress` | `MetroProgress` | to build |
| `NavigationHorizontal`, `PageStandardTabs` | `MetroPivot` (in-page only; nav is the drawer) | exists |
| `PageStandardSideNav` | `AppShell` drawer from every screen | exists |
| `ModalStandard`, `Drawer`, `ResultDialog` | `MetroSheet`, `MetroDialog` | exists |
| `PopoverStandard` | `MetroSelect` sheet covers the picker case; menus later | partial |
| `Notification` | `MetroBanner` | exists |
| `LoadingFullScreen`, `Spinner` | `BootScreen`, `MetroLoading` | exists |
| `ZeroResults`, `EmptyShell` | `MetroEmpty`, `MetroError` | exists |
| `PreviewFileV2` | document viewer via SAS URL (platform-specific) | to build |
| `NavBarV2`, `TopBarV2`, `Crumbs` | `AppShell` top bar + drawer (+ breadcrumbs for detail screens) | partial |

---

## Open decisions

1. **Launch scope.** Which sections must be on the phone in the first build you'd
   hand to real users — Locations and KPI, or does admin/user management matter
   more early?
2. **Backend shape — decided.** A separate Hono service
   (`../inss-app-backend`) owns `/api/mobile/*`. v1 keeps only its web pages and
   NextAuth, is never deployed, and its mobile routes were deleted rather than
   duplicated so the two cannot drift.
3. **Investor role in v2.** Port it, or keep investors on the web and make v2
   staff-only?
4. **App identity.** Renamed to `inss-app-v2` / scheme `inssappv2`; v1's
   magic-link landing page points at the new scheme, so existing dev builds on a
   device need reinstalling before magic links land in the app.
5. **Offline.** Any requirement to work with no signal? It changes the data layer
   (cache + sync) and should be decided before Phase 2.

---

## Deployment note

The API ships from `../inss-app-backend`; v1 is not deployed at all. Until the
backend is hosted, the app signs in against a local one (`EXPO_PUBLIC_API_URL` in
`.env`, `http://localhost:3001`), and release builds must point that variable at
the deployed service. The API sends `access-control-allow-origin: *`, so the web
build can call it from any origin.

**The data refresh must be scheduled too.** v1's Vercel crons are gone, so
nothing writes the metrics until something calls the API's four
`/api/cron/*` endpoints (`quickbooks`, `cubby`, `cubby-process`, `roles`), each
with `Authorization: Bearer $CRON_SECRET`. They are documented in the backend's
README with v1's schedules. That is the one item that blocks turning v1 off:
without it the board and the portal keep the last numbers v1 computed, and a new
facility never appears.
