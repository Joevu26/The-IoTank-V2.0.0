# IoTank Super Admin Console - Technical Specification

> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This document is the project's "memory card". Because AI assistants have context windows, this document provides the necessary architectural context across sessions. It **MUST be continuously updated** whenever there are structural, architectural, or significant database schema changes. You must read and follow these specifications before beginning development tasks.


## 1. Architecture Overview
- **Frontend Core**: React 18 + TypeScript + Vite
- **Styling**: Vanilla CSS + Tailwind CSS + shadcn/ui components
- **State Management**: **Zustand** (Unified state management for the platform)
- **Database**: Supabase PostgreSQL (Relational)
- **Authentication**: **Supabase Auth** (Unified authentication layer)
- **Shared Code Alias**: `@shared` points to `../src`.
- **Hosting**: Firebase Hosting

## 2. Admin Security & RBAC Hierarchy
The Super Admin console handles the higher tiers of the 7-level hierarchy (Levels 1-4):
- **Level 1: Super Admin** (`super_admin`) - Full platform control, user management, and sensitive settings.
- **Level 2: Admin Helper** (`admin_helper`) - Team leads with operational management permissions.
- **Level 3: Support Staff** (`support_staff`) - Customer success team managing tickets and basic client help.
- **Level 4: Analyst** (`analyst`) - Read-only access to platform-wide analytics and logs.

### Admin Security Implementation
1. **Audit Logs**: All sensitive actions (debt adjustment, suspension, role changes) are recorded in the `audit_logs` table.
2. **System-Layer RLS**: Managed via the `system_users` and `admin_logs` tables.
3. **RPC Enforcement**: Critical administrative actions (e.g., `admin_adjust_client_debt`) are performed via secure PostgreSQL functions (RPCs) with built-in permission checks.

## 3. Database Schema (Admin-Specific)
- **`system_users`**: Administrative accounts linked to Supabase/Firebase Auth.
- **`audit_logs`**: Detailed record of all administrative actions and system events.
- **`support_tickets`**: Management of client support requests and communications.
- **`pending_registrations`**: Workflow for new client onboarding and station provisioning.
- **`client_billing` (Full Access)**: Advanced control over client debt, status, and subscriptions.
- **`tanks` (Full Access)**: Administrative override and management of all tanks across the platform.

## 4. Admin Service Layer (`super Admin/src/services/`)
- **`dashboardService`**: Platform-wide metrics calculation (MRR, ARR, active tanks, health).
- **`clientsService`**: Detailed client management, debt adjustment, and account suspension.
- **`communicationService`**: Announcements and notifications to clients (Email, SMS, Banner).
- **`supportService`**: Ticket lifecycle management and internal routing.
- **`hardwareService`**: Monitoring of sensor connectivity and health across all sites.

## 5. Naming Conventions & Project Standards
- **Components**: PascalCase (e.g., `ClientDetails.tsx`)
- **Functions**: camelCase (e.g., `suspendClient`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Database Tables**: snake_case (e.g., `system_users`)
- **File Structure**:
    - `super Admin/src/components/`: Admin-specific UI components.
    - `super Admin/src/services/`: Admin-specific business logic.
    - `super Admin/src/pages/`: Page-level components.
    - `super Admin/src/contexts/`: Admin-specific contexts (Auth, Theme).

---
*This document serves as the source of truth for the IoTank Super Admin Console development.*
