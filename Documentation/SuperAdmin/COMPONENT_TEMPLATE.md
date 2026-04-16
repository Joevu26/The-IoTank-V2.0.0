# IoTank Super Admin Console - Component Specification Template

> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This compilation of standards is part of the project's "memory card". When building new features for the Governance Console, align with this shared architecture.

## 1. Administrative Component Structure

### State & Data Hook Configuration

- **Server State**: Use the `@shared` service layer or admin-specific services in `super Admin/src/services/`.
- **RBAC Enforcement**: Actions MUST check for Level 1-4 permissions.

### Prop Discipline

```typescript
interface [ComponentName]Props {
  stationId?: string; // Target station for administrative action
  systemUserId: string; // The admin performing the action
}
```

## 2. Security & Audit Requirements

- **Admin Logging**: Every administrative action MUST be recorded in the `audit_logs` table.
- **RPC Usage**: For any modification of client data (tanks, debt, status), use the secure `admin_` RPC suite to bypass client-layer RLS correctly.

## 3. UI/UX Consistency

- **Data Density**: Admin views should be optimized for information density (DataTable, Condensed Cards).
- **Confirmation Flows**: Any destructive or financial action (Suspend Station, Adjust Debt) MUST require a confirmation dialog with a reason field.

---

## **AI PROMPTING FRAMEWORK**

### **Universal Admin developer Prompt**

```markdown
ROLE: Senior Admin Dashboard Engineer.

CONTEXT:
Building a feature for the IoTank Super Admin Console.
Auth Layer: system_users (Levels 1-4).

TASK:
[Describe admin task].

REQUIREMENTS:
1. Interaction: Execute task via `admin_` Supabase RPC.
2. Forensic: Log the exact changes made to `audit_logs`.
3. UX: Include a confirmation modal for the action.
4. Logic: Ensure the action correctly handles station-layer isolation if targeting a specific station.
```

---
**Last Updated**: April 14, 2026
