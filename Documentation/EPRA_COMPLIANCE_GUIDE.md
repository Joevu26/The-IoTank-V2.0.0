# EPRA Compliance Packing & Reconciliation Guide

This document explains how the IoTank platform handles **Energy and Petroleum Regulatory Authority (EPRA)** standards for inventory reconciliation and digital audit trails.

## 1. The Compliance Pack

Station admins can generate a **Compliance Pack** (90-day window) designed for regulatory submission. This document includes:
- **Facility Overview**: Throughput stats, active tank count, and incident count.
- **Daily Operations Log**: Opening/Closing volumes vs. measured sales and deliveries.
- **Recalculated Variance**: Calculated daily to identify hidden losses.

## 2. Inventory Reconciliation Equation

The platform enforces the standard forensic reconciliation logic:

`Final_Calculated = Opening_Dip + Deliveries_Verified - Sales_Reported`

- **Variance (L)**: `Closing_Dip - Final_Calculated`
- **Variance (%)**: `(Variance_L / Total_Throughput) * 100`

> [!IMPORTANT]
> **Regulatory Limit**: In most jurisdictions, a persistent variance of **> 0.5%** over a 30-day period triggers an automated compliance alert and requires forensic inspection.

## 3. Delivery Verification Audits

Every fuel delivery produces a **Tamper-Evident Delivery Audit PDF**.
- **Amethyst Theme**: Styled for clarity and authority.
- **Digital Witnessing**: Captures the exact timestamp and operator identity during the "Refill Identified" event.
- **Variance Analysis**: Comparison between Waybill (Invoice) and Sensor (Measured) volumes.

## 4. Record Immutability

- **Transactions**: Once a sale or adjustment is recorded, it enters an immutable ledger.
- **Unified Events**: Any attempt to "Retire" or "Delete" a forensic record is itself logged in the master audit stream.
- **Security Definer Functions**: Critical reconciliation math is performed server-side via RPC to prevent client-side manipulation of totals.

---
**Last Updated**: April 14, 2026
