import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
    FaCreditCard, FaCheckCircle, FaExclamationTriangle, FaHistory,
    FaDownload, FaArrowUp, FaArrowDown, FaRocket, FaDatabase, FaShieldAlt, FaChartLine
} from 'react-icons/fa';
import './BillingPage.css';

interface BillingInfo {
    station_id: string; // Unified identifier
    current_debt: number;
    total_paid: number;
    account_status: string;
    next_billing_date: string;
    station_name: string;
}

interface Transaction {
    id: string;
    transaction_type: string;
    amount: number;
    description: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    completed_at: string;
}

const BILLING_MODEL_FEATURES = [
    { text: 'Fixed monthly service fee: Ksh 3,500', icon: <FaCheckCircle /> },
    { text: 'Full database & storage hosting', icon: <FaCheckCircle /> },
    { text: 'AI-powered procurement analytics', icon: <FaCheckCircle /> },
    { text: 'Unlimited real-time monitoring', icon: <FaCheckCircle /> },
];

const MOCK_BILLING: BillingInfo = {
    station_id: 'demo-id',
    current_debt: 12500,
    total_paid: 450000,
    account_status: 'healthy',
    next_billing_date: new Date(Date.now() + 864000000).toISOString(),
    station_name: 'Simulated Environment'
};

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: '1', transaction_type: 'payment', amount: 5000, description: 'M-Pesa Remittance - QJK98X', payment_status: 'completed', payment_method: 'mpesa', created_at: new Date(Date.now() - 86400000).toISOString(), completed_at: new Date(Date.now() - 86400000).toISOString() },
    { id: '2', transaction_type: 'charge', amount: 2500, description: 'Monthly Infrastructure Fee', payment_status: 'completed', payment_method: 'system', created_at: new Date(Date.now() - 172800000).toISOString(), completed_at: new Date(Date.now() - 172800000).toISOString() },
    { id: '3', transaction_type: 'charge', amount: 1200, description: 'AI Analytics Overages', payment_status: 'completed', payment_method: 'system', created_at: new Date(Date.now() - 259200000).toISOString(), completed_at: new Date(Date.now() - 259200000).toISOString() },
];

export const BillingPage: React.FC = () => {
    const { currentUser, canSee } = useAuth();
    const navigate = useNavigate();

    const [billing, setBilling] = useState<BillingInfo | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [payAmount, setPayAmount] = useState('');
    const [payRef, setPayRef] = useState('');
    const [payMethod, setPayMethod] = useState<'mpesa' | 'bank_transfer' | 'card'>('mpesa');
    const [paying, setPaying] = useState(false);
    const [payFeedback, setPayFeedback] = useState('');
    const [stationId, setStationId] = useState<string | null>(null);
    const [activeBillingTab, setActiveBillingTab] = useState<'overview' | 'usage' | 'history'>('overview');
    const [isDemo, setIsDemo] = useState(false);

    useEffect(() => {
        const fetchBilling = async () => {
            if (!currentUser?.authUserId) return;
            setLoading(true);

            try {
                // Production-Ready Query: Standardizing on station_id and owner linkage
                let query = supabase.from('fuel_stations').select('*');

                if (currentUser.stationId && currentUser.stationId !== 'SYSTEM_GOVERNANCE') {
                    // Standard user path: Fetch by assigned station ID
                    query = query.eq('station_id', currentUser.stationId);
                } else if (currentUser.isSystemAccount) {
                    // System Admin path: Usually sees nothing unless searching
                    setLoading(false);
                    return;
                } else {
                    // Provisioning Fallback: Fetch by owner_id if station_id is not yet assigned to profile
                    query = query.eq('owner_id', currentUser.authUserId);
                }

                const { data: cbData, error: billingError } = await query.maybeSingle();

                if (billingError) throw billingError;

                if (cbData) {
                    setBilling(cbData);
                    setStationId(cbData.station_id);

                    const { data: txData } = await supabase
                        .from('transactions')
                        .select('*')
                        .eq('station_id', cbData.station_id)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    setTransactions(txData || []);
                    setIsDemo(false);
                } else {
                    console.log("[BILLING] No production record found. Defaulting to Simulation Mode.");
                    setBilling(MOCK_BILLING);
                    setTransactions(MOCK_TRANSACTIONS);
                    setIsDemo(true);
                }
            } catch (err) {
                console.error("[BILLING_SYSTEM_FAILURE]", err);
                setBilling(MOCK_BILLING);
                setTransactions(MOCK_TRANSACTIONS);
                setIsDemo(true);
            } finally {
                setLoading(false);
            }
        };
        fetchBilling();
    }, [currentUser]);

    if (!canSee(5)) {
        return (
            <div className="billing-restricted-view" role="alert">
                <div className="restricted-icon-wrap" aria-hidden="true">
                    <FaShieldAlt size={48} className="restricted-shield-icon" />
                </div>
                <h2>Security Protocol Enforced</h2>
                <p>
                    Finance and Governance modules are limited to <strong>Administrator</strong> class users. 
                    Your current credential set does not grant access to this infrastructure.
                </p>
                <div className="restricted-actions">
                    <button onClick={() => navigate('/dashboard')} className="btn-primary" aria-label="Return to Dashboard">Return to Hub</button>
                    <button onClick={() => window.open('mailto:security@iotank.com')} className="btn-outline" aria-label="Email support for access">Request Clearance</button>
                </div>
            </div>
        );
    }

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setPayFeedback('');
        const amount = parseFloat(payAmount);
        if (!amount || amount <= 0) { setPayFeedback('Please enter a valid amount.'); return; }
        if (!payRef.trim()) { setPayFeedback('Please enter a payment reference.'); return; }
        if (!stationId) return;

        setPaying(true);
        const { error } = await supabase.rpc('process_payment', {
            p_station_id: stationId,
            p_amount: amount,
            p_payment_method: payMethod,
            p_payment_reference: payRef.trim(),
            p_description: `${payMethod.toUpperCase()} payment - ${payRef}`,
        });

        if (error) {
            setPayFeedback(` Payment failed: ${error.message}`);
        } else {
            setPayFeedback(`✅ Payment of KSh ${amount.toLocaleString()} recorded!`);
            setPayAmount('');
            setPayRef('');
            const { data: updated } = await supabase.from('fuel_stations').select('*').eq('station_id', stationId).single();
            if (updated) setBilling(updated);
            const { data: txData } = await supabase.from('transactions').select('*').eq('station_id', stationId).order('created_at', { ascending: false }).limit(20);
            setTransactions(txData || []);
        }
        setPaying(false);
    };

    const formatDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const txIcon = (type: string) => ['payment', 'credit'].includes(type) ? <FaArrowDown /> : <FaArrowUp />;

    if (loading) {
        return <div className="billing-loading">Authenticating Financial Ledger…</div>;
    }

    if (!billing) {
        return (
            <div className="billing-not-found">
                <FaExclamationTriangle size={32} color="var(--color-warning)" />
                <p>System error: No billing context identified. Please contact DevOps.</p>
            </div>
        );
    }

    const isOverdue = billing.account_status === 'overdue' || billing.current_debt > 1000;

    return (
        <div className="billing-page">
            <AnimatePresence>
                {isDemo && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="simulation-insight-banner"
                    >
                        <FaExclamationTriangle color="var(--color-warning)" />
                        <div className="simulation-insight-text">
                            <strong>Simulation Insight</strong>: You are viewing the premium UI architecture with synthetic data. This typically happens for administrative accounts that haven't been provisioned with a dedicated billing ledger.
                        </div>
                        <button 
                            className="btn-outline simulation-insight-btn" 
                            onClick={() => window.location.href = 'mailto:devops@iotank.com?subject=Billing Provisioning Request'}
                        >
                            Provision Ledger
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="billing-header">
                <div className="billing-header-info">
                    <h1>Billing & Governance</h1>
                    <p className="billing-header-subtitle">Infrastructure overhead and automated financial auditing.</p>
                </div>
                <select className="billing-period-selector" title="Select Billing Period">
                    <option>Last 30 Days</option>
                    <option>Fiscal Quarter</option>
                    <option>Annual View</option>
                </select>
            </header>

            <nav className="billing-tabs">
                <button 
                    className={`billing-tab-btn ${activeBillingTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveBillingTab('overview')}
                >
                    Account Overview
                </button>
                <button 
                    className={`billing-tab-btn ${activeBillingTab === 'usage' ? 'active' : ''}`}
                    onClick={() => setActiveBillingTab('usage')}
                >
                    High-Density Usage
                </button>
                <button 
                    className={`billing-tab-btn ${activeBillingTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveBillingTab('history')}
                >
                    Transaction Ledger
                </button>
            </nav>

            <AnimatePresence mode="wait">
                {activeBillingTab === 'overview' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="billing-overview-section"
                    >
                        <div className="billing-bento-grid">
                            {/* Balance Card */}
                            <div className={`billing-glass-card balance-card ${isOverdue ? 'overdue' : 'healthy'}`}>
                                <div className="balance-header">
                                    <span className="billing-label-bold">Active Balance</span>
                                    <span className={`balance-status-tag ${isOverdue ? 'status-tag--overdue' : 'status-tag--healthy'}`}>
                                        {billing.account_status}
                                    </span>
                                </div>
                                <div className="balance-amount">KSh {billing.current_debt.toLocaleString()}</div>
                                <div className="balance-footer">
                                    <span>Total Paid: <strong>KSh {billing.total_paid.toLocaleString()}</strong></span>
                                    {billing.next_billing_date && (
                                        <span>Next Invoice: <strong>{formatDate(billing.next_billing_date)}</strong></span>
                                    )}
                                </div>
                            </div>

                            {/* Plan Card */}
                            <div className="billing-glass-card plan-card">
                                <div className="balance-header">
                                    <span className="billing-label-bold">Current Deployment</span>
                                    <span className="plan-badge">Standard Tier</span>
                                </div>
                                <div className="bill-text-large">IoT Enterprise Suite</div>
                                <ul className="plan-feature-list">
                                    {BILLING_MODEL_FEATURES.map((f, i) => (
                                        <li key={i} className="plan-feature-item">
                                            <span className="bill-text-success">{f.icon}</span>
                                            <span className="bill-text-small">{f.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* New Intelligence Card */}
                            <div className="billing-glass-card intelligence-card intelligence-card-premium">
                                <div className="balance-header">
                                    <span className="billing-label-bold">Credits & Intelligence</span>
                                    <FaDatabase color="var(--color-accent-primary)" />
                                </div>
                                <div className="usage-value usage-value-hero">4.2k</div>
                                <div className="usage-label-sub">Active Tokens</div>
                                <div className="usage-stats-divider">
                                    <div className="usage-quota-line">
                                        <span>Monthly Quota</span>
                                        <span className="usage-quota-value">10k</span>
                                    </div>
                                    <div className="usage-progress-bar mt-2">
                                        <div className="usage-progress-fill w-42p"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="billing-glass-card payment-form-card">
                            <div className="bill-flex-header">
                                <div className="rp-mini-icon rp-mini-icon--accent"><FaCreditCard /></div>
                                <h2 className="bill-margin-reset bill-text-large-ui">Record Manual Remittance</h2>
                            </div>

                            {payFeedback && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`billing-feedback-banner ${payFeedback.includes('✅') ? 'billing-feedback-banner--success' : 'billing-feedback-banner--danger'}`}
                                >
                                    {payFeedback}
                                </motion.div>
                            )}

                            <form onSubmit={handlePayment} className="payment-form-grid">
                                <div className="form-group">
                                    <label>Amount (KSh)</label>
                                    <input 
                                        type="number" 
                                        className="form-input"
                                        value={payAmount} 
                                        onChange={e => setPayAmount(e.target.value)} 
                                        placeholder="5,000"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Reference Code</label>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        value={payRef} 
                                        onChange={e => setPayRef(e.target.value)} 
                                        placeholder="M-Pesa / Bank ID"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Method</label>
                                    <select 
                                        className="form-input"
                                        value={payMethod} 
                                        onChange={e => setPayMethod(e.target.value as any)}
                                        title="Payment Method"
                                    >
                                        <option value="mpesa">M-Pesa Moble</option>
                                        <option value="bank_transfer">Direct Deposit</option>
                                        <option value="card">Card Payment</option>
                                    </select>
                                </div>
                                <button type="submit" disabled={paying} className="payment-submit-btn">
                                    {paying ? 'Synchronizing…' : 'Record Payment'}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}

                {activeBillingTab === 'usage' && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="billing-usage-section"
                    >
                        <div className="usage-grid">
                            <div className="billing-glass-card usage-mini-card">
                                <div className="usage-label">
                                    <span>Tank Data Streams</span>
                                    <FaDatabase color="var(--color-accent-primary)" />
                                </div>
                                <div className="usage-value">78.4 GB</div>
                                <div className="usage-progress-bar">
                                    <div className="usage-progress-fill w-78p"></div>
                                </div>
                                <div className="bill-text-tiny bill-text-secondary bill-mg-top-tiny">
                                    78% of 100GB Monthly Limit
                                </div>
                            </div>
                            <div className="billing-glass-card usage-mini-card">
                                <div className="usage-label">
                                    <span>Intelligence API</span>
                                    <FaChartLine color="var(--color-accent-pink)" />
                                </div>
                                <div className="usage-value">12.5k</div>
                                <div className="usage-progress-bar">
                                    <div className="usage-progress-fill w-45p"></div>
                                </div>
                                <div className="bill-text-tiny bill-text-secondary bill-mg-top-tiny">
                                    45% of 30k Credit Tokens
                                </div>
                            </div>
                            <div className="billing-glass-card usage-mini-card">
                                <div className="usage-label">
                                    <span>System Integrity</span>
                                    <FaRocket color="var(--color-success)" />
                                </div>
                                <div className="usage-value">99.98%</div>
                                <div className="usage-progress-bar">
                                    <div className="usage-progress-fill w-99p"></div>
                                </div>
                                <div className="bill-text-tiny bill-text-secondary bill-mg-top-tiny">
                                    Platform Availability Guaranteed
                                </div>
                            </div>
                        </div>

                        <div className="billing-table-container">
                            <div className="billing-table-header">
                                <h2><FaChartLine /> Real-time Metering Ledger</h2>
                                <span className="balance-status-tag status-tag--live-sync">Live Sync</span>
                            </div>
                            <table className="billing-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Telemetry Load</th>
                                        <th>Audit Tokens</th>
                                        <th>Estimated Overhead</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...Array(5)].map((_, i) => (
                                        <tr key={i}>
                                            <td className="bill-text-mono bill-text-secondary">
                                                {format(new Date(Date.now() - i * 86400000), 'dd MMM yyyy')}
                                            </td>
                                            <td className="bill-font-medium">2.{i} GB</td>
                                            <td> {150 + i * 20} REQ</td>
                                            <td className="bill-text-accent bill-font-bold">KSh {(450 + i * 15).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {activeBillingTab === 'history' && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="billing-history-section"
                    >
                        <div className="billing-table-container">
                            <div className="billing-table-header">
                                <h2><FaHistory /> Transaction Intelligence Ledger</h2>
                                <button className="rp-action-dl-btn">
                                    <FaDownload />
                                    <span>Export CSV</span>
                                </button>
                            </div>
                            {transactions.length === 0 ? (
                                <div className="empty-ledger-state">
                                    <FaHistory className="empty-ledger-icon" aria-hidden="true" />
                                    <p>No financial activity recorded in the current ledger period.</p>
                                </div>
                            ) : (
                                <table className="billing-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Event Type</th>
                                            <th>Description</th>
                                            <th>Method</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(tx => (
                                            <tr key={tx.id}>
                                                <td className="tx-date-cell">{formatDate(tx.created_at)}</td>
                                                <td className="tx-type-cell">
                                                    <span className={`tx-type-badge ${tx.transaction_type}`}>
                                                        {tx.transaction_type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="tx-desc-cell" title={tx.description}>
                                                    {tx.description || 'System Charge'}
                                                </td>
                                                <td className="tx-method-cell">
                                                    {tx.payment_method || '—'}
                                                </td>
                                                <td className="tx-amount-cell" data-type={tx.transaction_type}>
                                                    {txIcon(tx.transaction_type)}
                                                    {['payment', 'credit'].includes(tx.transaction_type) ? '−' : '+'} KSh {tx.amount.toLocaleString()}
                                                </td>
                                                <td className="tx-status-cell">
                                                    <span className={`payment-status-chip ${tx.payment_status}`}>
                                                        {tx.payment_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
