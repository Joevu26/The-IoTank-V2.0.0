# IoTank Fuel Intelligence Hub - Technical Specification (Client App)

> **CRITICAL INSTRUCTION FOR AI ASSISTANTS**: This document is the project's "memory card". Because AI assistants have context windows, this document provides the necessary architectural context across sessions. It **MUST be continuously updated** whenever there are structural, architectural, or significant database schema changes. You must read and follow these specifications before beginning development tasks.


## 1. Architecture Overview
- **Frontend Core**: React 18 + TypeScript + Vite
- **Styling**: Vanilla CSS + Tailwind CSS + shadcn/ui components
- **State Management**: **Zustand** (Standardized state management for the platform)
- **Database**: Supabase PostgreSQL (Relational)
- **Authentication**: **Supabase Auth** (Unified authentication layer)
- **API Layer**: Supabase Client (JS/TS SDK)
- **Hosting**: Firebase Hosting
- **Real-time Engine**: Supabase Real-time (Postgres Changes) for live tank monitoring.

## 2. Shared Code Structure (@shared)
The project utilizes a shared architecture where the Super Admin console references the root `src` directory via the `@shared` alias. This ensures consistency in:
- Types and Interfaces
- UI Components (Common)
- Service Engines (AI, Alerts, Analytics)

## 3. Security & RBAC Hierarchy
The system implements a unified 7-level hierarchy (Levels 1-7). The Client App specifically handles Levels 5-8:
- **Level 5: Station Admin/Owner** (`admin`/`owner`) - Full control over the organization's settings, users, and billing.
- **Level 6: Station Supervisor** (`supervisor`) - Operational access to multiple/all sites within the organization.
- **Level 7: Station Operator** (`operator`) - Limited access to assigned sites and day-to-day tank monitoring.
- **Level 8: Viewer** (`viewer`) - Read-only access for auditors or analysts.

### Security Implementation
1. **Row Level Security (RLS)**: Enforced at the Supabase layer to ensure data isolation between organizations.
2. **JWT Validation**: All requests are authenticated via Supabase JWTs.
3. **Master Password**: Secondary verification layer for sensitive settings (Legacy path, transitioning to re-auth).

## 4. Database Schema (Core Tables)
- **`client_billing`**: Organization metadata, subscription status, and debt tracking.
- **`sites`**: Multi-location mapping for client operations.
- **`tanks`**: Physical configuration, dimensions (height, radius), and sensor calibration.
- **`profiles`**: User management linked to `supabase_uid` and `client_id`.
- **`sensor_readings`**: High-frequency time-series data (distance, temperature, volume).
- **`alerts`**: System-generated events with severity levels (`info`, `warning`, `critical`).
- **`transactions`**: Immutable ledger for subscription fees and manual adjustments.
- **`deliveries`**: Digital BOL tracking for fuel delivery verification.
- **`shift_closures`**: Operational reconciliation records for pump readings.

## 5. Intelligence Engines (`src/services/`)
- **AlertDetectionEngine**: Deterministic and AI-assisted anomaly detection.
- **MarketIntelligence**: Tracking fuel price cycles and regulatory notices.
- **GeminiAI**: Providing procurement recommendations and sustainability insights.

## 6. Naming Conventions & Best Practices
- **Components**: PascalCase (e.g., `TankCard.tsx`)
- **Functions/Hooks**: camelCase (e.g., `useTanks`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- **Database**: snake_case (e.g., `last_reading_at`)
- **File Structure**:
    - `src/components/`: Feature-grouped UI components.
    - `src/hooks/`: Supabase and functional hooks.
    - `src/services/`: Business logic and processing engines.
    - `src/types/`: Centralized TypeScript definitions (`index.ts`).
    - `src/lib/`: Low-level utilities (math, formatting).

---
*This document serves as the source of truth for the IoTank Client Application development.*
