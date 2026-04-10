> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This compilation of project standards and prompt templates is part of the project's "memory card". When starting a new session or component task for the IoTank Client App, review this document to ensure alignment with our chosen architecture (React, TypeScript, Supabase, Zustand, shadcn/ui).

# IoTank Client App - Component Specification Template

When building `[COMPONENT_NAME]`, follow this exact structure:

## 1. Component Purpose
[One sentence describing exactly what this component does in the context of the IoTank Client App]

## 2. Props Interface
```typescript
interface [ComponentName]Props {
  // List all props with strict TypeScript types
  // e.g., organizationId: string;
}
```

## 3. State Requirements
- **Local state (`useState`)**: [list local variables, e.g., `isOpen`, `searchQuery`]
- **Global state (Zustand)**: [list Zustand stores needed, e.g., `useTankStore`]
- **Data Fetching (Supabase)**: [list specific Supabase queries, RPCs, or hooks needed, e.g., `useTanks()` or `supabase.from('sensor_readings').select()`]

## 4. Security Checks
- [ ] Supabase RLS policy explicitly verified for the target table
- [ ] Input data validated/sanitized (using Zod where applicable)
- [ ] Client-side RBAC permission check before render (Levels 5-8 access check via `useAuth`)
- [ ] Wrapped in a React Error Boundary

## 5. Accessibility (A11y) Requirements
- [ ] ARIA labels applied to all interactive or icon-only elements
- [ ] Complete Keyboard navigation support (Tab, Enter, Spacebar)
- [ ] Focus management correctly implemented (especially for Dialogs/Modals)
- [ ] Tested for Screen Reader compatibility (WCAG AA standard)

## 6. Performance Optimization
- [ ] `React.memo` utilized if re-renders are computationally expensive
- [ ] Dynamic import / Lazy loading used if the component pushes chunk size >50KB
- [ ] Search or heavy input fields implemented with debounce (e.g., 300ms)
- [ ] Long data lists (>100 items) are virtualized

## 7. Error Handling
- [ ] `try-catch` blocks on all async operations (Supabase calls)
- [ ] User-friendly, non-technical error messages displayed via toast or inline alerts
- [ ] Graceful fallback UI provided for error states
- [ ] Errors logged appropriately (to console in dev, to error tracking in prod)

## 8. Testing Checklist
- [ ] **Happy path**: Component renders correctly with real data
- [ ] **Edge cases**: Empty state handled, loading state visible, error state styled
- [ ] **User interactions**: Forms validate, buttons trigger correct state/DB mutations
- [ ] **Permission tests**: Enforces visibility based on user role correctly

---

## **PART 2: AI PROMPTING FRAMEWORK (The Secret Sauce)**

### **Universal Prompt Structure for EVERY Coding Request**
```markdown
ROLE: You are a senior full-stack developer with 10+ years of experience in React 18, TypeScript, Supabase (PostgreSQL), Zustand, and enterprise SaaS building.

CONTEXT:
I'm building a component for the IoTank Client Application. We use Supabase Auth, Supabase Database with RLS, and Tailwind CSS with shadcn/ui.
[Paste relevant section from PROJECT_SPEC.md showing database tables or hierarchy]

TASK:
Build the [COMPONENT_NAME] component for the [PAGE/FEATURE_NAME].

REQUIREMENTS:
1. Functionality:
   - [List 2-4 specific features]
   - [Include precise expected behavior]

2. Data Flow:
   - Fetch data from: [Supabase table/RPC name]
   - State management: [useState or Zustand store name]
   - Handle loading, empty, and error states elegantly.

3. Security:
   - Must comply with RLS on table: [table name]
   - Check RBAC permission for minimum level: [Level 5-8]

4. UI/UX:
   - Utilize existing shadcn/ui components (e.g., Card, Button, Input, Table)
   - Style exclusively with Tailwind CSS utility classes
   - Match existing dashboard aesthetics (dark mode compatible)
   - Fully responsive across mobile, tablet, and desktop

5. TypeScript:
   - Strict mode enabled.
   - All props, state, and Supabase responses must be strictly typed.
   - DO NOT USE `any`.

6. Code Quality:
   - Add JSDoc comments to complex utility functions.
   - Component maximum lines: ~200. Break into smaller sub-components if larger.

CONSTRAINTS:
- Do NOT use deprecated Supabase queries (use v2 JS Client `.from()`).
- Do NOT write raw SQL; rely entirely on the Supabase TS client or defined RPCs.
- Do NOT use inline CSS styles. Only Tailwind.
```

---

### **Prompt Templates for Common Tasks**

#### **A. Building a New Page/Dashboard View**
```markdown
TASK: Create the [PAGE_NAME] page for the IoTank Client App.

CONTEXT:
- This page displays [describe primary data].
- Only users with role level [Level] or better should access it.
- Data relies on Supabase table: [Table Name]

STRUCTURE:
1. Main Page Layout (src/pages/[PageName].tsx)
2. Supabase Hooks/Services (src/hooks/use[Data].ts)
3. 3-5 Sub-components needed for modularity.

STEP-BY-STEP IMPLEMENTATION:
1. Define strict TypeScript interfaces for the data.
2. Write the Supabase data fetching logic (React hook with loading/error).
3. Build the main layout skeleton.
4. Build individual UI sub-components.
5. Wire state to the UI.

PROVIDE CODE FOR STEP [NUMBER] ONLY. We will build incrementally.
```

#### **B. Building Data Tables with TanStack/shadcn**
```markdown
TASK: Create a data table for [DATA_TYPE] in the Client App.

TABLE SPECIFICATIONS:
Columns:
- [Col 1]: [Type], sortable, filterable
- [Col 2]: [Type], sortable

Data Source:
- Supabase table: `[table_name]`
- Expected volume: [Low < 1000 | High > 1000]

FEATURES:
- Client-side sorting/filtering (or server-side if High volume).
- Loading skeleton rows while Supabase fetches.
- Empty state UI if 0 rows returned.
- Row actions: [View | Edit | Delete]

PROVIDE:
1. TypeScript interface for the row data.
2. Column definitions (TanStack Table).
3. The main Table component leveraging shadcn/ui styling.
```

---

## **PART 3: THE 7-PHASE INCREMENTAL BUILD CYCLE**
*(Repeat this conversational loop with the AI for complex features)*

1. **DESIGN & SPEC**: Describe purpose, data needed, and permissions. Ask AI to find flaws.
2. **DATABASE LAYER**: Determine if Supabase table, RPC, or RLS update is needed.
3. **TYPE DEFINITIONS**: Tell AI to generate strict TypeScript interfaces for the Postgres schema.
4. **SERVICE LAYER**: Build/Update the Supabase custom hook (`src/hooks/use[Feature].ts`).
5. **UI COMPONENTS**: Build the React skeleton, handling Loading, Empty, and Error states first.
6. **STATE WIRING**: Connect the Supabase hook or Zustand store to the UI components.
7. **REFINEMENT**: Prompt AI to handle edge cases, fix Tailwind styling, or implement debouncing.
