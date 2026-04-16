# IoTank Fuel Intelligence Hub - Technical Specification (Client App)

> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This document is the project's "memory card". Because AI assistants have context windows, this document provides the necessary architectural context across sessions. It **MUST be continuously updated** whenever there are structural, architectural, or significant database schema changes.

## 1. Architecture Overview
- **Frontend Core**: React 18 + TypeScript + Vite
- **Styling**: Vanilla CSS + Tailwind UTILITY
- **State Management**: **Zustand** + **TanStack Query** (standardized server state)
- **Database**: Supabase PostgreSQL
- **Authentication**: **Supabase Auth** (Unified layer with MFA)
- **API Layer**: Supabase Client (JS/TS SDK) + RPC Functions
- **Hosting**: Firebase Hosting (Production Edge Delivery)
- **Real-time Engine**: Supabase Real-time (Postgres Changes)
- **Cloud Logic**: Supabase Edge Functions (Deno)

## 2. Multi-Tenancy & Identity
The platform is fully multi-tenant, centered around the **Station** entity.
- **Identity Unification**: All users are linked via `auth_user_id` (standardized from legacy `firebase_uid`).
- **Station Context**: Most data is partitioned by `station_id`.
- **Identity Handshake**: On login, `AuthContext` performs a handshake to verify the user's station association and permissions tier.

## 3. Security & RBAC Hierarchy
A unified 8-level hierarchy is enforced:
- **Level 1: System Owner** (`super_admin`) - Full platform control.
- **Level 2: Team Lead** (`admin_helper`) - Operational management.
- **Level 3: Support Staff** (`support_staff`) - Registration and client support.
- **Level 4: Analyst** (`analyst`) - Read-only platform analysis.
- **Level 5: Station Admin** (`admin`/`owner`) - Full control over the organization's station.
- **Level 6: Station Supervisor** (`supervisor`) - Operational oversight for station sites.
- **Level 7: Station Operator** (`operator`) - Monitoring of assigned sites/tanks.
- **Level 8: Viewer** (`viewer`) - Read-only access.

## 4. Database Schema (Primary Tables)
- **`fuel_stations`**: Core organization metadata (formerly `client_billing`).
- **`profiles`**: User management linked to `auth_user_id` and `station_id`.
- **`sites`**: Multi-location mapping for station operations.
- **`tanks`**: Physical configuration, dimensions, and calibration.
- **`sensor_readings`**: High-frequency time-series data.
- **`alerts`**: System-generated events with severity levels.
- **`unified_events`**: Centralized forensic event stream for auditing.
- **`device_commands`**: Two-way IoT bridge for remote hardware control.
- **`transactions`**: Immutable fiscal ledger.
- **`deliveries`**: Digital BOL tracking for reconciliation.
- **`shift_closures`**: Operational reconciliation records.

## 5. Service Engines (`src/services/`)
- **AlertDetectionEngine**: Forensic heuristics for theft (Open/Closed shifts) and telemetry gaps.
- **ExportService**: PDF/CSV generation including **EPRA Compliance Packs** and Delivery Audits.
- **DeviceCommandService**: Orchestrates hardware status changes and calibrations.
- **IntelligenceAIService**: Gemini-powered reconciliation and risk analysis.
- **AuditService**: Writes forensic logs to the `unified_events` stream.

## 6. Naming Conventions & Best Practices
- **DB Columns**: snake_case (always use `station_id` for organization links).
- **Functions**: camelCase.
- **Identity**: Always reference `auth_user_id` for forensic consistency.
- **Data Flow**: Use React Query for caching to minimize Supabase egress.

---
*Last Updated: April 14, 2026*
