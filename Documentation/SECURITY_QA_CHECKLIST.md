# Security & QA Test Case Checklist

This checklist focuses on verifying multi-tenant isolation, forensic auditing, and role-based access control within the IoTank V2 system.

## 1. Authentication & Multi-Tenancy
- [ ] **Handshake Validation**: Login with a user linked to `station_id` A.
    - *Expected*: `AuthContext` correctly resolves the `station_id` and blocks access to data from `station_id` B.
- [ ] **Identity Mutation**: Attempt to update `station_id` in `profiles` via the client API.
    - *Expected*: RLS blocks the update; `unified_events` logs an `IDENTITY_MUTATION_ATTEMPT`.
- [ ] **MFA Challenge**: Access "Admin Settings" or "Manage Users" with MFA enabled.
    - *Expected*: UI prompts for AAL2 elevation; action blocked if challenge fails.

## 2. Forensic Logic & Heuristics
- [ ] **Closed Shift Theft**: Simulate a 15L drop in `sensor_readings` while a shift is CLOSED.
    - *Expected*: `AlertDetectionEngine` triggers a CRITICAL `THEFT_CLOSED` alert within 60 seconds.
- [ ] **Parallel Pull (Open Shift)**: Simulate a discharge rate of 6000 L/hr.
    - *Expected*: Trigger `THEFT_OPEN_PARALLEL` alert because rate > physical pump capacity (default 4800 L/hr).
- [ ] **Telemetry Gap**: Stop readings for a specific tank for 45 minutes.
    - *Expected*: System triggers a WARNING `telemetry-gap` alert.

## 3. IoT & Device Commands
- [ ] **Unauthorized Command**: Attempt to send a `CALIBRATE` command as an Operator (Level 7).
    - *Expected*: RLS on `device_commands` blocks the INSERT; UI displays 403.
- [ ] **Command Tracking**: Send a valid command as a Supervisor (Level 6).
    - *Expected*: Record appears in `device_commands` with status `pending`; `localStorage` tracks the ID for persistence across refreshes.

## 4. Financial & Compliance Integrity
- [ ] **Delivery Variance**: Add a delivery record where Physical Invoiced value differs from Digital Measured value by > 5%.
    - *Expected*: Delivery status marked as `DISPUTED` or flagged in the Reconciliation report.
- [ ] **EPRA Reconciliation**: Generate a Compliance Pack for a period with manual sales adjustments.
    - *Expected*: PDF correctly balances Opening level + Deliveries - Sales = Closing level; variance identified.

## 5. Performance Stress
- [ ] **Real-time Ingestion**: Inject 100 readings/second via a simulated socket.
    - *Expected*: Supabase Real-time handles throttle; dashboard remains responsive.

---
**Last Updated**: April 14, 2026
