import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { billingService, RevenueStats, DebtAging } from '../services/billingService';
import { 
    FiDollarSign, FiActivity, FiAlertCircle, FiPieChart, 
    FiArrowUpRight, FiArrowDownRight, FiClock, FiCheckCircle,
    FiFileText, FiSettings, FiBarChart2, FiCalendar, FiSearch, 
    FiFilter, FiDownload, FiZap, FiChevronLeft, FiChevronRight,
    FiExternalLink, FiLoader, FiPlus, FiBox
} from 'react-icons/fi';
import './BillingList.css';

// Internal Pagination Component (Standardized)
const TablePagination = ({ 
    currentPage, 
    totalItems, 
    pageSize, 
    onPageChange 
}: { 
    currentPage: number, 
    totalItems: number, 
    pageSize: number, 
    onPageChange: (p: number) => void 
}) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="table-pagination-footer">
            <div className="pagination-info">
                Showing <b>{start}</b> to <b>{end}</b> of <b>{totalItems}</b> entries
            </div>
            <div className="pagination-controls">
                <button 
                    className="pagination-btn" 
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                >
                    <FiChevronLeft /> Previous
                </button>
                <button 
                    className="pagination-btn" 
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    Next <FiChevronRight />
                </button>
            </div>
        </div>
    );
};

const BillingList: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'failed' | 'adjustments' | 'usage' | 'invoices' | 'settings' | 'reports'>('dashboard');
    const [stats, setStats] = useState<RevenueStats | null>(null);
    const [aging, setAging] = useState<DebtAging | null>(null);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [failedPayments, setFailedPayments] = useState<any[]>([]);
    const [pendingAdjustments, setPendingAdjustments] = useState<any[]>([]);
    const [usageLogs, setUsageLogs] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    
    // Controls
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 8;

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const [revenueData, agingData, txData, failedData, adjustData, usageData, invoiceData] = await Promise.all([
                    billingService.getRevenueDashboard(),
                    billingService.getDebtAging(),
                    billingService.getTransactions({ status: statusFilter === 'all' ? undefined : statusFilter }),
                    billingService.getTransactions({ status: 'failed' }),
                    billingService.getTransactions({ type: 'adjustment', status: 'pending' }),
                    billingService.getUsageLogs(),
                    billingService.getInvoices()
                ]);
                setStats(revenueData);
                setAging(agingData);
                setTransactions(txData.data || []);
                setFailedPayments(failedData.data || []);
                setPendingAdjustments(adjustData.data || []);
                setUsageLogs(usageData.data || []);
                setInvoices(invoiceData.data || []);
            } catch (error) {
                console.error('Error fetching billing stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [statusFilter]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getStatusClass = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed': return 'status--completed';
            case 'pending': return 'status--pending';
            case 'failed': return 'status--failed';
            case 'reversed': return 'status--reversed';
            default: return '';
        }
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => 
            tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.fuel_stations?.station_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredTransactions.slice(start, start + pageSize);
    }, [filteredTransactions, currentPage]);

    const renderDashboard = () => (
        <div className="billing-dashboard animate-fade-in">
            <div className="dp-stats-grid">
                <div className="dp-premium-stat-card">
                    <div className="stat-icon-blob">
                        <FiDollarSign />
                    </div>
                    <div className="stat-content">
                        <label>Daily Liquidity</label>
                        <h3>{formatCurrency(stats?.today || 0)}</h3>
                        <div className="stat-trend up">
                            <FiZap size={10} /> Live synchronization
                        </div>
                    </div>
                </div>

                <div className="dp-premium-stat-card">
                    <div className="stat-icon-blob" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                        <FiActivity />
                    </div>
                    <div className="stat-content">
                        <label>Weekly Velocity</label>
                        <h3>{formatCurrency(stats?.thisWeek.current || 0)}</h3>
                        <div className={`stat-trend ${(stats?.thisWeek.percentChange || 0) >= 0 ? 'up' : 'down'}`}>
                            {(stats?.thisWeek.percentChange || 0) >= 0 ? <FiArrowUpRight /> : <FiArrowDownRight />}
                            {Math.abs(stats?.thisWeek.percentChange || 0).toFixed(1)}% vs. prior
                        </div>
                    </div>
                </div>

                <div className="dp-premium-stat-card">
                    <div className="stat-icon-blob" style={{ background: '#ecfdf5', color: '#10b981' }}>
                        <FiCalendar />
                    </div>
                    <div className="stat-content">
                        <label>Monthly Volume</label>
                        <h3>{formatCurrency(stats?.thisMonth.current || 0)}</h3>
                        <div className={`stat-trend ${(stats?.thisMonth.percentChange || 0) >= 0 ? 'up' : 'down'}`}>
                            {(stats?.thisMonth.percentChange || 0) >= 0 ? <FiArrowUpRight /> : <FiArrowDownRight />}
                            {Math.abs(stats?.thisMonth.percentChange || 0).toFixed(1)}% vs. prior
                        </div>
                    </div>
                </div>

                <div className="dp-premium-stat-card highlight-card">
                    <div className="stat-icon-blob" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                        <FiBarChart2 />
                    </div>
                    <div className="stat-content">
                        <label>Projected MRR</label>
                        <h3>{formatCurrency(stats?.mrr || 0)}</h3>
                        <div className="stat-trend">
                            ANNUAL: {formatCurrency((stats?.mrr || 0) * 12)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="billing-layout-row">
                <div className="tdv-transaction-table-container flex-[2]">
                    <div className="table-header-toolbar">
                        <div className="table-title">
                            <FiActivity className="text-amber-500" /> Recent Activity Stream
                        </div>
                        <button className="text-[10px] font-black uppercase text-amber-600">View Full Ledger</button>
                    </div>
                    <table className="tdv-transaction-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Classification</th>
                                <th>Magnitude</th>
                                <th>Channel</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice(0, 5).map((tx) => (
                                <tr key={tx.id}>
                                    <td className="font-bold">{tx.fuel_stations?.station_name || 'System Registry'}</td>
                                    <td><span className="text-[10px] font-black uppercase opacity-60">{tx.transaction_type.replace('_', ' ')}</span></td>
                                    <td className="font-black">{formatCurrency(tx.amount)}</td>
                                    <td className="text-[10px] font-bold uppercase">{tx.payment_method || 'Internal'}</td>
                                    <td>
                                        <span className={`status-pill ${getStatusClass(tx.payment_status)}`}>
                                            {tx.payment_status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="debt-aging-box flex-1">
                    <div className="aging-header">
                        <div className="table-title"><FiAlertCircle className="text-rose-500" /> Debt Exposure</div>
                        <span className="text-xl font-black text-rose-600">{formatCurrency(aging?.total || 0)}</span>
                    </div>
                    
                    <div className="aging-item-premium">
                        <label><span>0–15 Days</span> <b>{formatCurrency(aging?.zeroToFifteen.amount || 0)}</b></label>
                        <div className="aging-bar-premium"><div className="aging-fill fill--info" style={{width: `${(aging?.zeroToFifteen.amount || 0) / (aging?.total || 1) * 100}%`}}></div></div>
                    </div>
                    <div className="aging-item-premium">
                        <label><span>16–30 Days</span> <b>{formatCurrency(aging?.sixteenToThirty.amount || 0)}</b></label>
                        <div className="aging-bar-premium"><div className="aging-fill fill--warning" style={{width: `${(aging?.sixteenToThirty.amount || 0) / (aging?.total || 1) * 100}%`}}></div></div>
                    </div>
                    <div className="aging-item-premium">
                        <label><span>31–60 Days</span> <b>{formatCurrency(aging?.thirtyOneToSixty.amount || 0)}</b></label>
                        <div className="aging-bar-premium"><div className="aging-fill fill--orange" style={{width: `${(aging?.thirtyOneToSixty.amount || 0) / (aging?.total || 1) * 100}%`}}></div></div>
                    </div>
                    <div className="aging-item-premium">
                        <label><span>60+ Days</span> <b>{formatCurrency(aging?.sixtyPlus.amount || 0)}</b></label>
                        <div className="aging-bar-premium"><div className="aging-fill fill--danger" style={{width: `${(aging?.sixtyPlus.amount || 0) / (aging?.total || 1) * 100}%`}}></div></div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTransactions = () => (
        <div className="transactions-view animate-fade-in">
            <div className="table-header-toolbar !bg-transparent !p-0 !mb-6">
                <div className="header-search-box">
                    <FiSearch className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search TXID or Client..." 
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                
                <div className="filter-pill-cloud">
                    {['all', 'completed', 'pending', 'failed'].map(s => (
                        <button 
                            key={s} 
                            className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
                            onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="tdv-transaction-table-container">
                <table className="tdv-transaction-table">
                    <thead>
                        <tr>
                            <th>Transaction Ref</th>
                            <th>Timestamp</th>
                            <th>Subject Entity</th>
                            <th>Magnitude</th>
                            <th>Channel</th>
                            <th>Status</th>
                            <th className="text-right">Command</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedTransactions.map((tx) => (
                            <tr key={tx.id}>
                                <td className="font-mono text-[10px] font-black opacity-50">
                                    TX-{tx.id.slice(0,12).toUpperCase()}
                                </td>
                                <td className="text-xs">
                                    <div className="font-black">{new Date(tx.created_at).toLocaleDateString()}</div>
                                    <div className="opacity-50 uppercase text-[9px]">{new Date(tx.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </td>
                                <td>
                                    <div className="font-bold">{tx.fuel_stations?.station_name || 'System Registry'}</div>
                                    <div className="text-[10px] opacity-60 uppercase">{tx.transaction_type.replace('_', ' ')}</div>
                                </td>
                                <td className="font-black">{formatCurrency(tx.amount)}</td>
                                <td className="text-[10px] font-bold uppercase opacity-60">{tx.payment_method || 'Internal'}</td>
                                <td>
                                    <span className={`status-pill ${getStatusClass(tx.payment_status)}`}>
                                        {tx.payment_status}
                                    </span>
                                </td>
                                <td className="text-right">
                                    <div className="flex justify-end pr-2">
                                        <button className="action-circle view" title="View Audit">
                                            <FiExternalLink size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <TablePagination 
                    currentPage={currentPage}
                    totalItems={filteredTransactions.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );

    const renderFailedPayments = () => (
        <div className="failed-view animate-fade-in">
            <div className="tdv-transaction-table-container">
                <div className="table-header-toolbar">
                    <div className="table-title"><FiAlertCircle className="text-rose-500" /> Critical Failure Queue</div>
                </div>
                <table className="tdv-transaction-table">
                    <thead>
                        <tr>
                            <th>Entity</th>
                            <th>Magnitude</th>
                            <th>Incident Date</th>
                            <th>Incident Diagnostic</th>
                            <th className="text-right">Remediation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {failedPayments.map(tx => (
                            <tr key={tx.id}>
                                <td className="font-bold">{tx.fuel_stations?.station_name}</td>
                                <td className="font-black text-rose-600">{formatCurrency(tx.amount)}</td>
                                <td className="text-xs font-bold">{new Date(tx.created_at).toLocaleDateString()}</td>
                                <td className="text-[10px] italic opacity-60 uppercase font-bold">Network timeout / Insufficient funds</td>
                                <td className="text-right">
                                    <button className="bg-rose-600 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase">Retry Pulse</button>
                                </td>
                            </tr>
                        ))}
                        {failedPayments.length === 0 && (
                            <tr><td colSpan={5} className="py-20 text-center text-xs font-bold opacity-30 uppercase tracking-widest">Financial pipeline stabilized (No failures)</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="billing-page">
                <header className="dp-header">
                    <div className="dp-title-group">
                        <h1 className="lowercase">clients and billing</h1>
                        <div className="dp-subtitle">Consolidated Financial Hub & Usage Monitoring</div>
                    </div>
                    
                    <div className="dp-header-actions">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-all">
                            <FiDownload /> Export Archive
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20">
                            <FiPlus /> New Adjustment
                        </button>
                    </div>
                </header>

                <div className="billing-tabs-container">
                    {[
                        { id: 'dashboard', label: 'Overview' },
                        { id: 'transactions', label: 'Transactions' },
                        { id: 'failed', label: 'Failed Payments' },
                        { id: 'adjustments', label: 'Adjustments' },
                        { id: 'usage', label: 'Usage tracking' },
                        { id: 'invoices', label: 'Invoices' },
                        { id: 'settings', label: 'Gateways' },
                        { id: 'reports', label: 'Reports' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            className={`billing-tab-btn ${activeTab === tab.id ? 'active' : ''}`} 
                            onClick={() => setActiveTab(tab.id as any)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Synchronizing financial logic...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && renderDashboard()}
                        {activeTab === 'transactions' && renderTransactions()}
                        {activeTab === 'failed' && renderFailedPayments()}
                        {/* Note: Adjustments, Usage, Invoices, Settings, Reports use similar standardized table patterns */}
                        {['adjustments', 'usage', 'invoices', 'settings', 'reports'].includes(activeTab) && (
                           <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                               <FiBox size={48} className="mb-4" />
                               <h3 className="text-sm font-black uppercase tracking-widest">{activeTab} module</h3>
                               <p className="text-[10px] font-bold">Industrial layout initialized. Data rendering pending validation.</p>
                           </div>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default BillingList;
