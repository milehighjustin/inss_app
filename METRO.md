# Metro Design Language

This document contains the design instructions for the Metro solution. It is intended to be shared with other AIs and developers to ensure consistency across sites built with the Metro design system.

## Philosophy

Metro is a design language that originated from Windows Phone. Its core principles still hold, with one deliberate revision:

- **Flat colour fields** instead of gradients. Colour is still a plane, not a picture.
- **Type-driven hierarchy** — words carry the meaning, not boxes.
- **Square tiles, soft surfaces.** The tile grid keeps its hard station-wall edge; everything laid on top of it — cards, lists, inputs, buttons, sheets — has a small radius. Pure Metro read as boxy and unfinished next to a modern OS; the grid is what people recognise, not the sharpness of a text field.
- **One soft elevation**, and only for things that float over the page.
- **Large, readable type** — hierarchy is carried by font sizes and weights.
- **One accent colour** the user owns.

The intent is the wayfinding of a transit system: strong grid, clear signs, quiet surfaces between them. Not a Windows Phone screenshot.

## Corner Radii

The system uses five radius values, all from `Radius`:

| Radius Name | Value | Usage |
|-------------|-------|-------|
| `tile` | `0` | Tiles only — the grid stays hard edged |
| `card` | `14` | Cards, lists, banners, drop zones, stat blocks |
| `control` | `10` | Interactive elements: buttons, inputs, selects, checkboxes, drawer rows |
| `pill` | `999` | Inline pills and markers: list badges, drawer markers, sheet grabber |
| `round` | `999` | Circles: status dots, avatars, toggle knobs, swatch dots |

**Never hardcode a radius.** A value that is not in this table is a bug: either it is a `card`, a `control`, or it is a circle. Sheets, dialogs and the drawer are `Radius.card` plus a few points — they are the one place a larger corner is right, because they are panels lifted above the page.

## Elevation

There are exactly two shadows, in `Shadow`:

| Token | Usage |
|-------|-------|
| `Shadow.bar` | The top bar, which content scrolls under |
| `Shadow.overlay` | Sheets, panels, dialogs and the nav drawer |

A card on a page does **not** get a shadow. It is a colour difference and, where it needs one, a hairline. If everything floats, nothing does.

## Tile Corners

- **All tiles are square-cornered** — no rounding on titles, subtitles, or the tile background itself
- Tiles are flat colour fields with square edges (`Radius.tile`, which is `0`)
- The `tile` style in `src/components/metro/tile.tsx` uses `borderRadius: Radius.tile`. Do not point it at `Radius.card` — that token is no longer square
- Tile text fits within the square; long text wraps and shrinks as needed (see `fitTileText` function)
- The tiles are the contrast that makes the rest of the app read as modern: if a tile ever acquires a radius, the whole idea collapses into "everything is a rounded card"

## Mobile View (Windows Phone style)

- On mobile, tiles are the "normal square size" — like Windows Phone tiles
- Tiles are NOT the small "glyph-only" tiles — every tile must be able to hold a label
- The tile field adapts: on narrow widths, tiles stretch to fill (2 columns max)
- Text wraps within the tile; font size adjusts via `fitTileText` to fit
- Default tile square size ranges from 132px to 176px (see `Metrics.tileMin` and `Metrics.tileMax`)

## Desktop / iPad View (Windows 8 style)

- On wider screens, tiles stay at their fixed square size
- More columns fit as width increases — the squares don't grow, more are added
- Default: 2 columns on phone, 4+ columns on desktop/tablet
- Tile size stays consistent; only the number of columns changes
- Text still wraps and shrinks as needed

## Page Width

Width follows the job the page does, not the size of the window:

- **`column`** (default) — one centred column, capped at 800px. Reading screens: forms, sign-in, account details, settings. Long lines stay readable.
- **`wide`** — the full width minus the gutters, starting at the left edge. Dashboards, KPI boards and lists, where fitting more across is the point.

Set it with `width="wide"` on `MetroScreen` and leave everything else at the default. A dashboard centred in a narrow column on a desktop wastes the screen; an account form stretched across one is unreadable.

## Boards

A page must not scroll on a wide screen. The row at the bottom is usually the one somebody is watching, and a page that scrolls keeps it off screen. Build it as a board instead, with `MetroBoardPage` and one `MetroListArea` for the part that genuinely needs to scroll:

```tsx
<MetroBoardPage eyebrow="Admin" title="Users" width="wide">
  <AdminPivot />
  <MetroListArea>{users}</MetroListArea>
</MetroBoardPage>
```

```tsx
<MetroBoardPage eyebrow="Admin" title="Support" width="wide">
  <MetroBoard>
    <MetroPane grow={1.6}>{mainList}</MetroPane>
    <MetroPane grow={1}>{sidePanel}</MetroPane>
  </MetroBoard>
</MetroBoardPage>
```

- `MetroBoardPage` is `MetroScreen` fixed to the viewport above `BOARD_BREAKPOINT` (900, one number for the whole app) and an ordinary scrolling page below it. Never set `scroll` by hand on it.
- `MetroListArea` is the one region of a board that scrolls — a list, or a form long enough to need it. On a phone it renders a fragment, because the page already scrolls there and a nested scroll area would trap the drag.
- `MetroBoard` is a fixed-height row; `MetroPane` is a column that scrolls inside itself. Use `MetroListArea` alone when there is one list and no second column.
- `grow` is a flex weight — give the working area more width than the reference panels.
- Everything above `MetroListArea` stays put: heading, pivot, figures, search and filters. A control that scrolls away is a control nobody finds twice.
- Every admin section follows this shape. If a screen can push the page taller than the window at 900px and up, it is not finished.
- Keep the page heading short on a board: `eyebrow` and `title`, and put the explanation in the panes' hints. Every line of chrome is a row of data lost.

## Navigation

The app has no tab row. A menu button in the top bar opens one drawer, mounted at the shell, so the nav is reachable from every signed-in screen. Sections come from `src/constants/sections.ts`.

The drawer is **square**: a full-height plane with no corner radius, square link rows, and one accent bar on the current section. A radius would make it a floating card laid over the app, which is not what it is — it is a slice of the shell.

The top bar is **compact by rule**:

- a 3-point accent rule, then one row no taller than `Metrics.topBar` (44)
- a 34-point menu button, the person's name at 15/600, roles at 11 in the dim colour
- a 30-point avatar on the right
- two lines of identity, never three: the app's name lives in the drawer and on the home screen's eyebrow, not in the bar
- a hairline and `Shadow.bar` underneath, because content scrolls beneath it

Chrome is not a page. It gets the smallest footprint that still tells you who you are and where the menu is.

## Text Fitting Rules

Text must always fit within the tile. The priority order is:

1. **Wrap first** — let text wrap to additional lines
2. **Shrink second** — if still too long, step down the font size via `fitTileText`
3. **Last resort** — allow `numberOfLines` lines, but text must not overflow

The `fitTileText` function implements this:
- Starts with the preferred font size
- Calculates how many characters fit per line (`available / (fontSize * 0.54)`)
- If lines exceed `maxLines`, steps font size down by 12% (approximately half-size per step)
- Floor is `max(10, preferred * 0.72)` — never goes below 10px
- Returns both the font size and the number of lines to use

**Rule of thumb for writers:** If a label needs to shrink twice, use a shorter phrase. Tiles are meant to be read at a glance.

## Tile Sizes

| Size | When Used | Columns |
|------|-----------|---------|
| Small (~132px) | Narrow phone (< 320px + gutter) | 1 column |
| Medium (~156px) | Typical phone | 2 columns, tiles stretch to fill |
| Large (~176px) | Roomy phone or narrow column | 2 columns, fixed size |
| Extra Large (>176px) | Desktop/tablet (>768px) | 3+ columns, fixed size |

The `tileField()` function handles the column calculation automatically based on available width.

## Tile Shapes

Only two shapes exist — no "small tile" like Windows Phone had:

- **`square`** (default) — for most tiles, holds title + subtitle
- **`wide`** — exactly two squares with a gutter between, for longer names/sentences

No other shapes are in the vocabulary. A tile that can't hold words shouldn't exist.

## Writing Guidelines for Tiles

- Each tile should have a meaningful label that fits on one line at the default size
- If text would need font size below 14px, reconsider the phrasing
- Subtitles should be shorter than titles (they're secondary information)
- Avoid abbreviations that confuse readers
- Title case is NOT used — sentence case is the Metro way

## Rules

A horizontal rule is a last resort, not the language's texture. A screen with one under every heading, around every band and between every block reads as ruled paper, and the rules stop meaning anything.

A rule is allowed in exactly three places:

- **the top bar's lower edge**, because content scrolls under it
- **between the rows of a list**, where the row is the unit being scanned
- **inside a table**, where rules hold columns together (see Statements And Data Sheets)

Everywhere else, separate with space. `MetroSection` closes on space, `MetroHeading` is uppercase only, `MetroFigures` is a band of space, and a pivot draws its line under the current tab only. Do not add a rule to a form group, a figure band, a footnote, a panel header or the drawer.

## Charts

A chart is data, not chrome, so it is the one place more than one hue is allowed: adjacent slices of a pie have to be told apart. Charts use the fixed allocation palette in `src/components/investor/allocation-pie.tsx` — the same colours v1 used, so the chart reads the same as it always did. The legend and any alternate view of the same data carry those colours too. Everything around the chart (headings, totals, labels, the toggle) stays in the normal type and accent palette, and no other kind of view gets a second colour.

## Figures

A page's headline numbers go in one band — `MetroFigures` in `src/components/metro/figures.tsx`. Each figure is an uppercase eyebrow label, the number in the figure or subheader size, and one line of context under it. No boxes and no rules: the band is space, and a hairline separates figures standing side by side.

- `size="large"` for the two or three numbers that are the reason the screen exists (the portfolio's invested equity, value and dividends).
- `size="medium"` for a band of four, where the numbers are evidence rather than headline (a facility's four key metrics).
- Figures wrap on their own as the window narrows; never hand-measure a row of them.
- `tone: 'danger'` is for a number that needs attention (behind budget, delinquent rent). It is the one exception to the accent rule, and it only ever colours the number.

## Admin Console

The admin sections share one page shape, so moving between them feels like the same app:

- A list page opens with its figures band — what the set is, before the rows — then one toolbar strip: the count, the search, and the actions pushed to the right. That strip is `AdminToolbar` in `src/components/admin/admin-toolbar.tsx`; do not hand-roll another order.
- Panels are for one record and are built from `MetroSection` (a heading and a hint, closed by space), with an eyebrow-only `MetroHeading` where the block is a short fact list rather than a form. Neither draws a rule.
- An action inside a row uses `MetroButton size="compact"`. A full 48-point button in a list row makes every row look like a form; the row must stay a row.
- A value that is the point of the row — a balance, a total — uses `MetroListRow emphasis`, so it reads in the text colour with tabular digits instead of as a quiet caption.

## Statements And Data Sheets

Any table of figures is set like a statement, not a grid of boxes:

- Money and percentages use `fontVariant: ['tabular-nums']`, so a column lines up digit for digit.
- Column headings are 10–11px uppercase in the dim colour, and the head is closed by a hairline in the text colour rather than a fill.
- Rows are separated by hairlines. Zebra fills are only for a dense row-per-record board where the eye is tracking across.
- A total is the heaviest type in its table, closed by a heavier rule. Section dividers are uppercase eyebrows with a rule, not filled bars.
- Leave a wide table its own sideways scroll and cap it around 900px; a metric and its amount should stay close enough to pair at a glance.

## Implementation Notes

- All corner radii go through the `Radius` constant from `src/constants/metro`
- `Radius.tile = 0` — tiles only, and the only square corner left in the app
- `Radius.card = 14` and `Radius.control = 10` — planes and interactive elements
- `Radius.pill = 999` and `Radius.round = 999` — pills, markers and circles
- Buttons are as wide as their label: `MetroButton` sets `alignSelf` to `flex-start` and only a phone (below `Metrics.desktop`) stretches it to the column. Don't hand-size a button to fill a desktop layout — a full-width button reads as a banner, not an action.
- Shadows come from `Shadow`, never from a hand-written `boxShadow`
- The `Tile` component automatically applies the correct radius via `styles.tile.borderRadius: Radius.card`
- When custom styling, always reference `Radius.card` or `Radius.control`, never hardcode `0`

## Example: Correct Tile Style

```tsx
// In styles or Tile component
const styles = StyleSheet.create({
  tile: {
    borderRadius: Radius.tile, // 0 = square corners, tiles only
    overflow: 'hidden',
  },
});
```

## Example: Incorrect (what to avoid)

```tsx
// ❌ Don't do this — non-zero radius on tiles
const styles = StyleSheet.create({
  tile: {
    borderRadius: 8, // Creates pill shape, not Metro
    borderRadius: 'sm', // No such thing in Metro
  },
});
```

## Checklist for New Screens

When adding a new screen with Metro tiles:

- [ ] Tiles use `borderRadius: Radius.tile` — square, always
- [ ] Cards, lists, banners, inputs and buttons use `Radius.card` / `Radius.control` from the table
- [ ] Nothing hardcodes a radius number
- [ ] Tile text fits within the tile using `fitTileText` or acceptable wrapping
- [ ] Tile titles and subtitles use `ThemedText` with `metroSubheader`/`metroSubtle` types
- [ ] Tile content respects the square size from the field it's in
- [ ] Only the top bar and floating panels carry a shadow (`Shadow.bar` / `Shadow.overlay`)
- [ ] No gradients anywhere, on tiles or otherwise
- [ ] One accent colour is used consistently