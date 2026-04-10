/**
 * IoTank Demo Data Seed Script
 * 
 * Seeds Firestore with a shared demo org (demo-org-001) so all logged-in
 * panelists see identical live data on their screens.
 *
 * Usage:
 *   node scripts/seedDemoData.mjs
 *
 * Requirements:
 *   - firebase-admin must be installed in /functions
 *   - Set GOOGLE_APPLICATION_CREDENTIALS env var OR run from a machine
 *     with Application Default Credentials (gcloud auth application-default login)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const PROJECT_ID = 'the-iotank-project';
const ORG_ID = 'demo-org-001';
const SITE_ID = 'site-A';
const NOW = Date.now();
const DAY = 86_400_000;

// ── INIT ──────────────────────────────────────────────────────────────────────
if (!getApps().length) {
    initializeApp({ projectId: PROJECT_ID });
}
const db = getFirestore();

// ── HELPERS ───────────────────────────────────────────────────────────────────
const batch = () => db.batch();

async function upsert(ref, data) {
    await ref.set(data, { merge: true });
    console.log(`  ✅  ${ref.path}`);
}

// ── SEED ──────────────────────────────────────────────────────────────────────
async function seed() {
    console.log('\n🌱  Seeding IoTank demo data into Firestore...\n');

    // 1. Organization
    await upsert(db.doc(`organizations/${ORG_ID}`), {
        id: ORG_ID,
        name: 'IoTank Demo Organization',
        industry: 'Petroleum Retail',
        country: 'Kenya',
        region: 'Nairobi',
        contactEmail: 'demo@iotank.co.ke',
        createdAt: NOW - 30 * DAY,
        subscriptionTier: 'professional',
    });

    // 2. Site
    await upsert(db.doc(`organizations/${ORG_ID}/sites/${SITE_ID}`), {
        id: SITE_ID,
        organizationId: ORG_ID,
        name: 'Nairobi Main Depot',
        address: 'Industrial Area, Nairobi, Kenya',
        gpsCoordinates: { latitude: -1.3082, longitude: 36.8448 },
        tankCount: 2,
        managerName: 'James Mwangi',
        contactPhone: '+254 722 000001',
    });

    // 3. Tanks
    const tanks = [
        {
            id: 'tank-001',
            organizationId: ORG_ID,
            siteId: SITE_ID,
            name: 'Diesel Storage 1',
            location: 'Main Depot - North Wing',
            fuelType: 'diesel',
            capacity: 15000,
            diameter: 250,
            height: 400,
            shape: 'cylinder',
            thermalCoefficient: 0.00084,
            density: 0.85,
            sensorOffset: 5,
            sensorHeight: 420,
            lowLevelThreshold: 20,
            highLevelThreshold: 90,
            criticalLevelThreshold: 10,
            rapidDefillThreshold: 50,
            leakageThreshold: 2,
            temperatureAlertThreshold: 45,
            leakDetectionSensitivity: 0.5,
            esp32Address: 'AA:BB:CC:DD:EE:01',
            isActive: true,
            createdAt: NOW - 30 * DAY,
            updatedAt: NOW - DAY,
            lastReadingTimestamp: NOW - 60_000,
        },
        {
            id: 'tank-002',
            organizationId: ORG_ID,
            siteId: SITE_ID,
            name: 'Gasoline Super',
            location: 'Main Depot - East Wing',
            fuelType: 'gasoline',
            capacity: 10000,
            diameter: 200,
            height: 350,
            shape: 'cylinder',
            thermalCoefficient: 0.00095,
            density: 0.74,
            sensorOffset: 5,
            sensorHeight: 370,
            lowLevelThreshold: 15,
            highLevelThreshold: 95,
            criticalLevelThreshold: 5,
            rapidDefillThreshold: 40,
            leakageThreshold: 1.5,
            temperatureAlertThreshold: 40,
            leakDetectionSensitivity: 0.3,
            esp32Address: 'AA:BB:CC:DD:EE:02',
            isActive: true,
            createdAt: NOW - 20 * DAY,
            updatedAt: NOW - 2 * DAY,
            lastReadingTimestamp: NOW - 45_000,
        }
    ];

    for (const t of tanks) {
        const { id, ...data } = t;
        await upsert(db.doc(`organizations/${ORG_ID}/tanks/${id}`), { id, ...data });
    }

    // 4. Latest Readings (what the dashboard shows live)
    const readings = [
        {
            id: 'r-latest-001',
            tankId: 'tank-001',
            timestamp: NOW - 60_000,         // 1 min ago
            rawDistance: 120,
            temperature: 24.2,
            fuelLevel: 85.4,
            volumeMeasured: 12810,
            volumeCorrected: 12795,
            volume: 12810,
            signalQuality: 98,
            batteryLevel: 95,
            deviceId: 'AA:BB:CC:DD:EE:01',
            processingLocation: 'edge',
            metadata: { probeStatus: 'HEALTHY', rssi: -42, firmwareVersion: '2.0.1-stable' }
        },
        {
            id: 'r-latest-002',
            tankId: 'tank-002',
            timestamp: NOW - 45_000,         // 45 sec ago
            rawDistance: 310,
            temperature: 28.5,
            fuelLevel: 12.5,
            volumeMeasured: 1250,
            volumeCorrected: 1245,
            volume: 1250,
            signalQuality: 85,
            batteryLevel: 80,
            deviceId: 'AA:BB:CC:DD:EE:02',
            processingLocation: 'cloud',
            metadata: { probeStatus: 'LOW-LEVEL-ALERT', rssi: -58, firmwareVersion: '2.0.1-stable' }
        }
    ];

    for (const r of readings) {
        const { id, ...data } = r;
        await upsert(db.doc(`organizations/${ORG_ID}/tanks/${r.tankId}/raw_readings/${id}`), { id, ...data });
    }

    // 5. Historical readings (30 data points per tank for charts)
    console.log('\n  Seeding historical readings...');
    const histBatch = db.batch();
    let histCount = 0;

    for (let i = 30; i >= 0; i--) {
        const ts = NOW - i * 3 * 60 * 60 * 1000; // Every 3 hours

        // Tank 001 - Diesel (gradually decreasing)
        const vol001 = Math.max(3000, 12810 - (30 - i) * 320 + Math.round(Math.random() * 100 - 50));
        const level001 = Number(((vol001 / 15000) * 100).toFixed(1));
        histBatch.set(db.doc(`organizations/${ORG_ID}/tanks/tank-001/raw_readings/h-001-${i}`), {
            id: `h-001-${i}`,
            tankId: 'tank-001',
            timestamp: ts,
            rawDistance: Number((420 - (level001 / 100) * 400).toFixed(1)),
            temperature: Number((23 + Math.random() * 3).toFixed(1)),
            fuelLevel: level001,
            volumeMeasured: vol001,
            volumeCorrected: Math.round(vol001 * 0.999),
            volume: vol001,
            signalQuality: Math.round(95 + Math.random() * 5),
            deviceId: 'AA:BB:CC:DD:EE:01',
            processingLocation: 'edge',
        });

        // Tank 002 - Gasoline (low and dropping faster)
        const vol002 = Math.max(500, 4200 - (30 - i) * 100 + Math.round(Math.random() * 80 - 40));
        const level002 = Number(((vol002 / 10000) * 100).toFixed(1));
        histBatch.set(db.doc(`organizations/${ORG_ID}/tanks/tank-002/raw_readings/h-002-${i}`), {
            id: `h-002-${i}`,
            tankId: 'tank-002',
            timestamp: ts,
            rawDistance: Number((370 - (level002 / 100) * 350).toFixed(1)),
            temperature: Number((27 + Math.random() * 3).toFixed(1)),
            fuelLevel: level002,
            volumeMeasured: vol002,
            volumeCorrected: Math.round(vol002 * 0.999),
            volume: vol002,
            signalQuality: Math.round(82 + Math.random() * 10),
            deviceId: 'AA:BB:CC:DD:EE:02',
            processingLocation: 'cloud',
        });
        histCount += 2;
    }
    await histBatch.commit();
    console.log(`  ✅  ${histCount} historical readings seeded`);

    // 6. Alerts
    const alerts = [
        {
            id: 'alert-001',
            tankId: 'tank-002',
            type: 'low-level',
            severity: 'warning',
            message: 'Low fuel level detected in Gasoline Super (12.5%). Estimated empty in 12 hours.',
            detectionMethod: 'deterministic',
            timestamp: NOW - 3_600_000,
            resolved: false,
            evidence: { dataPoints: [], aiExplanation: 'Consumption increased by 15% in last 4 hours.' }
        },
        {
            id: 'alert-002',
            tankId: 'tank-001',
            type: 'anomaly',
            severity: 'critical',
            message: 'Unusual nocturnal withdrawal detected between 2:00 AM - 4:00 AM. Verify site security.',
            detectionMethod: 'ai-assisted',
            timestamp: NOW - 7_200_000,
            resolved: false,
        },
        {
            id: 'alert-003',
            tankId: 'tank-001',
            type: 'refill',
            severity: 'info',
            message: 'Tank refilled — 4,250 L added at 08:42 AM.',
            detectionMethod: 'deterministic',
            timestamp: NOW - 2 * DAY,
            resolved: true,
            resolvedAt: NOW - 2 * DAY + 3_600_000,
        }
    ];

    for (const a of alerts) {
        const { id, ...data } = a;
        await upsert(db.doc(`organizations/${ORG_ID}/alerts/${id}`), { id, ...data });
    }

    console.log('\n✅  Seed complete! All data written to:\n');
    console.log(`   Firestore > organizations/${ORG_ID}\n`);
    console.log('   All logged-in users who share this org will see the same live data.\n');
}

seed().catch(err => {
    console.error('\n❌  Seed failed:', err);
    process.exit(1);
});
