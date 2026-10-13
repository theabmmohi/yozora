# yozora

**A fluid, draggable floating tab bar for React.**
Tap to switch. Hold and slide to glide. Feel the haptics. 🌌

<div align="center">

[![npm](https://img.shields.io/npm/v/yozora)](https://www.npmjs.com/package/yozora)
[![GitHub Repo stars](https://img.shields.io/github/stars/theabmmohi/yozora)](https://www.npmjs.com/package/yozora)
<br/>
[![license](https://img.shields.io/npm/l/yozora)](./LICENSE)
[![types](https://img.shields.io/npm/types/yozora)](https://www.npmjs.com/package/yozora)

</div>

_Yozora (夜空) is Japanese for "night sky"._

## Why yozora?

Native apps have a certain feel: a floating bar, a highlight that slides under your finger, a tiny vibration as you cross each tab. On the web that feel is usually missing. Yozora brings it to React with no dependencies.

- 🫧 **Floating glass bar** with blur, a soft shadow and a safe-area-aware position
- 👆 **Tap to select**, or **hold and slide** to move the highlight under your finger
- 🧱 **Springy, but never leaves the bar.** The pill squashes against the bar's edge like a wall
- 📳 **Haptic ticks** on Android browsers, and a subtle drift of the bar away from your finger
- ✅ **Selection is committed on release**, so your `onValueChange` fires once, not on every tab you slide over
- 🎨 **Outlined and filled icons** that crossfade when a tab is selected
- 🌗 **Light, dark and system themes**, plus one prop to set your accent color
- ♿ **Accessible by default**, with navigation or ARIA tabs semantics, full keyboard support and RTL
- 🪶 **Zero dependencies.** React is the only peer
- 🛠️ **Easy to restyle** with `classNames`, CSS variables, `data-*` attributes or `unstyled`

## Install

```bash
npm i yozora
```

Works with React 18 and 19, and ships with TypeScript types.

## Quick start

**1. Import the stylesheet once**, for example in your root layout or entry file:

```tsx
import "yozora/styles"
```

**2. Mount the bar once.** It fixes itself to the bottom of the screen:

```tsx
"use client"

import { Yozora } from "yozora"
import { useState } from "react"

const tabs = [
  { id: "chats", label: "Chats", icon: <ChatOutline />, activeIcon: <ChatFilled /> },
  { id: "contacts", label: "Contacts", icon: <UsersOutline />, activeIcon: <UsersFilled /> },
  { id: "settings", label: "Settings", icon: <GearOutline />, activeIcon: <GearFilled /> },
  { id: "profile", label: "Profile", icon: <UserOutline />, activeIcon: <UserFilled /> }
]

export function Nav() {
  const [tab, setTab] = useState("chats")
  return <Yozora aria-label="Main" tabs={tabs} value={tab} onValueChange={setTab} fullWidth />
}
```

**3. Do whatever you like in `onValueChange`.** Yozora never touches your router. It tells you which tab was picked, and you decide what happens.

### Next.js (App Router)

```tsx
// app/layout.tsx
import "yozora/styles"
import { Nav } from "./nav"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Nav />
      </body>
    </html>
  )
}
```

```tsx
// app/nav.tsx
"use client"

import { Yozora } from "yozora"
import { usePathname, useRouter } from "next/navigation"

export function Nav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <Yozora
      aria-label="Main"
      tabs={tabs}
      value={pathname.split("/")[1] || "chats"} // keeps the bar in sync with the route
      onValueChange={(id) => router.push(`/${id}`)}
      fullWidth
    />
  )
}
```

### React Router, TanStack Router, or anything else

Same idea: pass the current route as `value` and navigate in `onValueChange`.

```tsx
const navigate = useNavigate()
const { pathname } = useLocation()

<Yozora tabs={tabs} value={pathname.split("/")[1] || "chats"} onValueChange={(id) => navigate(`/${id}`)} />
```

> **Why a separate stylesheet?** The bar usually lives in a root layout, so it is rendered on the server. Styles injected by JavaScript would leave it unstyled until hydration, and strict CSP setups can block injected styles. A normal CSS import avoids both problems.

## How it feels

| You do | What happens |
| --- | --- |
| **Tap** a tab | It is selected when you lift your finger. |
| **Press the selected tab** and drag | Slide mode starts instantly. The pill follows your finger. |
| **Hold** another tab (about 250 ms, without moving) | The pill moves under your finger and slide mode starts, with a haptic tick. |
| **Swipe** from an unselected tab without holding | Nothing is selected. The touch is treated as a swipe, not a tap. |
| **Slide across tabs** | The highlight and icons preview each tab and tick as you cross it. Nothing is committed yet. |
| **Lift your finger** | The tab under it is selected, `onValueChange` fires **once**, and the pill springs into place. |
| **Drag past either end** | The pill squashes against the bar's edge and springs back. It never crosses it. |
| **Cancel the touch** (the system interrupts it) | Nothing is committed. |

While you slide, the bar also scales up a hair and drifts slightly away from your finger, the way a physical button gives under pressure.

## Options

Everything is a flat prop with a sensible default, so `<Yozora tabs={tabs} />` already works.

### `<Yozora />` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tabs` | `YozoraTab[]` | **required** | The tabs. See [Tabs](#tabs) |
| `value` | `string` | | Selected tab id (controlled) |
| `defaultValue` | `string` | first enabled tab | Initial tab id when uncontrolled |
| `onValueChange` | `(id: string) => void` | | Called once when a selection is committed (tap, release after sliding, or keyboard) |
| `semantics` | `"navigation" \| "tabs"` | `"navigation"` | How the bar is announced to assistive tech. See [Accessibility](#accessibility) |
| `theme` | `"light" \| "dark" \| "system"` | `"system"` | `system` follows `prefers-color-scheme` |
| `accent` | `string` | `#1d8cf0` light, `#6cb6ff` dark | Any CSS color. The pill and glow derive from it |
| `fullWidth` | `boolean` | `false` | Telegram style. The bar fills its width and tabs share it equally. When `false`, the bar hugs its content, like a compact gallery bar |
| `position` | `"bottom" \| "top" \| "static"` | `"bottom"` | `static` renders in normal flow instead of fixing to the screen |
| `offset` | `number \| string` | `16` | Distance from the screen edge. A number is px, a string is any CSS length. Safe-area insets are added automatically |
| `holdDelay` | `number` | `250` | Milliseconds to hold an unselected tab before slide mode starts |
| `drift` | `boolean \| { x?: number; y?: number }` | `true` | Max px the bar drifts away from your finger while sliding. Defaults are `x: 3`, `y: 5`. `false` turns it off |
| `haptics` | `boolean \| { tick?: number; arm?: number }` | `true` | Vibration durations in ms. `tick` fires when you cross a tab or tap, `arm` when slide mode starts. Defaults are `50` and `75`. `false` turns it off |
| `classNames` | `YozoraClassNames` | | Extra class names per part. See [Styling](#styling) |
| `unstyled` | `boolean` | `false` | Removes every visual style and keeps only the behavior-critical CSS |
| `className`, `style`, `ref`, `id`, `aria-*`, ... | | | Passed to the bar element |

Yozora handles `onKeyDown` and the pointer events itself, so those props are not accepted.

### Tabs

```ts
type YozoraTab = {
  id: string // unique, used by value and onValueChange
  icon: ReactNode // outlined icon, shown when unselected
  activeIcon?: ReactNode // filled icon, shown when selected (crossfades with `icon`)
  label?: ReactNode // visible text under the icon
  "aria-label"?: string // accessible name; required when there is no label
  disabled?: boolean // can't be selected by touch or keyboard
  className?: string // extra class for this one tab
  controls?: string // id of the panel this tab controls (semantics="tabs")
}
```

- Every tab needs a name: a `label`, an `aria-label`, or both. TypeScript enforces it, and plain JavaScript gets a console warning in development.
- Without `activeIcon`, `icon` is used for both states.
- Any icon library works. With lucide-react, a filled look is one prop: `activeIcon: <Home fill="currentColor" />`.

### Controlled or uncontrolled

```tsx
// Uncontrolled: Yozora keeps track. Good for demos and simple UIs
<Yozora tabs={tabs} defaultValue="chats" onValueChange={(id) => console.log(id)} />

// Controlled: you own the state. Good for routers
<Yozora tabs={tabs} value={tab} onValueChange={setTab} />
```

In controlled mode the bar only moves when `value` changes. If you ignore an `onValueChange`, the pill springs back to the current tab.

If `value` doesn't match any tab (for example, you're on a page that isn't in the bar), no tab is highlighted. Tabs that load later work fine, and an uncontrolled bar falls back to the first enabled tab.

### Examples

```tsx
// Telegram style: full width, your brand color
<Yozora tabs={tabs} fullWidth accent="#f43f5e" />

// Compact style: the bar hugs its icons, with no labels
<Yozora tabs={iconOnlyTabs} />

// A bar that sits in normal flow
<Yozora tabs={tabs} position="static" />

// Calmer: no drift, softer vibration, a longer hold
<Yozora tabs={tabs} drift={false} haptics={{ tick: 20, arm: 40 }} holdDelay={350} />

// Match your app's theme switcher (next-themes, etc.)
<Yozora tabs={tabs} theme={resolvedTheme === "dark" ? "dark" : "light"} />
```

## Styling

Pick the level of control you need.

### 1. One color

```tsx
<Yozora tabs={tabs} accent="#8b5cf6" />
```

The pill fill, the slide-mode glow and the selected icon color all follow it, in light and dark.

### 2. CSS variables

Set them in your stylesheet, on any ancestor, or through `style`:

```css
:root {
  --yozora-radius: 20px;
  --yozora-width: 92vw;
}
```

| Variable | Default | What it does |
| --- | --- | --- |
| `--yozora-accent` | `#1d8cf0` / `#6cb6ff` | Selected color. The pill and glow derive from it |
| `--yozora-bg` | `#fff` / `#20232a` | Solid background, used when blur isn't supported |
| `--yozora-bg-glass` | translucent | Blurred background used when `backdrop-filter` is supported |
| `--yozora-fg` | `#1c1f24` / `#e8eaee` | Text and icon color of unselected tabs |
| `--yozora-shadow` | soft drop shadow | Bar shadow |
| `--yozora-radius` | `999px` | Corner radius of the bar, the pill and the tabs |
| `--yozora-padding` | `5px` | Space between the bar edge and the pill. This is the "wall" the pill squashes against |
| `--yozora-width` | `80vw` | Bar width when `fullWidth` |
| `--yozora-max-width` | `480px` | Max width when `fullWidth` |
| `--yozora-tab-min` | `64px` (`0px` with `fullWidth`) | Minimum width of a tab |
| `--yozora-tab-padding-x` | `14px` | Horizontal padding of a tab |
| `--yozora-icon-size` | `20px` | Icon size |
| `--yozora-font-size` | `11px` | Label size |
| `--yozora-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Easing for the bar's press scale and the icon swap. The pill uses real spring physics instead |
| `--yozora-offset` | from `offset` | Distance from the screen edge |
| `--yozora-z` | `999999999` | `z-index` of the bar |

### 3. `classNames`

Add your own classes to any part. This works well with Tailwind:

```tsx
<Yozora
  tabs={tabs}
  classNames={{
    root: "shadow-xl",
    pill: "bg-rose-500/20",
    tab: "text-xs",
    label: "font-semibold"
  }}
/>
```

Slots: `container` (the fixed wrapper), `root` (the bar), `pill` (the highlight), `tab`, `icon`, `label`.

### 4. `data-*` attributes

Every part has a stable attribute, so you can target it from any stylesheet:

| Part | Attribute | State attributes |
| --- | --- | --- |
| Wrapper | `data-yozora-container` | `data-position` |
| Bar | `data-yozora-root` | `data-theme`, `data-full-width`, `data-styled`, `data-armed` (slide mode), `data-mounted` |
| Pill | `data-yozora-pill` | `data-dragging`, `data-empty` |
| Tab | `data-yozora-tab` | `data-active`, `data-disabled` |
| Icon | `data-yozora-icon` | `data-swap` (has an `activeIcon`) |
| Outlined / filled icon | `data-yozora-icon-outline`, `data-yozora-icon-filled` | |
| Label | `data-yozora-label` | |

```css
[data-yozora-root][data-armed="true"] [data-yozora-pill] {
  background: hotpink;
}
```

### 5. `unstyled`

```tsx
<Yozora tabs={tabs} unstyled classNames={{ root: "my-bar", tab: "my-tab" }} />
```

`unstyled` removes colors, padding, shadows and the blur. It keeps only what the behavior needs: positioning, the pill's movement, and the icon swap. You bring the look.

## Accessibility

Yozora is built to work without a mouse or a screen.

**`semantics="navigation"` (default).** Use this when tabs take you to different pages.
- The bar is a navigation landmark made of buttons. The active one has `aria-current="page"`.
- Give the bar a name: `<Yozora aria-label="Main" ... />`.
- Each button is a normal Tab stop. The arrow keys, Home and End move focus. Enter or Space activates.

**`semantics="tabs"`.** Use this when tabs switch panels on the same page.
- The bar follows the ARIA tabs pattern: `tablist`, `tab`, `aria-selected` and a roving tabindex.
- Arrow keys select as focus moves. Home and End jump to the first and last tab.
- Pass `controls` on each tab with the id of its panel.

For both modes:
- The arrow keys flip in right-to-left layouts, and the pill's limits work in RTL too.
- Disabled tabs are skipped.
- Icons are hidden from screen readers, so each tab's name comes from its `label` or `aria-label`.
- `prefers-reduced-motion` turns the pill's spring into an instant move.

## Browser notes

- **Haptics** use `navigator.vibrate`, which works in Chrome and Firefox on Android. iOS Safari doesn't support it, so there the bar works without vibration.
- **Glass effect.** The blur uses `backdrop-filter`. Browsers without it get the solid `--yozora-bg`.
- **Accent colors** use `color-mix()`. Browsers without it get a neutral pill.
- **Server rendering.** Works with SSR and RSC frameworks. The component has the `"use client"` directive. Functions such as `onValueChange` can't be passed from a server component, so use a small client wrapper like the examples above.

## FAQ

**Can I tune the spring and the wall squash?**
The feel is tuned in one small file, [`src/physics.ts`](./src/physics.ts) (stiffness 420, damping 0.75, squash up to 25%). They aren't props yet. If you'd like them to be, open an issue.

**Why doesn't the pill overshoot the end tab?**
It does overshoot, like any spring. The bar's padding acts as a wall, so the overshoot becomes a squash instead of the pill crossing the edge.

**Can I use several bars?**
Yes. Each `<Yozora />` is independent. Use `position="static"` for bars that live inside your layout.

**Can I use my own router link components?**
The tabs are buttons, and `onValueChange` is where you navigate. Link components inside the bar aren't supported.

## TypeScript

Everything is typed and exported:

```ts
import type { YozoraProps, YozoraTab, YozoraClassNames, YozoraDrift, YozoraHaptics, YozoraTheme } from "yozora"
```

## Development

```bash
npm install
npm run dev        # rebuild on change
npm run typecheck
npm test           # vitest
npm run build
npm run test:dist  # smoke-test the built bundles
```

Requires Node 24 for development.

## Inspired by

Yozora stands on the shoulders of designs and libraries I admire:

- **[Telegram](https://telegram.org)** for the floating, draggable tab bar with a highlight that follows your finger.
- **[Samsung One UI](https://samsung.com)** for the compact, gallery-style bar that hugs its icons.
- **[Emil Kowalski](https://emilkowal.ski)** for his writing and work on interaction craft: interruptible, spring-based motion and subtle, honest haptics.
- **[Sonner](https://github.com/emilkowalski/sonner)** (and [Vaul](https://github.com/emilkowalski/vaul)) for the way a library should feel to use: zero setup, `data-*` attributes, CSS variables, `classNames` and `unstyled`.

Yozora is an independent project and isn't affiliated with or endorsed by Telegram, Samsung or Emil Kowalski. Telegram and One UI are trademarks of their respective owners.

## License

MIT © [theabmmohi](https://github.com/theabmmohi)
