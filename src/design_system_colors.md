# IoTank V2.0 Web Color Palette

Based on the provided Pantone (PMS) references, the overarching UI color language for the web platform relies primarily on a monochromatic family spanning from light lavender to deep indigo-violet. 

## Primary UI Hues
Whenever developing colorful components (like modal headers, section cards, buttons, or badges), rely on this core set of properties rather than generic greens (emerald), blues (cyan), or yellows (amber) unless strictly conveying a terminal system state (e.g., green for true success, red for alarm).

1. **Light Lavender (PMS 256/263)**
   - Hex Reference: `#e9d5ff` (Tailwind `purple-200`) or `#c4b5fd` (Tailwind `violet-300`)
   - **Usage**: Background tints, subtle highlights, read-only tag backgrounds.

2. **Vibrant Amethyst (PMS 266/258)**
   - Hex Reference: `#a855f7` (Tailwind `purple-500`) or `#9333ea` (Tailwind `purple-600`)
   - **Usage**: General accents, secondary section headers, active toggle states.

3. **Rich Violet / Indigo (PMS 2726/2736)**
   - Hex Reference: `#7c3aed` (Tailwind `violet-600`) or `#6d28d9` (Tailwind `violet-700`)
   - **Usage**: Primary buttons, primary section headers, interactive element borders (like focused inputs).

4. **Deep Plum (PMS 260/2627)**
   - Hex Reference: `#86198f` (Tailwind `fuchsia-800`) or `#4c1d95` (Tailwind `violet-900`)
   - **Usage**: Header gradients, modal backgrounds, typographic emphasis.

## Implementation Rule
If a UI element requires "colorful" distinction (e.g. 3 different form sections), do NOT use unrelated colors (Blue, Green, Yellow). Instead, use steps along this palette:
- Section 1: Vibrant Amethyst (`#a855f7`)
- Section 2: Rich Violet (`#7c3aed`)
- Section 3: Deep Plum (`#c026d3` or `#86198f`)

This maintains a cohesive, premium brand aesthetic across the entire IoTank workspace.
