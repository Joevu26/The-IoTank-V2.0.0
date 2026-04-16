# IoTank Client App - Component Specification Template

> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This compilation of standards is part of the project's "memory card". When building new features, align with this React 18 / Supabase / TanStack Query / Zustand / Vanilla CSS architecture.

## 1. High-Fidelity Component Structure

When building `[COMPONENT_NAME]`, follow this exact structure:

### State & Data Hook Configuration
- **Server State (React Query)**: Use custom hooks for all Supabase interactions. Handle `isLoading`, `isError`, and `data` in the top-level component.
- **Global State (Zustand)**: Use for UI state (e.g., Modals, Filters) or shared auth context.
- **Local State**: Minimal use (e.g., form inputs, toggle states).

### Prop Discipline
```typescript
interface [ComponentName]Props {
  // Always use strict types. No 'any'.
  stationId: string;
  onMutationSuccess?: () => void;
}
```

## 2. Mandatory Security & Audit Patterns

- **Audit Logging**: Any mutation action (Create/Update/Delete) MUST call `AuditService.log()`.
  ```typescript
  // Example for a Tank update
  await AuditService.log('SYSTEM', 'UPDATE_TANK', stationId, `Updated calibration for ${tankName}`);
  ```
- **Permission Check**: Wrap sensitive actions or UI elements in a role check.
  ```typescript
  const { canSee } = useAuth();
  if (!canSee(6)) return null; // Supervisor level or higher
  ```

## 3. UI/UX Consistency
- **Styling**: Prefer Vanilla CSS modules or global theme variables (`theme.css`). Use Tailwind for one-off utility spacing.
- **States**: Every component MUST implement:
    1. **Loading Skeleton** (matching the final UI shape).
    2. **Empty State** (Clear prompt if no data exists).
    3. **Error Boundary Fallback** (Graceful crash recovery).

## 4. Performance Standards
- Use `React.memo` for components rendering heavy chart data.
- Debounce search inputs (300ms) before triggering Supabase queries.
- Virtualize lists with >100 rows using `react-window` or similar.

---

## **AI PROMPTING FRAMEWORK**

### **Universal senior developer Prompt**
```markdown
ROLE: Senior Full-Stack Engineer (React 18, Supabase Expert).

CONTEXT:
Building a [Feature] for the IoTank Station App. We use a Station-centric multi-tenant model.
Station ID reference: [station_id].

TASK:
[Describe task clearly].

REQUIREMENTS:
1. Data: Fetch from `[table_name]` via TanStack Query.
2. Forensic: Log mutations to `unified_events` via `AuditService`.
3. Security: Check for minimum RBAC Level [5-8].
4. UI: Match the "Industrial Glassmorphic" theme using `theme.css` variables.
5. Strict TS: No `any`. Strict interfaces for all Postgres responses.
```

---
**Last Updated**: April 14, 2026
