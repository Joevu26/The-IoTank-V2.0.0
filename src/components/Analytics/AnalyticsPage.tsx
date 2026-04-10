/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
    FiPieChart, FiTrendingUp, FiAlertTriangle, FiDownload,
    FiShield, FiActivity, FiTarget, FiArrowRight,
    FiDollarSign, FiDroplet, FiRefreshCw, FiPercent
} from 'react-icons/fi';
import { PredictivePanel } from './PredictivePanel';
import { PageHeader } from '../Common/PageHeader';
import { WetstockReconciliation } from './WetstockReconciliation';
import { ShrinkageHeatmap } from './ShrinkageHeatmap';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useTankAnalytics30d } from '@/hooks/useSupabase';
import { useTransactions } from '@/hooks/useTransactions';
import {
    ResponsiveContainer, AreaChart, Area,
    XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid
} from 'recharts';
import { format } from 'date-fns';
import '../Common/DesignSystemCards.css';
import './AnalyticsPage.css';

export const AnalyticsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId || 'default-station-id';

    // ─── High Performance Analytics Fetching ──────────────────────
    const { analytics: analyticsData } = useTankAnalytics30d(stationId);

    const { tanks } = useTanks(stationId);
    const { transactions } = useTransactions(stationId);

    // Aggregate stats from the materialized view data
    const stats = (analyticsData || []).reduce((acc: any, tank: any) => {
        acc.totalVolume += tank.avg_volume; // Example aggregation
        acc.readingCount += tank.reading_count;
        return acc;
    }, { totalVolume: 0, readingCount: 0, totalSale: 0, totalPurchase: 0, totalProfit: 0, litersSold: 0 });

    // Still need transactional stats (financials)
    transactions.forEach((tx: any) => {
        if (tx.type === 'sale') {
            stats.totalSale += tx.amount * (tx.metadata?.pricePerLiter || 0);
            stats.litersSold += tx.amount;
        }
        if (tx.type === 'purchase') stats.totalPurchase += tx.amount * (tx.metadata?.pricePerLiter || 0);
    });

    stats.totalProfit = stats.totalSale - stats.totalPurchase;
    const marginPercent = stats.totalSale > 0 ? (stats.totalProfit / stats.totalSale) * 100 : 0;
    const revenuePerLitre = stats.litersSold > 0 ? stats.totalSale / stats.litersSold : 0;

    const chartData = transactions
        .filter(t => t.timestamp)
        .slice(0, 12)
        .reverse()
        .map(t => ({
            name: format(t.timestamp, 'MMM dd'),
            sales: t.amount,
        }));

    const displayData = chartData.length > 0 ? chartData : [
        { name: 'Jan', sales: 10 },
        { name: 'Feb', sales: 45 },
        { name: 'Mar', sales: 45 },
        { name: 'Apr', sales: 65 },
        { name: 'May', sales: 112 },
        { name: 'Jun', sales: 30 },
        { name: 'Jul', sales: 150 },
    ];

    const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="analytics-page-container">
            <PageHeader
                title="Intelligence Hub"
                description="Advanced telemetry analysis and predictive fuel modeling"
                action={
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2 text-[10px] text-secondary font-medium">
                            <span>Data Window: Last 90 Days</span>
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            <span>Updated: {lastUpdated}</span>
                        </div>
                        <button className="btn btn-premium flex items-center gap-2" style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                            <FiDownload size={14} /> Generate Report
                        </button>
                    </div>
                }
            />

            {/* ── KPI Strip ────────────────────────────────────── */}
            <div className="acp-kpi-grid">
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon green"><FiDollarSign /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Net Revenue</span>
                        <span className="acp-kpi-value">${stats.totalSale.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="acp-kpi-sub" style={{ color: '#10b981' }}>↑ +3.4% vs prev</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon blue"><FiDroplet /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Fuel Sold (L)</span>
                        <span className="acp-kpi-value">{stats.litersSold.toLocaleString()}</span>
                        <span className="acp-kpi-sub">90-day window</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon green"><FiPercent /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Margin</span>
                        <span className="acp-kpi-value">{marginPercent.toFixed(1)}%</span>
                        <span className="acp-kpi-sub" style={{ color: '#10b981' }}>↑ +0.8% optimal</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon amber"><FiDollarSign /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Rev / Litre</span>
                        <span className="acp-kpi-value">${revenuePerLitre.toFixed(2)}</span>
                        <span className="acp-kpi-sub">per litre avg.</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon purple"><FiRefreshCw /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Inv. Turnover</span>
                        <span className="acp-kpi-value">4.2x</span>
                        <span className="acp-kpi-sub" style={{ color: '#a855f7' }}>Target: 4.5x</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon red"><FiShield /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Variance</span>
                        <span className="acp-kpi-value">0.42%</span>
                        <span className="acp-kpi-sub" style={{ color: '#10b981' }}>Improving</span>
                    </div>
                </div>
            </div>

            {/* ── Main Grid ────────────────────────────────────── */}
            <div className="acp-grid">

                {/* Left Column */}
                <div className="acp-main">

                    {/* Operational Performance */}
                    <div className="acp-card">
                        <div className="acp-card-header">
                            <div className="acp-card-title">
                                <div className="acp-section-icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}><FiActivity /></div>
                                <h3>Operational Performance</h3>
                            </div>
                        </div>

                        {/* Wetstock Reconciliation Section */}
                        <WetstockReconciliation
                            tanks={tanks}
                            transactions={transactions}
                            currency="USD"
                        />

                        <div className="acp-two-col">
                            {/* Revenue Intelligence */}
                            <div>
                                <div className="acp-col-label">
                                    <span className="acp-col-dot" style={{ background: '#10b981' }}></span>
                                    Revenue Intelligence
                                </div>
                                <div className="acp-metric-list">
                                    <div className="acp-metric-row">
                                        <span className="acp-metric-name">Net Revenue</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="acp-metric-val">${stats.totalSale.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                            <span className="acp-metric-badge" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><FiTrendingUp size={8} /> +3.4%</span>
                                        </div>
                                    </div>
                                    <div className="acp-metric-row">
                                        <span className="acp-metric-name">Revenue / Litre</span>
                                        <span className="acp-metric-val">${revenuePerLitre.toFixed(2)}</span>
                                    </div>
                                    <div className="acp-metric-row">
                                        <span className="acp-metric-name">Sales Growth</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="acp-metric-val">+12.4%</div>
                                            <div style={{ height: '18px', width: '48px', display: 'inline-block', opacity: 0.4 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={displayData.slice(-5)}>
                                                        <Area type="monotone" dataKey="sales" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Intelligence */}
                            <div>
                                <div className="acp-col-label">
                                    <span className="acp-col-dot" style={{ background: '#3b82f6' }}></span>
                                    Inventory Intelligence
                                </div>
                                <div className="acp-metric-list">
                                    <div className="acp-metric-row">
                                        <span className="acp-metric-name">Fuel Sold (L)</span>
                                        <span className="acp-metric-val">{stats.litersSold.toLocaleString()} L</span>
                                    </div>
                                    <div className="acp-metric-row">
                                        <span className="acp-metric-name">Inv. Turnover</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="acp-metric-val">4.2x</div>
                                            <span className="acp-metric-badge" style={{ color: '#7c3aed', background: 'rgba(124, 58, 237, 0.1)' }}>Target: 4.5x</span>
                                        </div>
                                    </div>
                                    <div className="acp-metric-row">
                                        <span className="acp-metric-name">Margin %</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="acp-metric-val">{marginPercent.toFixed(1)}%</div>
                                            <span className="acp-metric-badge" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><FiTrendingUp size={8} /> +0.8%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Demand Forecast */}
                    <div className="acp-card">
                        <div className="acp-card-header">
                            <div className="acp-card-title">
                                <div className="acp-section-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><FiTarget /></div>
                                <h3>Demand Forecast</h3>
                            </div>
                            <div className="acp-toggle">
                                <button className="active">Tank View</button>
                                <button>Fleet View</button>
                            </div>
                        </div>

                        <div className="acp-forecast-tiles">
                            <div className="acp-tile">
                                <div className="acp-tile-label">7-Day Forecast</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <span className="acp-tile-val">12,450 L</span>
                                    <div className="acp-tile-spark">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={displayData.slice(-7)}>
                                                <Area type="monotone" dataKey="sales" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} strokeWidth={1.5} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="acp-tile">
                                <div className="acp-tile-label">30-Day Projection</div>
                                <span className="acp-tile-val">54,200 L</span>
                            </div>
                            <div className="acp-tile">
                                <div className="acp-tile-label">Confidence Band</div>
                                <span className="acp-tile-val success">±2.4%</span>
                            </div>
                            <div className="acp-tile" style={{ borderLeft: '3px solid #f59e0b' }}>
                                <div className="acp-tile-label">Days of Cover</div>
                                <span className="acp-tile-val amber">14.2 Days</span>
                            </div>
                        </div>

                        <div className="acp-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={displayData}>
                                    <defs>
                                        <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)' }}
                                        itemStyle={{ color: '#3b82f6' }}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={2.5} fillOpacity={1} fill="url(#gradForecast)" animationDuration={1500} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Forensic Heatmap Section */}
                    <ShrinkageHeatmap />

                    {/* Risk & Variance Analysis */}
                    <div className="acp-card">
                        <div className="acp-card-header">
                            <div className="acp-card-title">
                                <div className="acp-section-icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}><FiShield /></div>
                                <h3>Risk &amp; Variance Analysis</h3>
                            </div>
                        </div>

                        {/* Variance Hero */}
                        <div className="acp-variance-hero">
                            <div className="acp-variance-hero-top">
                                <div>
                                    <div className="acp-variance-hero-label">Primary Analytics Metric</div>
                                    <h4 className="acp-variance-hero-title">Inventory Variance %</h4>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="acp-variance-number">0.42%</div>
                                    <span className="acp-variance-status">Improving</span>
                                </div>
                            </div>
                            <div className="acp-progress-bar">
                                <div className="acp-progress-fill" style={{ width: '42%', background: '#7c3aed' }}></div>
                            </div>
                            <div className="acp-variance-note">Critical Threshold: 0.5% &nbsp;|&nbsp; Drift detected in Site A flow sensors</div>
                        </div>

                        <div className="acp-two-col">
                            <div className="acp-metric-list">
                                <div className="acp-metric-row">
                                    <span className="acp-metric-name">Shrinkage Trend</span>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="acp-metric-val" style={{ color: '#10b981' }}>-12%</div>
                                        <span className="acp-metric-badge badge-green">Improving</span>
                                    </div>
                                </div>
                                <div className="acp-metric-row">
                                    <span className="acp-metric-name">Current loss</span>
                                    <span className="acp-metric-val">85 L</span>
                                </div>
                                <div className="acp-metric-row">
                                    <span className="acp-metric-name">Telemetry stab.</span>
                                    <span className="acp-metric-val" style={{ color: '#10b981' }}>98.4%</span>
                                </div>
                            </div>
                            <div>
                                <div className="acp-col-label">Abnormal Drawdowns</div>
                                <div className="acp-drawdown-list">
                                    <div className="acp-drawdown-item">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <FiAlertTriangle style={{ color: '#ef4444', flexShrink: 0 }} />
                                            <span className="acp-metric-name" style={{ textTransform: 'none', fontWeight: 600 }}>Spike Detected (Site A)</span>
                                        </div>
                                        <span className="acp-drawdown-time">Jan 07, 02:15</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar */}
                <aside className="acp-sidebar">

                    {/* Decision Zone: Scenario Modeling */}
                    <div className="acp-card-dark">
                        <div style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.04 }}>
                                <FiPieChart size={100} color="#fff" />
                            </div>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                                    <FiActivity style={{ color: '#a855f7' }} /> Scenario Modeling
                                </h3>
                                <div className="acp-card-meta">Data window: 30 days baseline</div>

                                <PredictivePanel 
                                    stationId={stationId} 
                                    tankId={tanks[0]?.id} 
                                />

                                <div className="acp-dark-outputs">
                                    <div className="acp-dark-outputs-label">Calculated Projections</div>
                                    <div className="acp-dark-output-row">
                                        <span className="acp-dark-output-label">Cash Flow Impact</span>
                                        <span className="acp-dark-output-val">+$12,400</span>
                                    </div>
                                    <div className="acp-dark-output-row">
                                        <span className="acp-dark-output-label">Procurement Risk</span>
                                        <span className="acp-dark-output-val success">Low</span>
                                    </div>
                                </div>

                                <button className="acp-apply-btn">
                                    Apply Scenario <FiArrowRight />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Decision Zone: Strategic Recommendations */}
                    <div className="acp-card-dark">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <FiTrendingUp style={{ color: '#10b981' }} /> Strategic Recommendations
                        </h3>
                        <div className="acp-rec-list">
                            <div className="acp-rec-item critical">
                                <div style={{ flex: 1 }}>
                                    <div className="acp-rec-top">
                                        <span className="acp-rec-priority">🔴 Critical</span>
                                        <div className="acp-rec-scores">
                                            <span className="acp-rec-risk-score">Risk Score: 92/100</span>
                                            <span className="acp-rec-confidence">Confidence: 78%</span>
                                        </div>
                                    </div>
                                    <p className="acp-rec-title">Emergency Refill (Site B)</p>
                                    <p className="acp-rec-desc">Impact: $4.2k potential loss</p>
                                </div>
                            </div>
                            <div className="acp-rec-item watch">
                                <div style={{ flex: 1 }}>
                                    <div className="acp-rec-top">
                                        <span className="acp-rec-priority">🟡 Watch</span>
                                        <div className="acp-rec-scores">
                                            <span className="acp-rec-risk-score">Risk Score: 45/100</span>
                                            <span className="acp-rec-confidence">Confidence: 62%</span>
                                        </div>
                                    </div>
                                    <p className="acp-rec-title">Demand Surge Expected</p>
                                    <p className="acp-rec-desc">Time Horizon: 48h</p>
                                </div>
                            </div>
                            <div className="acp-rec-item optimize">
                                <div style={{ flex: 1 }}>
                                    <div className="acp-rec-top">
                                        <span className="acp-rec-priority">🟢 Optimize</span>
                                        <div className="acp-rec-scores">
                                            <span className="acp-rec-risk-score">Risk Score: 12/100</span>
                                            <span className="acp-rec-confidence">Confidence: 85%</span>
                                        </div>
                                    </div>
                                    <p className="acp-rec-title">Price Hedging Opportunity</p>
                                    <p className="acp-rec-desc">ROI Estimate: 5.4%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Model Transparency */}
                    <div className="acp-card">
                        <div className="acp-card-header">
                            <div className="acp-card-title">
                                <div className="acp-section-icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}><FiShield /></div>
                                <h3>Model Transparency</h3>
                            </div>
                        </div>
                        <div className="acp-model-rows">
                            <div className="acp-model-row">
                                <span className="acp-model-key">Model Version</span>
                                <span className="acp-model-val">v1.5-Pro (Flash Core)</span>
                            </div>
                            <div className="acp-model-row">
                                <span className="acp-model-key">Last Retrain</span>
                                <span className="acp-model-val">Mar 01, 00:15</span>
                            </div>
                            <div className="acp-model-row">
                                <span className="acp-model-key">Data Window</span>
                                <span className="acp-model-val">90 Days Deep</span>
                            </div>
                            <div className="acp-model-row">
                                <span className="acp-model-key">Calibration</span>
                                <span className="acp-model-val success">Optimal</span>
                            </div>
                        </div>
                        <p className="acp-model-note">
                            Gemini-driven inference using Bayesian multi-site demand forecasting.
                        </p>
                    </div>

                </aside>
            </div>
        </div>
    );
};

export default AnalyticsPage;
