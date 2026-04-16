# IoTank Fuel Intelligence Hub v2.0.0

Cloud-native Industrial IoT fuel tank monitoring dashboard with AI analytics, designed to provide forensic-level accuracy and compliance reporting.

## 🚀 Key Features

- **Forensic Monitoring**: Real-time fuel levels with AI-assisted theft and leak detection.
- **Compliance Reporting**: Automated EPRA-style reconciliation and delivery auditing.
- **Shift-Aware Analytics**: Intelligent behavior analysis based on operational shift states.
- **Multi-Tenant Architecture**: 8-level RBAC hierarchy with total data isolation.
- **Two-Way IoT**: Remote hardware command and control system.

## 📖 Essential Documentation

All architectural and developer documentation has been moved to the **[Documentation/](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation)** folder:

- **[Technical Specification](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/PROJECT_SPEC.md)**: Core architecture and service logic.
- **[RLS & Security Documentation](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/RLS_POLICIES_DOCUMENTATION.md)**: Row-Level Security and access control.
- **[Forensic Theft Heuristics](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/FORENSIC_THEFT_DETECTION.md)**: Deep dive into anomaly detection.
- **[Compliance Guide](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/EPRA_COMPLIANCE_GUIDE.md)**: EPRA standards and reconciliation logic.
- **[Security QA Checklist](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/SECURITY_QA_CHECKLIST.md)**: Critical test cases.
- **[Super Admin Console Docs](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/SuperAdmin/README.md)**: Governance platform documentation.
- **[Design System Colors](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/design_system_colors.md)**: Visual identity standards.

## 🛠️ Technical Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS.
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Real-time).
- **State**: Zustand (UI State), TanStack Query (Server State).
- **Deployment**: Firebase Hosting.

## 🗄️ Core Database Schema (Station-Centric)

The system uses a unified **Station ID** for multi-tenancy:

| Table             | Relation     | Description                           |
| ----------------- | ------------ | ------------------------------------- |
| `fuel_stations`   | N/A          | Core organization/station record.     |
| `profiles`        | `station_id` | User association and RBAC level.      |
| `tanks`           | `station_id` | Physical asset tracking.              |
| `unified_events`  | `station_id` | Centralized forensic audit stream.    |
| `device_commands` | `station_id` | Remote hardware interaction log.      |

## 🛠️ Getting Started

1. **Install Dependencies**:

```bash
npm install
```

2. **Setup Environment**:
   Copy `.env.example` to `.env` and fill in your Supabase project credentials.
3. **Run Development Server**:

```bash
npm run dev
```

---
**Last Updated**: April 14, 2026
