# Security & QA Test Case Checklist

## 1. Authentication & Authorization
- [ ] **Normal Case**: Login with valid credentials (verified email).
    - *Expected*: Success, redirected to dashboard.
- [ ] **Edge Case**: Login with valid credentials but unverified email (if registration requires verification).
    - *Expected*: Error or redirected to verification page. Enrichment should NOT occur.
- [ ] **Edge Case**: Use "Repair My Identity" with a verified email.
    - *Expected*: Profile successfully linked if unlinked.
- [ ] **Security Abuse**: Use "Repair My Identity" with an UNVERIFIED email matching another user.
    - *Expected*: Failure, enrichment blocked.
- [ ] **Unauthorized Access**: Try to access `/super-admin` as a Level 7 Operator.
    - *Expected*: Redirect to dashboard or 403.
- [ ] **Authorization Bypass**: Call `get_client_dashboard_summary` RPC with another user's `supabase_uid`.
    - *Expected*: SQL Exception: "Unauthorized: Access denied to other user's dashboard".
- [ ] **Data Leakage**: Query `tanks` table via API.
    - *Expected*: Only own organization's tanks are returned.

## 2. Injection Risks
- [ ] **SQL Injection**: Input `' OR '1'='1` in search fields or IDs.
    - *Expected*: No extra data leaked, input sanitized/parameterized by PostgREST.
- [ ] **API Injection**: Send malicious JSON payload to `process_payment`.
    - *Expected*: 400 Bad Request or validation error (e.g., negative amount blocked).

## 3. Data Integrity & Validation
- [ ] **Normal Case**: Process a valid payment within debt limit.
    - *Expected*: Debt decreased, transaction recorded.
- [ ] **Edge Case**: Process payment exactly equal to current debt.
    - *Expected*: Success, status becomes 'active'.
- [ ] **Failure Case**: Process payment exceeding current debt.
    - *Expected*: Exception: "Payment amount exceeds current debt".
- [ ] **Failure Case**: Process payment with negative amount.
    - *Expected*: Exception: "Payment amount must be positive".
- [ ] **Partial Data**: Submit site registration with missing name.
    - *Expected*: Validation error (400) or DB constraint violation.

## 4. Network & Stability (Simulated)
- [ ] **Network Failure**: Trigger an API call and disconnect network immediately.
    - *Expected*: UI shows graceful error message (e.g., "Connection lost"), no crash.
- [ ] **Rapid Repeated Actions**: Click "Process Payment" 5 times rapidly.
    - *Expected*: Only one request processed (idempotency or UI disabling), or rate limit hit.
- [ ] **Stale Data**: Update a tank while another user is also updating it.
    - *Expected*: One update succeeds, the other might fail or overwrite depending on concurrency strategy (check `updated_at`).

## 5. Performance Stress
- [ ] **High Frequency**: Generate 1000 sensor readings for one tank in 10 seconds.
    - *Expected*: System handles ingestion (Supabase Realtime should throttle or batch), DB triggers don't bottleneck.
- [ ] **Large Dataset**: Load dashboard for organization with 100+ tanks.
    - *Expected*: Page loads < 3s, data is paginated or efficiently fetched.

## 6. Security Abuse (Advanced)
- [ ] **Role Escalation**: Attempt to update own role to 'admin' via `supabase.from('profiles').update({ role: 'admin' })`.
    - *Expected*: RLS/Constraints block this (only admins/triggers can change roles).
- [ ] **Tenant Hopping**: Attempt to change `client_id` of a tank to another organization's ID.
    - *Expected*: RLS blocks update if user doesn't own target `client_id` (or all updates to `client_id` are blocked for users).
