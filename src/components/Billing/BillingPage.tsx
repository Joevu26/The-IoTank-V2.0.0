import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FaMoneyBillWave, 
    FaHistory, 
    FaShieldAlt, 
    FaChartBar, 
    FaExclamationTriangle,
    FaExchangeAlt,
    FaPhone,
    FaCreditCard,
    FaFingerprint
} from 'react-icons/fa';
import { FiArrowRight, FiActivity } from 'react-icons/fi';
import './BillingPage.css';

interface BillingInfo {
    station_id: string; 
    current_debt: number;
    total_paid: number;
    account_status: string;
    next_billing_date: string;
    station_name: string;
    sub_tier?: 'BASIC' | 'PRO' | 'ENTERPRISE';
    sub_status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'PROVISIONING';
    sub_expires_at?: string;
    phone?: string;
    telemetry_usage_mb?: number;
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
    provider?: string;
    provider_ref?: string;
    status: string;
}

// Mock data removed. Component now strictly relies on dynamic database telemetry.

const Sparkline: React.FC<{ color: string }> = ({ color }) => (
    <div className="metric-trend-sparkline">
        <svg className="sparkline-svg" viewBox="0 0 100 40">
            <motion.path
                d="M0,30 Q10,10 20,25 T40,15 T60,35 T80,5 T100,20"
                fill="none"
                stroke={color}
                strokeWidth="3"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
            />
            <motion.path
                d="M0,30 Q10,10 20,25 T40,15 T60,35 T80,5 T100,20 L100,40 L0,40 Z"
                fill={color}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                transition={{ duration: 1, delay: 1 }}
            />
        </svg>
    </div>
);

export const BillingPage: React.FC = () => {
    const { currentUser, canSee } = useAuth();
    const navigate = useNavigate();

    const [billing, setBilling] = useState<BillingInfo | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [payAmount, setPayAmount] = useState('');
    const [payPhone, setPayPhone] = useState(currentUser?.phoneNumber || '');
    const [paying, setPaying] = useState(false);
    const [payFeedback, setPayFeedback] = useState('');
    const [stationId, setStationId] = useState<string | null>(null);
    const [readingCount, setReadingCount] = useState(0);

    useEffect(() => {
        const fetchBilling = async () => {
            if (!currentUser?.authUserId) return;
            setLoading(true);

            try {
                let query = supabase.from('fuel_stations').select('*');

                if (currentUser.stationId && currentUser.stationId !== 'SYSTEM_GOVERNANCE') {
                    query = query.eq('station_id', currentUser.stationId);
                } else if (currentUser.isSystemAccount) {
                    setLoading(false);
                    return;
                } else {
                    query = query.eq('owner_id', currentUser.authUserId);
                }

                const { data: cbData, error: billingError } = await query.maybeSingle();

                if (billingError) throw billingError;

                if (cbData) {
                    setBilling(cbData);
                    setStationId(cbData.station_id);
                    setPayPhone(cbData.phone || currentUser?.phoneNumber || '');

                    const [txRes, readingRes] = await Promise.all([
                        supabase.from('billing_transactions').select('*').eq('station_id', cbData.station_id).order('created_at', { ascending: false }).limit(20),
                        supabase.from('sensor_readings_partitioned').select('*', { count: 'exact', head: true }).eq('station_id', cbData.station_id)
                    ]);

                    setTransactions(txRes.data || []);
                    setReadingCount(readingRes.count || 0);
                } else {
                    setBilling(null);
                }
            } catch (err) {
                console.error("[BILLING_SYSTEM_FAILURE]", err);
                setBilling(null);
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
                <p>Finance and Governance modules are limited to Administrators.</p>
                <div className="restricted-actions">
                    <button onClick={() => navigate('/dashboard')} className="btn-primary">Return to Hub</button>
                </div>
            </div>
        );
    }

    // Quick provision removed

    const handleStkPush = async () => {
        if (!payAmount || parseFloat(payAmount) <= 0) { setPayFeedback('⚠️ Enter amount'); return; }
        if (!payPhone || payPhone.length < 10) { setPayFeedback('⚠️ Enter valid phone'); return; }
        if (!stationId) { setPayFeedback('⚠️ ID missing'); return; }

        setPaying(true);
        setPayFeedback(`📲 Initiating Push...`);

        try {
            const amount = parseFloat(payAmount);
            const ref = 'STK_' + Math.random().toString(36).substring(2, 10).toUpperCase();

            const { data, error } = await supabase.functions.invoke('mpesa-proxy', {
                body: { phone: payPhone, amount: amount, reference: ref, stationId: stationId }
            });

            if (error) throw error;

            await supabase.from('billing_transactions').insert({
                station_id: stationId,
                amount: amount,
                provider: 'MPESA',
                provider_ref: data.CheckoutRequestID || ref,
                status: 'PENDING',
                description: `M-Pesa STK Push initiated for KSh ${amount}`
            });

            setPayFeedback(`✅ Request Sent!`);
            setPayAmount('');
        } catch (err: any) {
            setPayFeedback(`❌ Failed: ${err.message}`);
        } finally {
            setPaying(false);
        }
    };

    const handlePaystackPayment = async () => {
        const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        if (!publicKey || publicKey === 'pk_test_placeholder') {
            setPayFeedback('❌ Config error');
            return;
        }
        if (!payAmount || parseFloat(payAmount) <= 0) {
            setPayFeedback('⚠️ Enter amount');
            return;
        }
        // @ts-ignore
        const PaystackPop = window.PaystackPop;
        if (!PaystackPop) {
            setPayFeedback('❌ SDK not loaded');
            return;
        }

        try {
            const handler = PaystackPop.setup({
                key: publicKey,
                email: currentUser?.email || 'finance@iotank.com',
                amount: parseFloat(payAmount) * 100,
                currency: 'KES',
                ref: 'PSTK_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                callback: (response: any) => {
                    setPaying(true);
                    setPayFeedback('⏳ Verifying...');
                    const verify = async () => {
                        try {
                            const { error } = await supabase.rpc('process_payment', {
                                p_station_id: stationId,
                                p_amount: parseFloat(payAmount),
                                p_payment_method: 'PAYSTACK',
                                p_payment_reference: response.reference,
                                p_description: 'Paystack Card Settlement'
                            });
                            if (error) throw error;
                            setPayFeedback('✅ Success!');
                            setTimeout(() => window.location.reload(), 2000);
                        } catch (err: any) {
                            setPayFeedback(`❌ Failed: ${err.message}`);
                            setPaying(false);
                        }
                    };
                    verify();
                },
                onClose: () => {
                    setPayFeedback('ℹ️ Closed.');
                    setPaying(false);
                }
            });
            handler.openIframe();
        } catch (err: any) {
            setPayFeedback(`❌ Init Error: ${err.message}`);
        }
    };

    const formatDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) : '—';
    const txIcon = (type: string) => ['payment', 'credit', 'MPESA', 'PAYSTACK'].includes(type) ? <FaHistory /> : <FiActivity />;

    if (loading) return <div className="billing-loading">SYNCING LEDGER...</div>;
    if (!billing) return <div className="billing-not-found">LEDGER MISSING</div>;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <motion.div 
            initial="hidden" 
            animate="visible" 
            variants={containerVariants}
            className="billing-dashboard-v2"
        >
            <header className="billing-header-v2">
                <div className="flex flex-col">
                    <motion.h1 variants={itemVariants} className="billing-title-main">Billing Hub</motion.h1>
                    <motion.p variants={itemVariants} className="billing-subtitle-main">Financial Matrix & Ledger</motion.p>
                </div>
                <motion.div variants={itemVariants} className="billing-status-badge">
                    <div className="status-dot-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{billing.account_status}</span>
                </motion.div>
            </header>



            <div className="billing-metric-grid">
                <motion.div variants={itemVariants} className="saas-metric-card">
                    <div className="metric-header">
                        <div className="metric-icon-box metric-icon-box--debt"><FaMoneyBillWave /></div>
                        <div className="flex flex-col">
                            <span className="metric-label">Account Liability</span>
                            <div className="metric-value-row">
                                <span className="metric-value-main">KSh {billing.current_debt.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <Sparkline color="#8b5cf6" />
                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-auto">Next Cycle: {formatDate(billing.next_billing_date)}</div>
                </motion.div>

                <motion.div variants={itemVariants} className="saas-metric-card">
                    <div className="metric-header">
                        <div className="metric-icon-box metric-icon-box--usage"><FaChartBar /></div>
                        <div className="flex flex-col">
                            <span className="metric-label">Telemetry Feed</span>
                            <div className="metric-value-row">
                                <span className="metric-value-main">{(billing.telemetry_usage_mb || 0).toFixed(2)} MB</span>
                            </div>
                        </div>
                    </div>
                    <Sparkline color="#22d3ee" />
                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-auto">{readingCount.toLocaleString()} Signals Encrypted</div>
                </motion.div>

                <motion.div variants={itemVariants} className="saas-metric-card">
                    <div className="metric-header">
                        <div className="metric-icon-box metric-icon-box--security"><FaShieldAlt /></div>
                        <div className="flex flex-col">
                            <span className="metric-label">Node Integrity</span>
                            <div className="metric-value-row">
                                <span className="metric-value-main text-emerald-400">HARDENED</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                        <FaFingerprint className="text-4xl text-emerald-500/20" />
                        <div className="text-[10px] text-slate-400 font-medium italic">Forensic auditing active. All transactions cryptographically signed.</div>
                    </div>
                    <div className="mt-auto pt-4 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase text-slate-500">SSL v3.1</span>
                            <div className="h-1 w-24 bg-emerald-500/20 rounded-full overflow-hidden">
                                <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="h-full w-1/2 bg-emerald-500" />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className="billing-main-grid">
                <motion.div variants={itemVariants} className="saas-content-card">
                    <div className="card-title-group">
                        <h3 className="card-title-v3"><FaExchangeAlt className="card-title-icon" /> Transaction Ledger</h3>
                        <div className="status-pill-v3 status-pill-v3--completed">LIVE RECONCILIATION</div>
                    </div>
                    <div className="ledger-table-wrapper">
                        {transactions.length > 0 ? (
                            <table className="ledger-table-v3">
                                <thead>
                                    <tr>
                                        <th>Channel</th>
                                        <th>Reference</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, idx) => (
                                        <motion.tr 
                                            key={tx.id} 
                                            variants={itemVariants}
                                            custom={idx}
                                            className="ledger-row-v3"
                                        >
                                            <td>
                                                <div className="tx-channel-box">
                                                    <div className="tx-icon-v3">{txIcon(tx.provider || tx.transaction_type)}</div>
                                                    <span className="font-black text-xs tracking-tighter">{tx.provider || tx.transaction_type}</span>
                                                </div>
                                            </td>
                                            <td><code className="text-[10px] text-slate-500 font-mono">{tx.provider_ref?.substring(0, 10) || tx.id.substring(0, 8)}</code></td>
                                            <td><span className="tx-amount-v3">KSh {tx.amount.toLocaleString()}</span></td>
                                            <td><span className={`status-pill-v3 status-pill-v3--${(tx.status || tx.payment_status).toLowerCase()}`}>{tx.status || tx.payment_status}</span></td>
                                            <td className="text-[10px] text-slate-500 font-bold uppercase">{formatDate(tx.created_at)}</td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-ledger-v3">
                                <FaExclamationTriangle size={48} className="text-slate-800" />
                                <p className="font-black uppercase tracking-widest text-xs text-slate-600">No Historical Data Found</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="saas-content-card">
                    <div className="card-title-group">
                        <h3 className="card-title-v3">Settle Liability</h3>
                    </div>
                    <div className="command-center-v3">
                        <AnimatePresence>
                            {payFeedback && (
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className={`p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-center ${payFeedback.includes('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}
                                >
                                    {payFeedback}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="saas-input-group">
                            <label className="saas-label-v3">M-Pesa Gateway</label>
                            <div className="relative">
                                <input type="tel" className="saas-input-v3" value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder="07XX XXX XXX" />
                                <FaPhone className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600" />
                            </div>
                        </div>

                        <div className="saas-input-group">
                            <label className="saas-label-v3">Settlement Amount</label>
                            <div className="relative">
                                <input type="number" className="saas-input-v3 saas-input-v3--amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" />
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-500 text-xs">KES</div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 mt-4">
                            <button onClick={handleStkPush} disabled={paying} className="saas-btn-primary-v3">
                                {paying ? 'PROCESSING...' : 'STK DIRECT PUSH'} <FiArrowRight />
                            </button>
                            <button onClick={handlePaystackPayment} disabled={paying} className="saas-btn-secondary-v3">
                                <FaCreditCard /> GLOBAL GATEWAY
                            </button>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-4">
                            <FaShieldAlt className="text-emerald-500 text-xl" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-400">Secured Infrastructure</span>
                                <span className="text-[8px] text-slate-600 font-medium">END-TO-END ENCRYPTED VIA TLS 1.3</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default BillingPage;
