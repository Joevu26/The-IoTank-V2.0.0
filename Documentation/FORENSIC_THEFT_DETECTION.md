# Forensic Theft & Anomaly Detection Heuristics

The IoTank platform implements advanced heuristics to detect fuel siphoning and delivery discrepancies. This document explains the logic used by the `AlertDetectionEngine`.

## 1. Shift-Aware Logic

Standard fuel monitoring often fails because it cannot distinguish between **Sales** and **Siphoning**. IoTank solves this by state-aware analysis:

### Closed Shift (Quieter Hours)
- **State**: The station manager has marked the shift as "Closed".
- **Default Logic**: Any drop in volume above the "Noise Floor" (5.0L) is an anomaly.
- **Alert Types**:
    - **THEFT_CLOSED**: Triggered by a rapid drop rate (> 100L/hr).
    - **LEAK_SUSPICION**: Triggered by a slow, persistent decline (> 2L/hr).

### Open Shift (Active Operations)
- **State**: Pumps are active and transactions are being processed.
- **Problem**: Drops are expected.
- **Heuristic**: **Parallel Pull Detection**. Standard terminal pumps have fixed physical capacities (e.g., 40-80 L/min).
- **Rule**: If `DropRate > (MaxPumpCapacity * NumActivePumps)`, a theft is occurring in parallel with sales.
- **Alert Type**: **THEFT_OPEN_PARALLEL**.

## 2. Telemetry Integrity

- **Telemetry Gaps**: If no reading is received within the user-defined window (default 30 min), the system assumes a sensor outage or tampering attempt.
- **Signal Quality**: Sensors reporting signal quality < 30% are flagged to prevent false "Anomaly" triggers caused by ultrasonic noise.

## 3. Delivery Variance Audit

- **Refill Detection**: Automated sensing of volume increases > 1% of capacity.
- **Reconciliation**: When a delivery is manually added (Digital BOL), the system compares the **Measured Inflow** vs. the **Invoiced Amount**.
- **Variance Analysis**:
    - `Variance = Measured - Invoiced`
    - High negative variance indicates short-delivery by the supplier.
    - High positive variance indicates possible sensor calibration drift or tank sludge accumulation.

## 4. Forecasting & Forensic Audit

The `AuditService` ensures all detection triggers are recorded in the `unified_events` table with the following metadata:
- `detectionMethod`: `deterministic` (for threshold breach) or `forensic` (for shift-aware heuristics).
- `aiConfidence`: A score from 0.0 to 1.0 indicating the likelihood of the anomaly being real vs. sensor noise.

---
**Last Updated**: April 14, 2026
