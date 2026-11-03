# Metro Design Language

This document contains the design instructions for the Metro solution. It is intended to be shared with other AIs and developers to ensure consistency across sites built with the Metro design system.

## Philosophy

Metro is a design language that originated from Windows Phone. Its core principles are:

- **Flat colour fields** instead of gradients and shadows
- **Type-driven hierarchy** — words carry the meaning, not boxes
- **Squares instead of rounded corners** — the default is hard edges
- **Large, readable type** — hierarchy is carried by font sizes and weights
- **One accent colour** the user owns

## Corner Radii

The entire Metro system uses only three radius values:

| Radius Name | Value | Usage |
|-------------|-------|-------|
| `card` | `0` | Tiles, cards, fields, chips — anything that is a flat colour plane |
| `control` | `0` | Interactive elements: buttons, toggles, chips, fields |
| `round` | `999` | Circles only: status dots, avatars, progress rings, toggle knobs |

**Never use any other radius value.** All corners should be square (0) unless the element is explicitly a circle.

## Tile Corners

- **All tiles are square-cornered** — no rounding on titles, subtitles, or the tile background itself
- Tiles are flat colour fields with square edges (borderRadius: 0)
- The `tile` style in `src/components/metro/index.tsx` has `borderRadius: Radius.card` which resolves to `0`
- Tile text fits within the square; long text wraps and shrinks as needed (see `fitTileText` function)

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

## Navigation

The app has no tab row. A menu button in the top bar opens one drawer, mounted at the shell, so the nav is reachable from every signed-in screen. Sections come from `src/constants/sections.ts`.

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

## Charts

A chart is data, not chrome, so it is the one place more than one hue is allowed: adjacent slices of a pie have to be told apart. Charts use the fixed allocation palette in `src/components/investor/allocation-pie.tsx` — the same colours v1 used, so the chart reads the same as it always did. The legend and any alternate view of the same data carry those colours too. Everything around the chart (headings, totals, labels, the toggle) stays in the normal type and accent palette, and no other kind of view gets a second colour.

## Figures

A page's headline numbers go in one band between two hairlines — `MetroFigures` in `src/components/metro/figures.tsx`. Each figure is an uppercase eyebrow label, the number in the figure or subheader size, and one line of context under it. No boxes: the band is the rule above and below, and a hairline separates figures standing side by side.

- `size="large"` for the two or three numbers that are the reason the screen exists (the portfolio's invested equity, value and dividends).
- `size="medium"` for a band of four, where the numbers are evidence rather than headline (a facility's four key metrics).
- Figures wrap on their own as the window narrows; never hand-measure a row of them.
- `tone: 'danger'` is for a number that needs attention (behind budget, delinquent rent). It is the one exception to the accent rule, and it only ever colours the number.

## Admin Console

The admin sections share one page shape, so moving between them feels like the same app:

- A list page opens with its figures band — what the set is, before the rows — then one toolbar strip: the count, the search, and the actions pushed to the right. That strip is `AdminToolbar` in `src/components/admin/admin-toolbar.tsx`; do not hand-roll another order.
- Panels are for one record and are built from `MetroSection` (a heading, a hint, a hairline), with an eyebrow-only `MetroHeading` where the block is a short fact list rather than a form.
- An action inside a row uses `MetroButton size="compact"`. A full 52-point button in a list row makes every row look like a form; the row must stay a row.
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
- `Radius.card = 0` and `Radius.control = 0` — use these for tiles and interactive elements
- `Radius.round = 999` — only for circular elements
- The `Tile` component automatically applies the correct radius via `styles.tile.borderRadius: Radius.card`
- When custom styling, always reference `Radius.card` or `Radius.control`, never hardcode `0`

## Example: Correct Tile Style

```tsx
// In styles or Tile component
const styles = StyleSheet.create({
  tile: {
    borderRadius: Radius.card, // 0 = square corners
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

- [ ] All tiles use `borderRadius: Radius.card` (or `Radius.control` for interactive elements)
- [ ] No element uses a non-zero radius unless it's a circle (`Radius.round`)
- [ ] Tile text fits within the tile using `fitTileText` or acceptable wrapping
- [ ] Tile titles and subtitles use `ThemedText` with `metroSubheader`/`metroSubtle` types
- [ ] Tile content respects the square size from the field it's in
- [ ] No shadows, gradients, or raised effects on tiles
- [ ] One accent colour is used consistently