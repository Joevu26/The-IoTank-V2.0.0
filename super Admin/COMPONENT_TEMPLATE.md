> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This compilation of project standards and prompt templates is part of the project's "memory card". When starting a new session or component task for the IoTank Super Admin Console, review this document to ensure alignment with our chosen architecture (React, TypeScript, Supabase, Zustand, shadcn/ui, `@shared` alias).

# IoTank Super Admin Console - Component Specification Template

When building `[COMPONENT_NAME]`, follow this exact structure:

## 1. Component Purpose
[One sentence describing exactly what this component does in the context of the Super Admin Console]

## 2. Props Interface
```typescript
interface [ComponentName]Props {
  // List all props with strict TypeScript types
  // e.g., systemUserId: string;
}
```

## 3. State Requirements
- **Local state (`useState`)**: [list local variables, e.g., `isModalOpen`, `filterType`]
- **Global state (Zustand)**: [list Zustand stores needed, e.g., `useAdminStore`]
- **Data Fetching (Supabase)**: [list specific Supabase queries or services, e.g., `dashboardService.getPlatformStats()`]

## 4. Security Checks
- [ ] Admin-level RLS policy explicitly verified for the target table (e.g., `client_billing`, `audit_logs`)
- [ ] Input data validated/sanitized (using Zod where applicable)
- [ ] Client-side RBAC permission check before render (Levels 1-4 access check via `is_system_admin()`)
- [ ] Critical actions logged to `audit_logs`
- [ ] Wrapped in a React Error Boundary

## 5. Accessibility (A11y) Requirements
- [ ] ARIA labels applied to all interactive or icon-only elements
- [ ] Complete Keyboard navigation support (Tab, Enter, Spacebar)
- [ ] Focus management correctly implemented
- [ ] Tested for Screen Reader compatibility (WCAG AA standard)

## 6. Performance Optimization
- [ ] `React.memo` utilized if re-renders are computationally expensive
- [ ] Heavy administrative dashboard widgets are conditionally/lazy loaded
- [ ] Global search inputs implemented with debounce (e.g., 300ms)
- [ ] Long log/audit tables (>100 items) are virtualized or properly paginated

## 7. Error Handling
- [ ] `try-catch` blocks on all async administrative operations (Supabase calls)
- [ ] Precise error messages (e.g., failed to suspend client due to active shifts) via toast
- [ ] Graceful fallback UI provided for widget error states
- [ ] Errors logged to console/monitoring

## 8. Testing Checklist
- [ ] **Happy path**: Component renders administrative data successfully
- [ ] **Edge cases**: Handles no data, loading states, and failed Supabase connections
- [ ] **User interactions**: Modals, forms, and destructive actions (e.g., Delete Client) work with confirmation flows
- [ ] **Permission tests**: Enforces visibility properly between `super_admin`, `admin_helper`, and `support_staff`

---

## **PART 2: AI PROMPTING FRAMEWORK (The Secret Sauce)**

### **Universal Prompt Structure for EVERY Coding Request**
```markdown
ROLE: You are a senior full-stack developer with 10+ years of experience in React 18, TypeScript, Supabase (PostgreSQL), Zustand, and enterprise SaaS building.

CONTEXT:
I'm building a component for the IoTank Super Admin Console. We use Supabase Auth, Supabase Database with strict admin-layer RLS, and Tailwind CSS. The Super Admin relies heavily on RPC functions to bypass client RLS policies safely.
[Paste relevant section from `super Admin/PROJECT_SPEC.md` showing admin schemas]

TASK:
Build the [COMPONENT_NAME] component for the [PAGE/FEATURE_NAME].

REQUIREMENTS:
1. Functionality:
   - [List 2-4 specific features]
   - [Include expected administrative behavior]

2. Data Flow:
   - Fetch data from: [Supabase admin table/RPC name]
   - State management: [useState or Zustand store name]
   - Action must log to `audit_logs` if mutative.

3. Security:
   - Rely on Supabase RPC `admin_[action]` if dealing with client-level tables.
   - Check Super Admin hierarchy level: [Levels 1-4]

4. UI/UX:
   - Utilize existing shadcn/ui components (e.g., Card, Dialog, DataTable)
   - Style exclusively with Tailwind CSS utility classes
   - Match existing Super Admin dashboard aesthetics (professional, dense-data capable)
   - Responsive across tablet and desktop (mobile secondary for Admin)

5. TypeScript:
   - Strict mode enabled.
   - Import types from `@shared/types` where applicable.
   - DO NOT USE `any`.

6. Code Quality:
   - Component maximum lines: ~200. Break into smaller sub-components if larger.
```

---

### **Prompt Templates for Common Tasks**

#### **A. Building a New Administrative Feature**
```markdown
TASK: Create the [FEATURE_NAME] functionality for the Super Admin Console.

CONTEXT:
- This feature allows admins to [describe action, e.g., adjust client debt].
- Only users with role `[Required Role, e.g., super_admin]` can execute this.
- Data mutates Supabase table: [Table Name]

STRUCTURE:
1. Supabase RPC Function (if SQL transaction required)
2. Admin Service File (super Admin/src/services/[Feature]Service.ts)
3. React Interface/Modal Component

STEP-BY-STEP IMPLEMENTATION:
1. Write the Supabase RPC (PL/pgSQL) ensuring security definer logic.
2. Write the TypeScript service method to call the RPC.
3. Build the UI Component skeleton with loading/error handling.
4. Wire the service method to the UI actions.

PROVIDE CODE FOR STEP [NUMBER] ONLY. We will build incrementally.
```

#### **B. Building Admin Data Tables**
```markdown
TASK: Create an admin data table for [DATA_TYPE] (e.g., Audit Logs).

TABLE SPECIFICATIONS:
Columns:
- [Col 1]: [Type], sortable, filterable
- [Col 2]: [Type], sortable

Data Source:
- Supabase table: `[table_name]`
- Expected volume: High (requires RPC or limit-based pagination)

FEATURES:
- Client-side or Server-side pagination.
- Loading skeleton rows while Supabase fetches.
- Administrative row actions with confirmation dialogs.

PROVIDE:
1. Standardized column definitions.
2. The Table component wired to fetching logic.
```

---

## **PART 3: THE 7-PHASE INCREMENTAL BUILD CYCLE**
*(Repeat this conversational loop with the AI for complex admin features)*

1. **DESIGN & SPEC**: Define purpose, verify if it crosses into Client-layer data (requiring RPCs).
2. **DATABASE LAYER**: Write secure Supabase PostgreSQL RPCs or update `system_users`/RBA roles.
3. **TYPE DEFINITIONS**: Tell AI to extend `@shared/types` or create admin-specific interfaces.
4. **SERVICE LAYER**: Build/Update the Admin Service class (`super Admin/src/services/` directory).
5. **UI COMPONENTS**: Build the React UI (Modals, Forms, Tables).
6. **STATE WIRING**: Connect the Admin Service to the React UI, ensuring loading/error handling is robust.
7. **REFINEMENT**: Prompt AI to handle error toasts, audit logging hooks, and styling edge cases.
