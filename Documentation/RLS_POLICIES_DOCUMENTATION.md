# Row-Level Security (RLS) Policy Documentation

## Overview
This document details the RLS policies implemented in the IoTank V2 system to ensure multi-tenant isolation and role-based access control.

---

## Authentication Levels
Refer to `PROJECT_SPEC.md` for the full 8-level hierarchy description.

---

## Core Security Functions

### `get_station_id_from_auth()`
**Purpose**: Securely retrieves the current user's `station_id` from their profile.
**Security Tier**: `SECURITY DEFINER` (executes with database owner privileges).
**Usage**: The primary filter for all organization-owned records.

### `is_admin()`
**Purpose**: Checks if the `auth.uid()` exists in the `system_users` table with an active admin role (Levels 1-4).
**Usage**: Allows platform oversight bypass.

---

## Data Access Policies by Table

### `fuel_stations` (Core Organization)
**RLS**: Enabled.
- **SELECT**: Users can only see their own station record where `id = get_station_id_from_auth()`.
- **INSERT/UPDATE**: Highly restricted to System Admins (Levels 1-2).

### `tanks` & `sites`
**RLS**: Enabled.
- **SELECT**: Filtered by `station_id = get_station_id_from_auth()`.
- **Operators (Level 7)**: Restricted to tanks/sites listed in their `profiles.site_ids` array.

### `sensor_readings`
**RLS**: Enabled.
- **SELECT**: Access granted if the linked `tank_id` belongs to the user's `station_id`.
- **INSERT**: Device keys only or specific device-role identities.

### `unified_events` (Forensic Stream)
**RLS**: Enabled.
- **SELECT**: Organization members can view events where `station_id = get_station_id_from_auth()`.
- **INSERT**: All authenticated actions trigger a log, but direct INSERT is restricted.

### `device_commands`
**RLS**: Enabled.
- **SELECT**: Viewable by Station Admins/Supervisors.
- **INSERT**: Restricted to Level 6 (Supervisor) or higher.

---

## Privileged Operations (RPC)

Critical actions bypass RLS via `SECURITY DEFINER` logic but implement internal permission checks:

1. **`get_station_dashboard_summary(UUID)`**: Aggregates identity and station data in a single transactional call.
2. **`admin_adjust_station_debt(...)`**: Requires Level 1 or 2 system access.
3. **`admin_suspend_station(...)`**: Global suspension capability for administrators.

---

## Policy Versions

| Version | Date | Changes |
|---------|------|---------|
| 1.3 | 2026-04-14 | **Major Refactor**: Transitioned from `client_id` to `station_id` and added `DeviceCommand` isolation. |

---
**Last Updated**: April 14, 2026
