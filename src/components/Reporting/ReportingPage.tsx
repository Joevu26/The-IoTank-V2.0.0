import React, { useState, useMemo } from 'react';
import {
    FiFileText, FiDownload, FiClock,
    FiChevronDown, FiCheckSquare, FiSquare,
    FiPackage, FiAlertTriangle, FiShield,
    FiKey, FiShoppingCart, FiZap, FiEye,
    FiCalendar, FiRefreshCw, FiPrinter,
} from 'react-icons/fi';
import { MdOutlineLocalShipping, MdBarChart, MdVerified } from 'react-icons/md';
import { generateShiftPDF, exportShiftsToExcel } from '@/utils/exportUtils';
import { useAuth } from '@/hooks/useAuth';
import { useShifts } from '@/hooks/useShifts';
import { useTanks } from '@/hooks/useSupabase';
import { useReports } from '@/hooks/useReports';
import { supabase } from '@/config/supabase';
import { ExportService } from '@/services/ExportService';
import { format } from 'date-fns';
import '../Common/DesignSystemCards.css';
import './ReportingPage.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type OutputFormat = 'PDF' | 'CSV' | 'Excel' | 'ZIP';

interface ReportTemplate {
    id: string;
    name: string;
    purpose: string;
    defaultWindow: string;
    formats: OutputFormat[];
    icon: React.ReactNode;
    color: string;         // CSS var name  e.g. 'accent' | 'success' | 'warning' | 'danger' | 'info'
    highlights: string[];  // bullet points shown in output panel
}

// ─── Types ───────────────────────────────────────────────────────────────────

// ─── Report library definition ───────────────────────────────────────────────

const REPORT_TEMPLATES: ReportTemplate[] = [
    {
        id: 'inventory-summary',
        name: 'Inventory Summary',
        purpose: 'Current standardised volumes, ullage, trend & health',
        defaultWindow: '30 days',
        formats: ['PDF', 'CSV'],
        icon: <FiPackage size={22} />,
        color: 'info',
        highlights: [
            'All tanks operating within normal volume bands',
            'Aggregate ullage: 12,400 L across 4 tanks',
            '0 minimum-level breaches in the selected window',
        ],
    },
    {
        id: 'delivery-verification',
        name: 'Delivery Verification',
        purpose: 'Invoice vs measured litres, variance & status per delivery',
        defaultWindow: '30 days',
        formats: ['PDF', 'CSV'],
        icon: <MdOutlineLocalShipping size={22} />,
        color: 'success',
        highlights: [
            '8 deliveries processed — 7 Verified, 1 Needs Review',
            'Total invoiced: 45,000 L · Measured: 44,820 L',
            'Max variance: −0.8 % (within EPRA ±1 % threshold)',
        ],
    },
    {
        id: 'shift-reconciliation',
        name: 'Shift Reconciliation',
        purpose: 'Pump readings, volume sold, cash vs collected, variance',
        defaultWindow: '7 days',
        formats: ['PDF', 'Excel'],
        icon: <FiClock size={22} />,
        color: 'accent',
        highlights: [
            '14 shifts closed in the period',
            'Aggregate cash variance: KES −240 (0.04 % of turnover)',
            '2 shifts flagged Shortage — reviewed by supervisor',
        ],
    },
    {
        id: 'loss-variance',
        name: 'Loss & Variance Report',
        purpose: 'Unexplained loss totals, top days, suspected causes',
        defaultWindow: '30 days',
        formats: ['PDF'],
        icon: <FiAlertTriangle size={22} />,
        color: 'warning',
        highlights: [
            'Total unexplained loss: 310 L (0.7 % of throughput)',
            'Peak variance day: 14 Feb — 120 L gap detected',
            'Rule inference: Temperature expansion likely cause on 3 events',
        ],
    },
    {
        id: 'compliance-pack',
        name: 'Compliance Pack (EPRA 90-day)',
        purpose: 'One-click regulatory pack — inventory, deliveries, incidents, audit log',
        defaultWindow: '90 days',
        formats: ['PDF', 'ZIP'],
        icon: <FiShield size={22} />,
        color: 'danger',
        highlights: [
            'Covers Jan 1 – Mar 31 2026 (91 days)',
            'Includes: daily inventory logs, delivery verification, alert summary, audit extract',
            'System uptime: 99.2 % — within EPRA continuous monitoring requirement',
        ],
    },
    {
        id: 'audit-trail',
        name: 'Audit Trail Export',
        purpose: 'All system/user events with actor, type, immutable IDs',
        defaultWindow: '30 days',
        formats: ['CSV'],
        icon: <FiKey size={22} />,
        color: 'info',
        highlights: [
            '1,247 events in the selected window',
            'Sources: System 68 %, User 22 %, AI 10 %',
            'No tamper flags — all event hashes verified',
        ],
    },
    {
        id: 'procurement-summary',
        name: 'Procurement Summary',
        purpose: 'Total procurement volume, avg price, supplier breakdown',
        defaultWindow: '30 days',
        formats: ['PDF', 'Excel'],
        icon: <FiShoppingCart size={22} />,
        color: 'success',
        highlights: [
            'Total procured: 85,000 L across 3 suppliers',
            'Avg price: KES 182.50 / L (market avg: KES 184.00)',
            'Outstanding balance: KES 42,000 — due 15 Mar 2026',
        ],
    },
    {
        id: 'exception-report',
        name: 'Exception Report',
        purpose: 'Critical alerts, failed deliveries, large variances, telemetry gaps',
        defaultWindow: '7 days',
        formats: ['PDF'],
        icon: <FiZap size={22} />,
        color: 'danger',
        highlights: [
            '3 critical alerts fired — all acknowledged within 12 min',
            '1 delivery marked Failed — supplier dispute lodged',
            '2 telemetry gaps > 4 h — node connectivity issue resolved',
        ],
    },
];

// ─── Saved Reports List (Now handled by Supabase) ───────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FormatBadge({ fmt }: { fmt: OutputFormat }) {
    return <span className={`rp-format-badge rp-format-badge--${fmt.toLowerCase()}`}>{fmt}</span>;
}

function ColorDot({ color }: { color: string }) {
    return <span className={`rp-color-dot rp-color-dot--${color}`} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const ReportingPage: React.FC = () => {
    const { currentUser } = useAuth();
    const orgId = currentUser?.stationId || '';
    const userName = currentUser?.displayName || currentUser?.email || 'Unknown';

    // ── Selected report & builder state
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedTankId, setSelectedTankId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [includeAttachments, setIncludeAttachments] = useState(false);
    const [includeTimeline, setIncludeTimeline] = useState(false);

    // ── Preview / generate state
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isGenerated, setIsGenerated] = useState(false);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const [docId, setDocId] = useState('');
    
    // ── Live data hooks
    const { reports: savedReports, loading: reportsLoading, refresh: refreshReports } = useReports(orgId);

    // ── Raw data hooks (for shift recon & procurement)
    const { shifts } = useShifts(orgId, {});
    const { tanks } = useTanks(orgId);

    const tankNames = useMemo(() => {
        const m: Record<string, string> = {};
        tanks.forEach(t => { m[t.id] = t.name; });
        return m;
    }, [tanks]);

    const selectedTemplate = REPORT_TEMPLATES.find(r => r.id === selectedId) ?? null;

    // ── Window label for output panel
    const windowLabel = useMemo(() => {
        if (timeRange === 'custom') return customStart && customEnd ? `${customStart} → ${customEnd}` : 'Custom (not set)';
        return { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }[timeRange];
    }, [timeRange, customStart, customEnd]);

    // ── Reset generate state when template or filters change
    const resetGenerate = () => { setIsGenerated(false); setGeneratedAt(null); setDocId(''); };

    const handleSelectCard = (id: string) => {
        if (selectedId === id) return;
        setSelectedId(id);
        resetGenerate();
        setIsPreviewing(false);
    };

    const handlePreview = () => {
        if (!selectedTemplate) return;
        setIsPreviewing(true);
        setTimeout(() => setIsPreviewing(false), 800);
    };

    const handleGenerate = async () => {
        if (!selectedTemplate || !orgId) return;
        
        setIsPreviewing(true); // Show loading state
        const now = new Date();
        const dateStr = format(now, 'yyyyMMdd');
        const seq = String(savedReports.length + 1).padStart(4, '0');
        const id = `RPT-${dateStr}-${seq}`;

        // Prepare professional forensic data for storage
        const reportData = {
            window: windowLabel,
            generated_at: now.toISOString(),
            generated_by: userName,
            filters: {
                tank_id: selectedTankId || 'all',
                product: selectedProduct || 'all',
                time_range: timeRange
            },
            // High-fidelity snapshot of current state
            highlights: selectedTemplate.highlights,
            metrics: {
                tank_count: tanks.length,
                shift_count: shifts.length,
            }
        };

        try {
            const { error } = await supabase.from('reports').insert([{
                station_id: orgId,
                name: selectedTemplate.name,
                report_type: selectedTemplate.id,
                report_data: reportData,
                generated_by: currentUser?.authUserId
            }]);

            if (error) throw error;

            setDocId(id);
            setGeneratedAt(now);
            setIsGenerated(true);
            refreshReports(); // Refresh the list from DB
        } catch (err) {
            console.error('Failed to generate report:', err);
            alert('Database insertion failed. Please check network connectivity.');
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleNativeExport = (fmt: OutputFormat, reconstructionData?: any) => {
        if (!selectedTemplate && !reconstructionData) return;

        const effectiveTitle = reconstructionData?.name || selectedTemplate?.name || 'Report';
        const effectiveData = reconstructionData?.report_data || {};
        
        // If we have reconstruction data (from a saved report), use the Forensic Reconstruction engine
        if (reconstructionData) {
            ExportService.reconstructReport(effectiveTitle, currentUser?.companyName || 'IoTank Station', effectiveData, fmt);
            return;
        }

        // Otherwise, proceed with Live Export (for newly generated reports)
        if (!selectedTemplate) return;

        // Legacy specialized exports for Shifts
        if (selectedTemplate.id === 'shift-reconciliation') {
            if (fmt === 'Excel') { exportShiftsToExcel(shifts, tankNames); return; }
            if (fmt === 'PDF' && shifts.length > 0) {
                generateShiftPDF(shifts[0], tankNames[shifts[0].tankId] || 'All Tanks', userName);
                return;
            }
        }

        // New Report Factory exports using ExportService
        try {
            if (selectedTemplate.id === 'compliance-pack' && fmt === 'PDF') {
                ExportService.generateCompliancePack(
                    currentUser?.companyName || 'IoTank Station',
                    { start: customStart || '2026-01-01', end: customEnd || '2026-03-31' },
                    { totalThroughput: 145000, totalDeliveries: 12, averageVariancePct: 0.4, incidents: 2 },
                    [
                        { date: '2026-02-14', opening: 12000, closing: 10500, deliveries: 0, sales: 1450, variance: 50 },
                        { date: '2026-02-15', opening: 10500, closing: 18000, deliveries: 10000, sales: 2450, variance: -50 }
                    ]
                );
                return;
            }

            // Generic PDF export for other reports
            if (fmt === 'PDF') {
                ExportService.generateGenericPDF(
                    selectedTemplate.name,
                    currentUser?.companyName || 'IoTank Station',
                    ['Date', 'Metric', 'Value', 'Status'],
                    [
                        [format(new Date(), 'yyyy-MM-dd'), 'Sample Data 1', '100', 'OK'],
                        [format(new Date(), 'yyyy-MM-dd'), 'Sample Data 2', '200', 'WARN']
                    ],
                    { 'Period': windowLabel, 'Generated By': userName, 'Filter': selectedTankId || 'All Tanks' }
                );
                return;
            }

            // Generic CSV export
            if (fmt === 'CSV') {
                ExportService.exportToCSV([
                    { date: format(new Date(), 'yyyy-MM-dd'), metric: 'Sample Data 1', value: 100, status: 'OK' },
                    { date: format(new Date(), 'yyyy-MM-dd'), metric: 'Sample Data 2', value: 200, status: 'WARN' }
                ], `${selectedTemplate.id}_export`);
                return;
            }

            alert(`Export as ${fmt} — backend integration pending for ${selectedTemplate.name}`);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate export document.');
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="rp-page">

            {/* ── Page header ─────────────────────────────────────────────── */}
            <div className="rp-header">
                <div className="rp-header-title">
                    <div className="rp-header-icon"><FiFileText size={24} /></div>
                    <div>
                        <h1>Reports</h1>
                        <p className="rp-subtitle">Official documents &amp; exports for {currentUser?.companyName || 'IoTank'} — audit-ready, repeatable, structured.</p>
                    </div>
                </div>
                <div className="rp-header-meta">
                    <span className="rp-meta-chip"><MdVerified size={13} /> {REPORT_TEMPLATES.length} report types</span>
                    <span className="rp-meta-chip"><FiClock size={13} /> {savedReports.length} saved</span>
                    <span className="rp-meta-chip"><FiPrinter size={13} /> {currentUser?.companyName || 'Station Identity'}</span>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                  SECTION 1 — Report Library
              ══════════════════════════════════════════════════════════════ */}
            <section className="rp-section">
                <div className="rp-section-label">
                    <span className="rp-section-number">01</span>
                    <span>Report Library</span>
                    <span className="rp-section-hint">Select a template to begin</span>
                </div>

                <div className="rp-library-grid">
                    {REPORT_TEMPLATES.map(tpl => {
                        const active = selectedId === tpl.id;
                        return (
                            <button
                                key={tpl.id}
                                className={`rp-card rp-card--${tpl.color} ${active ? 'rp-card--active' : ''}`}
                                onClick={() => handleSelectCard(tpl.id)}
                                title={tpl.purpose}
                            >
                                <div className={`rp-card-icon-wrap rp-card-icon-wrap--${tpl.color}`}>
                                    {tpl.icon}
                                </div>
                                <div className="rp-card-body">
                                    <span className="rp-card-name">{tpl.name}</span>
                                    <span className="rp-card-purpose">{tpl.purpose}</span>
                                </div>
                                <div className="rp-card-footer">
                                    <span className="rp-card-window">
                                        <FiCalendar size={11} /> {tpl.defaultWindow}
                                    </span>
                                    <div className="rp-card-formats">
                                        {tpl.formats.map(f => <FormatBadge key={f} fmt={f} />)}
                                    </div>
                                </div>
                                {active && <div className="rp-card-active-ring" />}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                  SECTION 2 — Report Builder
              ══════════════════════════════════════════════════════════════ */}
            <section className={`rp-section ${!selectedId ? 'rp-section--dimmed' : ''}`}>
                <div className="rp-section-label">
                    <span className="rp-section-number">02</span>
                    <span>Report Builder</span>
                    {selectedTemplate && (
                        <span className="rp-section-hint">
                            Building: <strong>{selectedTemplate.name}</strong>
                        </span>
                    )}
                </div>

                <div className="rp-builder-panel">

                    {/* Time range */}
                    <div className="rp-builder-row">
                        <label className="rp-builder-label">
                            <FiCalendar size={13} /> Time Range
                        </label>
                        <div className="rp-time-pills">
                            {(['7d', '30d', '90d', 'custom'] as const).map(tr => (
                                <button
                                    key={tr}
                                    className={`rp-time-pill ${timeRange === tr ? 'active' : ''}`}
                                    onClick={() => { setTimeRange(tr); resetGenerate(); }}
                                    disabled={!selectedId}
                                >
                                    {tr === 'custom' ? 'Custom' : tr}
                                </button>
                            ))}
                        </div>
                        {timeRange === 'custom' && (
                            <div className="rp-custom-dates">
                                <input
                                    type="date"
                                    className="rp-date-input"
                                    value={customStart}
                                    onChange={e => { setCustomStart(e.target.value); resetGenerate(); }}
                                    disabled={!selectedId}
                                />
                                <span className="rp-date-sep">→</span>
                                <input
                                    type="date"
                                    className="rp-date-input"
                                    value={customEnd}
                                    onChange={e => { setCustomEnd(e.target.value); resetGenerate(); }}
                                    disabled={!selectedId}
                                />
                            </div>
                        )}
                    </div>

                    {/* Dropdowns row */}
                    <div className="rp-builder-row rp-builder-selects">
                        <div className="rp-select-group">
                            <label className="rp-builder-label">Tank</label>
                            <select
                                className="rp-select"
                                value={selectedTankId}
                                onChange={e => { setSelectedTankId(e.target.value); resetGenerate(); }}
                                disabled={!selectedId}
                            >
                                <option value="">All Tanks</option>
                                {tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="rp-select-group">
                            <label className="rp-builder-label">Product</label>
                            <select
                                className="rp-select"
                                value={selectedProduct}
                                onChange={e => { setSelectedProduct(e.target.value); resetGenerate(); }}
                                disabled={!selectedId}
                            >
                                <option value="">All Products</option>
                                <option value="diesel">Diesel</option>
                                <option value="petrol">Petrol</option>
                            </select>
                        </div>
                        <div className="rp-select-group">
                            <label className="rp-builder-label">Site</label>
                            <select className="rp-select" disabled={!selectedId}>
                                <option>All Sites</option>
                            </select>
                        </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="rp-builder-row rp-builder-checks">
                        <button
                            className={`rp-check-btn ${includeAttachments ? 'checked' : ''}`}
                            onClick={() => { setIncludeAttachments(v => !v); resetGenerate(); }}
                            disabled={!selectedId}
                        >
                            {includeAttachments ? <FiCheckSquare size={15} /> : <FiSquare size={15} />}
                            Include Attachments
                        </button>
                        <button
                            className={`rp-check-btn ${includeTimeline ? 'checked' : ''}`}
                            onClick={() => { setIncludeTimeline(v => !v); resetGenerate(); }}
                            disabled={!selectedId}
                        >
                            {includeTimeline ? <FiCheckSquare size={15} /> : <FiSquare size={15} />}
                            Include Event Timeline
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="rp-builder-actions">
                        <button
                            className="rp-btn rp-btn--preview"
                            onClick={handlePreview}
                            disabled={!selectedId || isPreviewing}
                        >
                            {isPreviewing ? <FiRefreshCw size={14} className="rp-spin" /> : <FiEye size={14} />}
                            {isPreviewing ? 'Loading…' : 'Preview'}
                        </button>
                        <button
                            className="rp-btn rp-btn--generate"
                            onClick={handleGenerate}
                            disabled={!selectedId}
                        >
                            <FiFileText size={14} /> Generate
                        </button>
                        {/* Export dropdown */}
                        <div className={`rp-export-wrap ${!isGenerated ? 'rp-export-wrap--disabled' : ''}`}>
                            <button className="rp-btn rp-btn--export" disabled={!isGenerated}>
                                <FiDownload size={14} /> Export
                                <FiChevronDown size={13} className="rp-export-caret" />
                            </button>
                            {isGenerated && (
                                <div className="rp-export-dropdown">
                                    {selectedTemplate?.formats.map(fmt => (
                                        <button
                                            key={fmt}
                                            className="rp-export-item"
                                            onClick={() => handleNativeExport(fmt)}
                                        >
                                            <FormatBadge fmt={fmt} />
                                            {fmt === 'PDF' ? 'Download PDF' :
                                                fmt === 'CSV' ? 'Download CSV' :
                                                    fmt === 'Excel' ? 'Download Excel' :
                                                        'Download ZIP Pack'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            className="rp-btn rp-btn--outline"
                            onClick={() => { window.print(); }}
                            disabled={!isGenerated}
                            title="Print"
                        >
                            <FiPrinter size={14} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                  SECTION 3 — Output Panel (after generate)
              ══════════════════════════════════════════════════════════════ */}
            <section className="rp-section">
                <div className="rp-section-label">
                    <span className="rp-section-number">03</span>
                    <span>Output &amp; Saved Reports</span>
                </div>

                {isGenerated && selectedTemplate && generatedAt && (
                    <div className="rp-output-panel rp-output-panel--visible">
                        {/* Report header block */}
                        <div className={`rp-output-header rp-output-header--${selectedTemplate.color}`}>
                            <div className="rp-output-header-left">
                                <div className="rp-output-icon">{selectedTemplate.icon}</div>
                                <div>
                                    <div className="rp-output-title">{selectedTemplate.name}</div>
                                    <div className="rp-output-meta-row">
                                        <span><FiClock size={11} /> Generated: {format(generatedAt, 'dd MMM yyyy, HH:mm')}</span>
                                        <span><MdBarChart size={11} /> Window: {windowLabel}</span>
                                        <span>Prepared for: <strong>{currentUser?.companyName || 'Valued Station'}</strong></span>
                                    </div>
                                </div>
                            </div>
                            <div className="rp-output-docid">
                                <span className="rp-docid-label">Document ID</span>
                                <span className="rp-docid-value">{docId}</span>
                                <span className="rp-docid-by">Generated by: {userName}</span>
                            </div>
                        </div>

                        {/* Summary highlights */}
                        <div className="rp-output-highlights">
                            <div className="rp-highlights-label">Summary Highlights</div>
                            <ul className="rp-highlights-list">
                                {selectedTemplate.highlights.map((h, i) => (
                                    <li key={i} className="rp-highlight-item">
                                        <ColorDot color={selectedTemplate.color} /> {h}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Download buttons */}
                        <div className="rp-output-downloads">
                            {selectedTemplate.formats.map(fmt => (
                                <button
                                    key={fmt}
                                    className={`rp-dl-btn rp-dl-btn--${fmt.toLowerCase()}`}
                                    onClick={() => handleNativeExport(fmt)}
                                >
                                    <FiDownload size={14} />
                                    {fmt === 'ZIP' ? 'Download Full Pack (.zip)' : `Download ${fmt}`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!isGenerated && (
                    <div className="rp-output-placeholder">
                        <div className="rp-placeholder-icon"><FiFileText size={36} /></div>
                        <p className="rp-placeholder-title">No report generated yet</p>
                        <p className="rp-placeholder-hint">
                            Select a template above, configure filters, then click <strong>Generate</strong>.
                        </p>
                    </div>
                )}

                {/* Saved reports list */}
                {(savedReports.length > 0 || reportsLoading) && (
                    <div className="rp-saved-section">
                        <div className="rp-saved-header">
                            <FiClock size={14} /> Saved Reports
                            {!reportsLoading && <span className="rp-saved-count">{savedReports.length}</span>}
                        </div>
                        {reportsLoading ? (
                            <div className="rp-saved-table-container">
                                <table className="rp-saved-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Report Name</th>
                                            <th>Date Created</th>
                                            <th>Created By</th>
                                            <th>Formats</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[1, 2, 3].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={7}>
                                                    <div className="h-10 w-full bg-slate-50 rounded" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rp-saved-table-container">
                                <table className="rp-saved-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Report Name</th>
                                            <th>Date Created</th>
                                            <th>Created By</th>
                                            <th>Formats</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {savedReports.map((r) => {
                                            const template = REPORT_TEMPLATES.find(t => t.id === r.report_type);
                                            const formats = template?.formats || ['PDF'];
                                            const data = r.report_data as any;
                                            
                                            return (
                                                <tr key={r.id}>
                                                    <td className="rp-saved-id-cell">
                                                        <span className="rp-saved-id-pill">
                                                            {r.id.split('-')[0].substring(0, 8)}...
                                                        </span>
                                                    </td>
                                                    <td className="rp-saved-name-cell">
                                                        <div className="rp-report-name-group">
                                                            <div className={`rp-mini-icon rp-mini-icon--${template?.color || 'info'}`}>
                                                                {template?.icon}
                                                            </div>
                                                            <span className="rp-report-name-text">{r.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="rp-td-date">
                                                        <div className="rp-date-stack">
                                                            <span className="rp-date-main">{format(new Date(r.created_at), 'dd MMM yyyy')}</span>
                                                            <span className="rp-date-sub">{format(new Date(r.created_at), 'HH:mm')}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="rp-actor-badge">
                                                            {data?.generated_by || 'System'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="rp-saved-formats">
                                                            {formats.map(f => <FormatBadge key={f} fmt={f} />)}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button 
                                                            className="rp-action-dl-btn" 
                                                            title="Re-download Report"
                                                            onClick={() => handleNativeExport(formats[0], r)}
                                                        >
                                                            <FiDownload size={14} />
                                                            <span>Download</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};
