# yozora

A fluid, draggable floating tab bar for React. Tap to select. Hold and slide to glide between tabs.

- Spring-animated pill, press-and-hold "slide mode", haptic ticks, subtle drift away from your finger
- Commits the selection **on release**, so `onValueChange` fires once
- Light, dark and system themes
- Zero dependencies, CSS is bundled and injected automatically
- Unstyled mode, `classNames` slots, CSS variables and `data-*` attributes for everything

## Install

```bash
npm i yozora
```

## Usage

Mount it once, e.g. in your root layout (it fixes itself to the bottom of the viewport):

```tsx
'use client';
import { Yozora } from 'yozora';

const items = [
  { id: 'chats', label: 'Chats', icon: <ChatIcon /> },
  { id: 'contacts', label: 'Contacts', icon: <UsersIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  { id: 'profile', label: 'Profile', icon: <UserIcon /> },
];

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Yozora
      items={items}
      value={pathname.split('/')[1] || 'chats'}  // optional: keeps the bar in sync with the route
      onValueChange={(id) => router.push(`/${id}`)}
      fullWidth
    />
  );
}
```

Yozora never touches your router. `onValueChange` is the only event.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `YozoraItem[]` | required | `{ id, icon, label?, disabled?, className?, 'aria-label'? }` |
| `value` | `string` | | Controlled selected id |
| `defaultValue` | `string` | first item | Initial id when uncontrolled |
| `onValueChange` | `(id: string) => void` | | Fires once on release, tap or keyboard. Not while sliding |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | `system` follows `prefers-color-scheme`. Pass the resolved theme if you use class-based dark mode |
| `accent` | `string` | theme default | Any CSS color. Sets `--yozora-accent`; pill fill and glow derive from it |
| `fullWidth` | `boolean` | `false` | Telegram style: the bar fills `--yozora-width`, tabs share it equally. Otherwise the bar hugs its content |
| `position` | `'bottom' \| 'top' \| 'static'` | `'bottom'` | `static` renders in normal flow |
| `offset` | `number \| string` | `16` | Distance from the viewport edge (safe-area is added) |
| `holdDelay` | `number` | `250` | ms to hold an unselected tab before sliding starts. The selected tab slides immediately |
| `drift` | `boolean \| { x?: number; y?: number }` | `true` | Max px the bar shifts away from the finger (defaults 5 and 7). `false` disables |
| `haptics` | `boolean` | `true` | Vibration ticks (Android browsers only) |
| `classNames` | `YozoraClassNames` | | Per-slot classes (below) |
| `unstyled` | `boolean` | `false` | Removes visual styles; behavior-critical CSS stays |
| `className`, `style`, `ref`, ... | | | Applied to the bar (`role="tablist"`) |

### Gesture rules

- Tap an item: selects it.
- Press the **selected** tab: slide mode starts immediately.
- Hold ~`holdDelay` ms, without moving, on any other tab: the pill moves under your finger and slide mode starts.
- Moving more than 10px before slide mode starts cancels the touch. Nothing is selected.
- Keyboard: arrow keys, Home and End; Enter or Space on a focused tab.

## Styling

`classNames` slots: `container`, `root`, `pill`, `item`, `icon`, `label`.

```tsx
<Yozora classNames={{ pill: 'bg-rose-500/20', item: 'text-sm' }} accent="#f43f5e" />
```

CSS variables (set them on any ancestor, via `style`, or in your stylesheet):

| Variable | Default (light) | Notes |
| --- | --- | --- |
| `--yozora-accent` | `#1d8cf0` | Active color. Pill and glow derive from it |
| `--yozora-bg` / `--yozora-bg-glass` | `#fff` / `rgba(255,255,255,.72)` | Solid fallback and translucent blurred version |
| `--yozora-fg` | `#1c1f24` | Inactive text and icon color |
| `--yozora-shadow` | soft drop shadow | |
| `--yozora-radius` | `999px` | |
| `--yozora-padding` | `5px` | Bar padding, also the pill inset |
| `--yozora-width` / `--yozora-max-width` | `80vw` / `480px` | `fullWidth` only |
| `--yozora-item-min` | `64px` (`0` with `fullWidth`) | |
| `--yozora-item-padding-x` | `14px` | |
| `--yozora-icon-size` / `--yozora-font-size` | `20px` / `11px` | |
| `--yozora-spring` | `cubic-bezier(.34,1.56,.64,1)` | Lower the `1.56` for less bounce |
| `--yozora-offset` | from `offset` | |
| `--yozora-z` | `999999999` | |

Data attributes for your own selectors: `data-yozora-container`, `data-yozora-root`, `data-yozora-pill`, `data-yozora-item`, `data-yozora-icon`, `data-yozora-label`, plus state attributes `data-active`, `data-armed`, `data-theme`, `data-full-width`, `data-styled`, `data-mounted`, `data-disabled`.

## Notes

- `navigator.vibrate` is not available in iOS Safari, so haptics are Android-only on the web.
- Needs `backdrop-filter` for the glass look; a solid background is used where it isn't supported.
- `prefers-reduced-motion` shortens all transitions.
- Types are exported: `YozoraProps`, `YozoraItem`, `YozoraClassNames`, `YozoraDrift`, `YozoraTheme`.

## Development

```bash
pnpm install
pnpm dev        # rebuild on change
pnpm typecheck
pnpm build
```

## License

MIT
