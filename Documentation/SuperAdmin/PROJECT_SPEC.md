# IoTank Super Admin Console - Technical Specification

> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This document is the project's "memory card". Because AI assistants have context windows, this document provides the necessary architectural context across sessions. It **MUST be continuously updated** whenever there are structural, architectural, or significant database schema changes.

## 1. Architecture Overview

- **Frontend Core**: React 18 + TypeScript + Vite
- **Styling**: Vanilla CSS + Tailwind CSS + shadcn/ui components
- **State Management**: **Zustand**
- **Database**: Supabase PostgreSQL (Relational)
- **Authentication**: **Supabase Auth**
- **Shared Code Alias**: `@shared` points to `../src`.
- **Hosting**: Firebase Hosting (`the-admin-iotank`).

## 2. Admin Security & RBAC Hierarchy

The Super Admin console handles the higher tiers of the 8-level hierarchy:

- **Level 1: System Owner** (`super_admin`) - Full platform control.
- **Level 2: Team Lead** (`admin_helper`) - Operational management.
- **Level 3: Support Staff** (`support_staff`) - Registration and client support.
- **Level 4: Platform Analyst** (`analyst`) - Read-only platform analysis.

### Admin Security Implementation

1. **Audit Logs**: All administrative actions are recorded in the shared `audit_logs` table.
2. **System-Layer RLS**: Policies verify `auth_user_id` against the `system_users` table.
3. **RPC Enforcement**: Privileged operations (registration approval, debt adjustment) are performed via `SECURITY DEFINER` RPC functions in Supabase to bypass client-layer RLS.

## 3. Database Schema (Admin-Facing)

- **`system_users`**: Administrative accounts linked to Supabase Auth.
- **`audit_logs` / `admin_logs`**: Detailed record of administrative actions.
- **`pending_registrations`**: Workflow for new client onboarding.
- **`fuel_stations`**: Administrative management of organization standing and debt.
- **`tanks`**: Global visibility of all hardware assets.
- **`unified_events`**: Platform-wide forensic event stream.

## 4. Admin Service Layer (`super Admin/src/services/`)

- **`dashboardService`**: Platform-wide metrics calculation (MRR, active tanks, health).
- **`clientsService`**: Detailed client management, debt adjustment, and account suspension.
- **`registrationService`**: Approval workflow for `pending_registrations` via Supabase Edge Functions.

## 5. Naming Conventions

- **Shared Logic**: Always import types/hooks from `@shared` to ensure consistency with the Client App.
- **Security**: Never perform client-data mutations via direct SDK calls; use the defined `admin_` RPCs.

---
**Last Updated**: April 14, 2026
