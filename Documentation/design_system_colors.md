# IoTank V2.0 Design System - Color Palette

The IoTank design system is built on an "Industrial Atmosphere" palette, using **Electric Cyan** and **Brand Pink** accents against a deeply dimensional backdrop.

## Primary Brand Accents

1. **Electric Cyan**
   - Variable: `--color-accent-primary`
   - Hex: `#00D4FF` (Light) / `#00E5FF` (Dark)
   - **Usage**: Primary actions, fuel level charts, high-trust indicators.

2. **Brand Pink**
   - Variable: `--color-accent-pink`
   - Hex: `#FF4FCB`
   - **Usage**: Market data, secondary accents, brand glows.

3. **Warm Glow (Peach)**
   - Variable: `--color-accent-peach`
   - Hex: `#FFD6B3`
   - **Usage**: Temperature warnings, low-severity alerts.

## Atmospheric Surfaces

- **Sidebar Sweep**: Blush to Lavender (`#F6EAF2` → `#EED3E8` → `#E6DBF5`).
- **Glass Surfaces**: `rgba(255, 255, 255, 0.7)` for light mode, `rgba(30,30,30, 0.85)` for dark mode.

## Implementation Rule

Developers must exclusively use the CSS variables defined in `/src/styles/theme.css`. Direct hex codes should only be used for chart libraries (e.g., Recharts) where variable interpolation is not supported.

---
**Last Updated**: April 14, 2026
