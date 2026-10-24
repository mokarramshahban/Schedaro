# Schedaro Design System

## Direction
The Stage 1 system uses a light workspace, indigo action color, Inter-like typography, compact cards, structured navigation, and responsive sidebar behavior. It keeps the timetable workspace primary and avoids unrelated dashboard modules.

## Tokens

| Token | Value | Use |
|---|---|---|
| Primary | `#4f46e5` | Active navigation, primary actions, focus |
| Primary dark | `#3730a3` | Hover/pressed actions |
| Canvas | `#f5f7fb` | Application background |
| Surface | `#ffffff` | Cards, sidebar, header |
| Border | `#e7eaf0` | Dividers and control borders |
| Text | `#172033` | Headings and primary content |
| Muted text | `#6b7280` | Descriptions and metadata |
| Success | `#16a34a` | Connected/ready status |
| Warning | `#d97706` | Planned or pending state |
| Error | `#dc2626` | Failed requests and validation |

## Typography
Inter is the reference font. The app uses an Inter-compatible system stack with `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` so the interface remains usable without a remote font request. Headings use 700 weight with tight tracking; body text uses 400–500; labels and nav use 600.

## Layout and spacing
- Desktop sidebar: 252px; mobile drawer: 292px maximum.
- Header: 72px minimum height.
- Page content max width: 1440px with 28–40px responsive padding.
- Spacing scale: 4px base, with 8/12/16/20/24/32/40px common steps.
- Card radius: 16px; controls: 10–12px; status dots: full round.
- Shadows are subtle and never used as the only grouping cue.

## Components

- `AppSidebar`: accessible primary navigation, global Active Institution selector, institution-management action, and current-page state.
- `AppHeader`: mobile menu trigger, page context, search affordance, and live API status.
- `Button`: primary, secondary, ghost, and compact variants with focus-visible rings.
- `Card`: shared surface primitive with optional header/body composition.
- `StatusDot`: real connection state with text, never a hardcoded success indicator.
- `TimetablePage`: Stage 1 workspace foundation and honest empty state for the future weekly grid.

## Responsive strategy
At desktop widths the sidebar remains visible and the workspace uses a two-column overview panel. At widths below 960px the sidebar becomes a focus-trapped-style drawer with backdrop behavior and the content becomes single-column. At mobile widths near 375px, controls stack, cards use full width, and no content relies on horizontal scrolling.

## Accessibility
Use semantic landmarks, real buttons for interactions, labels for controls, `aria-current` for the active route, disabled planned actions, visible focus rings, and status text alongside color. Avoid importing the reference's inaccessible decorative-only patterns.
