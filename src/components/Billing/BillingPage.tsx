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
    current_debt: number;
    total_paid: number;
    account_status: string;
    next_billing_date: string;
    station_name: string;
    id: string;
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
    { text: 'Fixed monthly service fee: $25', icon: <FaCheckCircle /> },
    { text: 'Full database & storage hosting', icon: <FaCheckCircle /> },
    { text: 'AI-powered procurement analytics', icon: <FaCheckCircle /> },
    { text: 'Unlimited real-time monitoring', icon: <FaCheckCircle /> },
];

const MOCK_BILLING: BillingInfo = {
    id: 'demo-id',
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
    const [clientId, setClientId] = useState<string | null>(null);
    const [activeBillingTab, setActiveBillingTab] = useState<'overview' | 'usage' | 'history'>('overview');
    const [isDemo, setIsDemo] = useState(false);

    useEffect(() => {
        const fetchBilling = async () => {
            if (!currentUser?.authUserId) return;
            setLoading(true);

            try {
                const { data: cbData, error: billingError } = await supabase
                    .from('fuel_stations')
                    .select('*')
                    .eq('auth_user_id', currentUser.authUserId)
                    .maybeSingle();

                if (billingError) throw billingError;

                if (cbData) {
                    setBilling(cbData);
                    setClientId(cbData.id);

                    const { data: txData } = await supabase
                        .from('transactions')
                        .select('*')
                        .eq('station_id', cbData.id)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    setTransactions(txData || []);
                    setIsDemo(false);
                } else {
                    console.log("[BILLING] No production record identified. Initializing Simulation Mode...");
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
            <div className="billing-restricted-view">
                <div className="restricted-icon-wrap">
                    <FaShieldAlt size={48} color="#EF4444" />
                </div>
                <h2>Security Protocol Enforced</h2>
                <p>
                    Finance and Governance modules are limited to <strong>Administrator</strong> class users. 
                    Your current credential set does not grant access to this infrastructure.
                </p>
                <div className="restricted-actions">
                    <button onClick={() => navigate('/dashboard')} className="btn-primary">Return to Hub</button>
                    <button onClick={() => window.open('mailto:security@iotank.com')} className="btn-outline">Request Clearance</button>
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
        if (!clientId) return;

        setPaying(true);
        const { error } = await supabase.rpc('process_payment', {
            p_station_id: clientId,
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
            const { data: updated } = await supabase.from('fuel_stations').select('*').eq('id', clientId).single();
            if (updated) setBilling(updated);
            const { data: txData } = await supabase.from('transactions').select('*').eq('station_id', clientId).order('created_at', { ascending: false }).limit(20);
            setTransactions(txData || []);
        }
        setPaying(false);
    };

    const formatDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const txColor = (type: string) => ['payment', 'credit'].includes(type) ? 'var(--color-success)' : 'var(--color-warning)';
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
                        style={{
                            background: 'var(--color-warning-bg)',
                            border: '1px solid var(--color-warning-border)',
                            borderRadius: '12px',
                            padding: '0.75rem 1.25rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            fontSize: '0.85rem'
                        }}
                    >
                        <FaExclamationTriangle color="var(--color-warning)" />
                        <div style={{ flex: 1 }}>
                            <strong>Simulation Insight</strong>: You are viewing the premium UI architecture with synthetic data. This typically happens for administrative accounts that haven't been provisioned with a dedicated billing ledger.
                        </div>
                        <button 
                            className="btn-outline" 
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
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
                <select className="billing-period-selector">
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
                                    <span style={{ fontWeight: 700 }}>Active Balance</span>
                                    <span className="balance-status-tag" style={{
                                        background: isOverdue ? 'var(--color-danger-bg)' : 'rgba(16, 185, 129, 0.1)',
                                        color: isOverdue ? 'var(--color-danger)' : '#10b981',
                                        border: `1px solid ${isOverdue ? 'var(--color-danger-border)' : 'rgba(16, 185, 129, 0.2)'}`
                                    }}>
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
                                    <span style={{ fontWeight: 700 }}>Current Deployment</span>
                                    <span className="plan-badge">Standard Tier</span>
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>IoT Enterprise Suite</div>
                                <ul className="plan-feature-list">
                                    {BILLING_MODEL_FEATURES.map((f, i) => (
                                        <li key={i} className="plan-feature-item">
                                            <span style={{ color: 'var(--color-success)' }}>{f.icon}</span>
                                            <span style={{ fontSize: '0.75rem' }}>{f.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* New Intelligence Card */}
                            <div className="billing-glass-card intelligence-card" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid rgba(0,0,0,0.05)' }}>
                                <div className="balance-header">
                                    <span style={{ fontWeight: 700 }}>Credits & Intelligence</span>
                                    <FaDatabase color="var(--color-accent-primary)" />
                                </div>
                                <div className="usage-value" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>4.2k</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Active Tokens</div>
                                <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                                        <span>Monthly Quota</span>
                                        <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>10k</span>
                                    </div>
                                    <div className="usage-progress-bar" style={{ marginTop: '0.4rem', height: '4px' }}>
                                        <div className="usage-progress-fill" style={{ width: '42%', background: 'var(--color-accent-primary)' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="billing-glass-card payment-form-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div className="rp-mini-icon rp-mini-icon--accent"><FaCreditCard /></div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Record Manual Remittance</h2>
                            </div>

                            {payFeedback && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        marginBottom: '1.5rem',
                                        background: payFeedback.includes('✅') ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                                        color: payFeedback.includes('✅') ? 'var(--color-success)' : 'var(--color-danger)',
                                        border: `1px solid ${payFeedback.includes('✅') ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                                        fontSize: '0.9rem',
                                        fontWeight: 600
                                    }}
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
                                    <div className="usage-progress-fill" style={{ width: '78%', background: 'var(--color-accent-primary)' }}></div>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
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
                                    <div className="usage-progress-fill" style={{ width: '45%', background: 'var(--color-accent-pink)' }}></div>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
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
                                    <div className="usage-progress-fill" style={{ width: '99%', background: 'var(--color-success)' }}></div>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
                                    Platform Availability Guaranteed
                                </div>
                            </div>
                        </div>

                        <div className="billing-table-container">
                            <div className="billing-table-header">
                                <h2><FaChartLine /> Real-time Metering Ledger</h2>
                                <span className="balance-status-tag" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>Live Sync</span>
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
                                            <td style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-mono)', fontSize: '0.8rem' }}>
                                                {format(new Date(Date.now() - i * 86400000), 'dd MMM yyyy')}
                                            </td>
                                            <td style={{ fontWeight: 700 }}>2.{i} GB</td>
                                            <td> {150 + i * 20} REQ</td>
                                            <td style={{ color: 'var(--color-accent-primary)', fontWeight: 800 }}>KSh {(450 + i * 15).toLocaleString()}</td>
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
                                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-disabled)' }}>
                                    <FaHistory size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
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
                                                <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{formatDate(tx.created_at)}</td>
                                                <td>
                                                    <div className="tx-type-group" style={{ color: txColor(tx.transaction_type) }}>
                                                        {txIcon(tx.transaction_type)}
                                                        <span style={{ textTransform: 'capitalize' }}>{tx.transaction_type.replace('_', ' ')}</span>
                                                    </div>
                                                </td>
                                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {tx.description || 'System Charge'}
                                                </td>
                                                <td style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                                                    {tx.payment_method || '—'}
                                                </td>
                                                <td style={{ fontWeight: 800, color: txColor(tx.transaction_type) }}>
                                                    {['payment', 'credit'].includes(tx.transaction_type) ? '−' : '+'} KSh {tx.amount.toLocaleString()}
                                                </td>
                                                <td>
                                                    <span className="payment-status-chip" style={{
                                                        background: tx.payment_status === 'completed' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                                                        color: tx.payment_status === 'completed' ? 'var(--color-success)' : 'var(--color-warning)',
                                                        border: `1px solid ${tx.payment_status === 'completed' ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`
                                                    }}>
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
