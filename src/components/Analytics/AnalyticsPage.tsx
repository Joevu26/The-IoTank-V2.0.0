/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { 
    FiTrendingUp, FiAlertTriangle, FiDownload, 
    FiShield, FiActivity, FiTarget, 
    FiDollarSign, FiDroplet, FiPercent 
} from 'react-icons/fi';
import { PageHeader } from '../Common/PageHeader';
import { WetstockReconciliation } from './WetstockReconciliation';
import { LazyComponent } from '../Common/LazyComponent';

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
    
    // Forensic UUID validation to prevent RPC signature mismatches (PGRST202)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidStation = currentUser?.stationId && uuidRegex.test(currentUser.stationId);
    
    // Default to a system GUID if not authenticated to prevent hook crashes and signature errors
    const stationId = isValidStation ? currentUser.stationId : '00000000-0000-0000-0000-000000000000';

    // ─── High Performance Analytics Fetching ──────────────────────
    const { analytics: analyticsData } = useTankAnalytics30d(stationId);
    const { tanks } = useTanks(stationId);
    const { transactions } = useTransactions(stationId);

    // Aggregate stats from the materialized view data
    const analytics = (analyticsData as any)?.summary || [];
    const stats = analytics.reduce((acc: any, tank: any) => {
        acc.totalVolume += tank.avg_volume; 
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
    // const revenuePerLitre = stats.litersSold > 0 ? stats.totalSale / stats.litersSold : 0;

    // [ONE TRUTH]: Calculate Overall Station Variance matching the WRe module
    const startVolumes = JSON.parse(localStorage.getItem('iotank_shift_start_volumes') || '{}');
    const totalOpening = tanks.reduce((sum, t) => sum + (startVolumes[t.id] || t.currentVolume || 0), 0);
    const totalMeasured = tanks.reduce((sum, t) => sum + (t.currentVolume || 0), 0);
    const totalDeliveries = transactions.filter(tx => tx.type === 'delivery').reduce((sum, tx) => sum + tx.amount, 0);
    const totalSales = transactions.filter(tx => tx.type === 'sale').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpected = totalOpening + totalDeliveries - totalSales;
    const totalVariance = totalMeasured - totalExpected;
    const totalVariancePct = totalExpected > 0 ? (totalVariance / totalExpected) * 100 : 0;
    // const inventoryTurnover = totalOpening > 0 ? (totalSales / totalOpening) : 0;

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
                    <div className="acp-header-action-wrap">
                        <div className="acp-header-meta-info">
                            <span>Data Window: Last 90 Days</span>
                            <span className="acp-header-meta-dot"></span>
                            <span>Updated: {lastUpdated}</span>
                        </div>
                        <button className="btn-premium-action">
                            <FiDownload size={14} /> Generate Report
                        </button>
                    </div>
                }
            />

            {/* ── KPI Summary Strip ───────────────────────────────────────── */}
            <div className="acp-kpi-grid">
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon green"><FiDollarSign /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Net Revenue</span>
                        <span className="acp-kpi-value">Ksh {stats.totalSale.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span className="acp-kpi-sub acp-metric-trend-positive">↑ +3.4% Operational</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon blue"><FiDroplet /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Fuel Sold (L)</span>
                        <span className="acp-kpi-value">{stats.litersSold.toLocaleString()} L</span>
                        <span className="acp-kpi-sub opacity-60">Volumetric Drawdown</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className="acp-kpi-icon purple"><FiPercent /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Margin %</span>
                        <span className="acp-kpi-value">{marginPercent.toFixed(1)}%</span>
                        <span className="acp-kpi-sub acp-metric-trend-accent">Target: Opti-Max</span>
                    </div>
                </div>
                <div className="acp-kpi-card">
                    <div className={`acp-kpi-icon ${Math.abs(totalVariancePct) > 0.5 ? 'red' : 'cyan'}`}><FiShield /></div>
                    <div className="acp-kpi-body">
                        <span className="acp-kpi-label">Variance</span>
                        <span className="acp-kpi-value">{totalVariancePct.toFixed(2)}%</span>
                        <span className="acp-kpi-sub">{Math.abs(totalVariancePct) <= 0.5 ? 'Synchronized' : 'Drift Detected'}</span>
                    </div>
                </div>
            </div>


            {/* ── Main Grid ────────────────────────────────────── */}
            <div className="acp-grid">

                {/* Left Column */}
                <div className="acp-main">

                    {/* Operational Performance Hub */}
                    <div className="acp-card">
                        <div className="acp-card-header">
                            <div className="acp-card-title">
                                <div className="acp-section-icon acp-icon-accent-purple"><FiActivity /></div>
                                <h3>Operational Performance</h3>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Wetstock Reconciliation Sub-card */}
                            <div className="acp-hub-card">
                                <LazyComponent minHeight="400px">
                                    <WetstockReconciliation
                                        tanks={tanks}
                                        transactions={transactions}
                                        currency="Ksh"
                                    />
                                </LazyComponent>
                            </div>

                        </div>

                    </div>

                    {/* Demand Forecast */}
                    <div className="acp-card">
                        <div className="acp-card-header">
                            <div className="acp-card-title">
                                <div className="acp-section-icon acp-icon-accent-amber"><FiTarget /></div>
                                <h3>Demand Forecast</h3>
                            </div>
                            <div className="acp-toggle">
                                <button className="active">Tank View</button>
                                <button>Fleet View</button>
                            </div>
                        </div>

                        <div className="acp-forecast-tiles !mb-3 !gap-2">
                            <div className="acp-tile !p-2">
                                <div className="acp-tile-label">7-Day Forecast</div>
                                <div className="flex justify-between items-end">
                                    <span className="acp-tile-val !text-sm">12,450 L</span>
                                    <div className="acp-tile-spark">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <AreaChart data={displayData.slice(-7)}>
                                                <Area type="monotone" dataKey="sales" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} strokeWidth={1.5} isAnimationActive={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                            <div className="acp-tile !p-2">
                                <div className="acp-tile-label">30-Day Projection</div>
                                <span className="acp-tile-val !text-sm">54,200 L</span>
                            </div>
                            <div className="acp-tile !p-2">
                                <div className="acp-tile-label">Confidence Band</div>
                                <span className="acp-tile-val success !text-sm">±2.4%</span>
                            </div>
                            <div className="acp-tile border-l-[3px] border-[#f59e0b] !p-2">
                                <div className="acp-tile-label">Days of Cover</div>
                                <span className="acp-tile-val amber !text-sm">14.2 Days</span>
                            </div>
                        </div>

                        <div className="acp-chart-wrap" style={{ height: '240px', minHeight: '240px', background: 'rgba(248, 250, 252, 0.5)' }}>
                            <LazyComponent minHeight="240px">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
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
                            </LazyComponent>
                        </div>
                    </div>


                    {/* Risk & Variance Analysis */}
                    <div className="acp-card">
                        <div className="acp-card-header">
                            <div className="acp-card-title">
                                <div className="acp-section-icon acp-icon-accent-purple"><FiShield /></div>
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
                                <div className="text-right">
                                    <div className="acp-variance-number">{totalVariancePct.toFixed(2)}%</div>
                                    <span className="acp-variance-status">{Math.abs(totalVariancePct) < 0.5 ? 'Stable' : 'Critical'}</span>
                                </div>
                            </div>
                             <div className="acp-progress-bar">
                                 <div 
                                    className="acp-progress-fill acp-progress-purple" 
                                    ref={(el) => { if (el) el.style.width = '42%'; }}
                                 ></div>
                             </div>
                            <div className="acp-variance-note">Critical Threshold: 0.5% &nbsp;|&nbsp; Drift detected in Site A flow sensors</div>
                        </div>

                        <div className="acp-two-col">
                            <div className="acp-metric-list">
                                <div className="acp-metric-row">
                                    <span className="acp-metric-name">Shrinkage Trend</span>
                                    <div className="text-right">
                                        <div className="acp-metric-val acp-icon-trend-up">-12%</div>
                                        <span className="acp-metric-badge badge-green">Improving</span>
                                    </div>
                                </div>
                                <div className="acp-metric-row">
                                    <span className="acp-metric-name">Current loss</span>
                                    <span className="acp-metric-val">85 L</span>
                                </div>
                                <div className="acp-metric-row">
                                    <span className="acp-metric-name">Telemetry stab.</span>
                                    <span className="acp-metric-val acp-icon-trend-up">98.4%</span>
                                </div>
                            </div>
                            <div>
                                <div className="acp-col-label">Abnormal Drawdowns</div>
                                <div className="acp-drawdown-list">
                                    <div className="acp-drawdown-item">
                                        <div className="flex items-center gap-2">
                                            <FiAlertTriangle className="acp-risk-icon-alert" />
                                            <span className="acp-metric-name !font-semibold !normal-case">Spike Detected (Site A)</span>
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


                    {/* Decision Zone: Strategic Recommendations */}
                    <div className="acp-card">
                        <div className="acp-rec-meta-wrap">
                            <FiTrendingUp className="acp-icon-trend-up" /> Strategic Recommendations
                        </div>
                        <div className="acp-rec-list">
                            <div className="acp-rec-item critical">
                                <div className="flex-1">
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
                                <div className="flex-1">
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
                                <div className="flex-1">
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


                </aside>
            </div>



        </div>
    );
};

export default AnalyticsPage;

