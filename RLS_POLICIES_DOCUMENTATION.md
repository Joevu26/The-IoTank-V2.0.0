# Row-Level Security (RLS) Policy Documentation

## Overview
This document provides a comprehensive reference for all Row-Level Security policies implemented in the IoTank V2 system. RLS policies control data access at the database row level based on the user's authentication status, role, and organization.

---

## Authentication Levels

### System Tier (Platform Administration)
- **Level 1**: `super_admin` - Platform owner (full access)
- **Level 2**: `admin_helper` - Team leads  
- **Level 3**: `support_staff` - Customer support team
- **Level 4**: `analyst` - Read-only platform analysis

### Client Tier (Station Users)
- **Level 5**: `owner` - Station manager (full control)
- **Level 6**: `supervisor` - Operational oversight
- **Level 7**: `operator` - Tank-specific monitoring
- **Level 8**: `viewer` - Read-only access

---

## Core Functions

### `get_auth_level()`
**Purpose**: Maps user role to numeric auth level (1-8)
**Usage**: Referenced in all access control checks
**Priority**: 
1. Check `system_users` table for system admin role
2. Check `profiles` table for client user role  
3. Default to level 8 (viewer) if not found

### `get_user_client_id()`
**Purpose**: Returns organization UUID for current user
**Usage**: Filters all organization-scoped data access
**Return Value**: UUID of `client_billing` record, or NULL for system admins

### `is_system_admin(required_level TEXT)`
**Purpose**: Verify if user is a system admin at required level or higher
**Example**: `is_system_admin('support_staff')` allows level 1-3 users
**Returns**: Boolean

### `has_client_access(required_level INTEGER)`
**Purpose**: Verify if user is a client tier user at required level or higher
**Example**: `has_client_access(6)` allows supervisors and owners only
**Returns**: Boolean

---

## Data Access Policies by Table

### `tanks`
**Ownership**: Belongs to organization (`client_id`)
**Operators**: May be assigned specific tanks via `site_ids`

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ All | ✓ Any org | ✓ Any org | ✓ Any org |
| Owner (5) | ✓ Own org | ✓ Own org | ✓ Own org | ✗ No |
| Supervisor (6) | ✓ Own org | ✗ No | ✗ No | ✗ No |
| Operator (7) | ✓ Assigned only | ✗ No | ✗ No | ✗ No |
| Viewer (8) | ✓ Assigned only | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- System admins bypass all filters
WHERE get_auth_level() <= 4

-- Client users access by organization
WHERE client_id = get_user_client_id()
  AND (get_auth_level() < 7 OR auth.uid() = ANY(site_ids))
```

**Special Rules**:
- Operators (level 7) only see tanks listed in their `site_ids` array
- Operators cannot create new tanks
- Supervisors can view but not modify

---

### `sensor_readings`
**Ownership**: Linked via `tank_id` → `tanks.client_id`
**Scope**: Transitive access through tanks table

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ All | ✓ Any org | ✗ Limited | ✗ Limited |
| Owner (5) | ✓ Own org | ✗ Device only | ✗ Limited | ✗ No |
| Supervisor (6) | ✓ Own org | ✓ Any | ✓ Recent | ✗ No |
| Operator (7) | ✓ Assigned | ✓ Assigned tanks | ✗ No | ✗ No |
| Viewer (8) | ✓ Assigned | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- Access via tank scope
WHERE tank_id IN (
    SELECT id FROM tanks WHERE client_id = get_user_client_id()
)
```

**Special Rules**:
- Supervisors can backfill data within 7 days
- Device API access for IoT sensors (edge runtime)
- Sensor data immutable after 30 days

---

### `alerts`
**Ownership**: Linked via `tank_id` → `tanks.client_id`
**Scope**: Transitive access through tanks table

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ All | ✗ No | ✓ Any org | ✗ No |
| Owner (5) | ✓ Own org | ✗ No | ✓ Own org | ✗ No |
| Supervisor (6) | ✓ Own org | ✗ No | ✓ Own org | ✗ No |
| Operator (7) | ✓ Assigned | ✗ No | ✗ No | ✗ No |
| Viewer (8) | ✓ Assigned | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- View own organization alerts
WHERE tank_id IN (
    SELECT id FROM tanks WHERE client_id = get_user_client_id()
)
AND (get_auth_level() < 7 OR auth.uid() = ANY(tanks.site_ids))
```

---

### `client_billing`
**Ownership**: `id` = `client_id` in profiles
**Restriction**: Financial data - highly restricted

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ All | ✓ Yes | ✓ Yes | ✗ No |
| Owner (5) | ✓ Own only | ✗ No | ✓ Limited | ✗ No |
| Supervisor+ (6-8) | ✗ No | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- Owners access own billing record only
WHERE (get_auth_level() = 5 AND id = get_user_client_id())
   OR get_auth_level() <= 4  -- System admin bypass
```

**Special Rules**:
- Billing data never visible to operational staff
- Editable fields: contact_name, contact_phone, contact_email
- Sensitive fields locked: pricing_tier, account_balance

---

### `transactions`
**Ownership**: `client_id` reference
**Restriction**: Financial audit trail - immutable

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ All | ✓ System only | ✗ No | ✗ No |
| Owner (5) | ✓ Own only | ✗ No | ✗ No | ✗ No |
| Supervisor+ (6-8) | ✗ No | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- Strict coupling to organization
WHERE client_id = get_user_client_id()
   OR get_auth_level() <= 4
```

**Special Rules**:
- Transaction inserts only via functions (not direct insert)
- Immutable after creation (no updates/deletes)
- System admins can view all transaction history

---

### `usage_logs`
**Ownership**: `client_id` reference
**Base Access**: Supervisors and above

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ All | ✓ Any org | ✗ Limited | ✗ No |
| Owner (5) | ✓ Own org | ✗ No | ✗ No | ✗ No |
| Supervisor (6) | ✓ Own org | ✓ Own org | ✗ No | ✗ No |
| Operator+ (7-8) | ✗ No | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- Organization-scoped
WHERE client_id = get_user_client_id()
   AND get_auth_level() <= 6  -- Supervisor or higher
```

---

### `profiles` (Client Users)
**Ownership**: `client_id` reference
**Public Fields**: name, role (limited context only)

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ All | ✓ Any org | ✓ Any org | ✓ Any org |
| Owner (5) | ✓ Own org | ✗ No | ✓ Limited | ✗ No |
| Supervisor (6) | ✓ Own org | ✗ No | ✗ No | ✗ No |
| Operator+ (7-8) | ✓ Own org | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- Organization members can view own org staff
WHERE client_id = get_user_client_id()
   OR get_auth_level() <= 4  -- System admin bypass
```

**Special Rules**:
- Owners can update limited fields: full_name, phone
- Role changes only via system admin function
- Email immutable (system constraint)

---

### `system_users` (Admin Users)
**Ownership**: N/A - System scope
**Restriction**: System admins only

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (1-4) | ✓ Level dependent | ✓ Level 1 only | ✓ Level 1 only | ✓ Level 1 only |
| Client User (5-8) | ✗ No | ✗ No | ✗ No | ✗ No |

**Policies**:
```sql
-- Level 1 (super_admin) can manage all system users
-- Level 2-4 see limited system user info only
WHERE get_auth_level() <= 4
```

**Special Rules**:
- Only super_admin (level 1) can create/delete system users
- Admin helpers cannot remove super admin
- Password field never visible in SELECT

---

### `pending_registrations`
**Ownership**: System-scoped
**Public Access**: INSERT only by anonymous/unauthenticated

| User Type | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| System Admin (3+) | ✓ All | ✓ System | ✓ All | ✗ No |
| Client User (5-8) | ✗ No | ✗ No | ✗ No | ✗ No |
| Anonymous | ✗ No | ✓ Pending only | ✗ No | ✗ No |

**Policies**:
```sql
-- Anonymous can only insert new pending registrations
ON INSERT WITH CHECK (status = 'pending')

-- System admins manage all registrations
FOR ALL USING (is_system_admin('support_staff'))
```

**Special Rules**:
- Status values: `pending`, `contacted`, `approved`, `rejected`
- Admins can flag as `contacted` after phone call
- Email verification required before approval (future enhancement)

---

## Access Control Hierarchy

```
┌─ System Admin (Level 1-4)
│  └─ Full database access with audit logging
│
├─ Organization Owner (Level 5)
│  └─ Own organization data + billing
│
├─ Supervisor (Level 6)
│  └─ Own organization operational data
│
├─ Operator (Level 7)
│  └─ Assigned tanks and readings only
│
└─ Viewer (Level 8)
   └─ Read-only assigned data
```

---

## Function-Based Access Control (SECURITY DEFINER)

Functions with `SECURITY DEFINER` privilege run with the function creator's permissions:

### `admin_adjust_client_debt()`
- **Permission Level**: System Admin (1-4) only
- **Action**: Modify outstanding balance for organization
- **Auditing**: All changes logged to admin_logs
- **Security**: 
  - Input validation on amount (must be positive)
  - Reversal requires admin review

### `approve_pending_registration()`
- **Permission Level**: Support Staff (3+)
- **Action**: Approve client registration request
- **Side Effects**: Triggers account provisioning
- **Auditing**: Logs approval with admin email and timestamp

---

## Troubleshooting Common Access Issues

### "Permission denied" on SELECT
**Cause**: User doesn't match organization filter
**Solution**: 
1. Verify `client_id` matches in both user profile and data record
2. Check `get_auth_level()` returns expected level
3. Review RLS policies for table using `SELECT * FROM information_schema.table_constraints`

### "Failed to verify row security policy"
**Cause**: Policy logic error or NULL comparison
**Solution**:
1. Check that `auth.uid()` returns valid UUID
2. Verify function like `get_user_client_id()` doesn't return NULL unexpectedly
3. Test policy with `SET LOCAL` option

### Operators cannot see assigned tanks
**Cause**: `site_ids` array doesn't contain user ID or tank assignment
**Solution**:
1. Verify user ID is in `profiles.site_ids` array
2. Check tank has matching `client_id`
3. Confirm array is not NULL (should be `'{}'` if empty)

---

## Best Practices

1. **Always filter by organization first** - Never rely on role alone
2. **Use the helper functions** - `get_auth_level()`, `get_user_client_id()`
3. **Never bypass RLS in code** - Use SECURITY DEFINER functions for privileged operations
4. **Log all admin actions** - Especially data modifications
5. **Test policies with different roles** - Before production deployment
6. **Review audit logs regularly** - Check for suspicious access patterns

---

## Policy Versions

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-18 | Initial implementation |
| 1.1 | 2026-03-24 | Added operator site_ids filtering |
| 1.2 | 2026-04-02 | Removed invitation_requests, consolidated auth functions |

---

**Last Updated**: April 2, 2026
**Maintained By**: Platform Engineering Team
