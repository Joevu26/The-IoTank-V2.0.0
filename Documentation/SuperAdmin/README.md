# IoTank Governance Console (Super Admin) - Documentation Root

Welcome to the technical documentation for the Super Admin platform.

## 📁 Related Documents

- **[Technical Specification](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/SuperAdmin/PROJECT_SPEC.md)**: Admin-specific architecture and RPC suites.
- **[Component Template](file:///c:/Users/josep/Documents/The%20IoTank%20V2.0.0/Documentation/SuperAdmin/COMPONENT_TEMPLATE.md)**: Standards for building administrative features.

## 🚀 Purpose

The Super Admin Console (Governance Console) serves as the control room for the IoTank ecosystem. It is responsible for:

1. **Station Onboarding**: Approving `pending_registrations`.
2. **Global Monitoring**: Tracking health and connectivity across all client stations.
3. **Fiscal Control**: Managing station standing, debt, and credit limits.
4. **Security Auditing**: Reviewing the global forensic stream (`unified_events`) and admin change logs (`audit_logs`).

## 🛠️ Tech Stack & Aliases

- **Core**: React 18, TypeScript, Vite.
- **Backend**: Supabase (utilizing `service_role` equivalent access via secure RPCs).
- **Shared Access**: The console uses the `@shared` alias to reference root `src/` modules, ensuring identity and data logic consistency.

---
**Last Updated**: April 14, 2026
