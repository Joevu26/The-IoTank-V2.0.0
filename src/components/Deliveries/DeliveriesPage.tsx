import React, { useState, useMemo } from 'react';
import { 
    FiTruck, FiDownload, FiSearch, 
    FiCheckCircle, FiAlertCircle, 
    FiFileText, FiClock, FiDatabase,
    FiGrid, FiPlus, FiActivity
} from 'react-icons/fi';
import { format } from 'date-fns';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/hooks/useAuth';
import { useTanks } from '@/hooks/useSupabase';
import { ExportService } from '@/services/ExportService';
import { DeliveryDocument } from '@/types';
import { useShiftStatus } from '@/hooks/useShiftStatus';
import { useModals } from '@/contexts/ModalContext';
import { Toast } from '../Common/Toast';
import '../Common/DesignSystemCards.css';
import './DeliveriesPage.css';

export const DeliveriesPage: React.FC = () => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId || '';
    const orgName = currentUser?.companyName || 'Fuel Station Admin';
    const userName = currentUser?.displayName || currentUser?.email || 'Unknown';
    
    // Mock Data for Moved Tables
    const mockOrders = [
        { po: '139', customer: 'Dans Test Customer', user: 'Dan goich', amount: 1400, date: '10/23/2026', time: '10am - 12pm', created: '10/20/2026', address: '2384 Industrial Blvd, Gary, IN, 46407' },
        { po: '140', customer: 'ACME Int.', user: 'John Doe', amount: 50, date: '10/21/2026', time: '6am - 8am', created: '10/21/2026', address: '14500 Avion Pkwy, Chantilly, GA', highlighted: true },
        { po: '141', customer: 'Mark\'s Test Customer', user: 'Mark Carlson', amount: 100, date: '10/22/2026', time: '8am - 10am', created: '10/22/2026', address: '3991 MacArthur Blvd, Newport Beach, CA' },
        { po: '142', customer: 'Dans Test Customer', user: 'Dan goich', amount: 500, date: '10/29/2026', time: '4pm - 6pm', created: '10/26/2026', address: '2725 Kendridge Lane, Aurora, IL' },
    ];

    const mockDeliveries = [
        { po: 'D-801', supplier: 'Global Fuel Corp', user: 'V. Kuznetsov', amount: 12000, date: '10/24/2026', time: '09:00 AM', created: '10/23/2026', address: 'Primary Terminal A' },
        { po: 'D-802', supplier: 'Amethyst Logistics', user: 'K. Frost', amount: 8500, date: '10/25/2026', time: '02:30 PM', created: '10/24/2026', address: 'Secondary Node B', highlighted: true },
    ];

    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'NEEDS_REVIEW' | 'DISPUTED'>('ALL');
    const [selectedDelivery, setSelectedDelivery] = useState<DeliveryDocument | null>(null);

    // Data Hooks
    const { deliveries, loading, error } = useDeliveries(stationId);
    const { tanks } = useTanks(stationId);
    const { status: shiftStatus } = useShiftStatus();
    const { openModal } = useModals();
    const [toast, setToast] = useState<{ 
        message: string, 
        type: 'info' | 'warning' | 'success' | 'error',
        actionLabel?: string,
        onAction?: () => void
    } | null>(null);

    // Derived Data
    const tankNames = useMemo(() => {
        const m: Record<string, string> = {};
        tanks.forEach(t => { m[t.id] = t.name; });
        return m;
    }, [tanks]);

    const filteredDeliveries = useMemo(() => {
        return deliveries.filter(d => {
            const matchesSearch = 
                d.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.supplier?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [deliveries, searchQuery, statusFilter]);

    const stats = useMemo(() => {
        const totalInvoiced = deliveries.reduce((acc, d) => acc + (d.invoiceLiters || 0), 0);
        const totalMeasured = deliveries.reduce((acc, d) => acc + (d.measured?.standardizedLiters || 0), 0);
        const totalVariance = deliveries.reduce((acc, d) => acc + (d.variance?.liters || 0), 0);
        const discrepancyRate = deliveries.length > 0 
            ? (deliveries.filter(d => d.status !== 'VERIFIED').length / deliveries.length * 100).toFixed(1)
            : '0';

        return { totalInvoiced, totalMeasured, totalVariance, discrepancyRate };
    }, [deliveries]);

    // Handlers
    const handleExportPDF = (delivery: DeliveryDocument) => {
        ExportService.generateDeliveryAuditPDF(delivery, orgName, userName);
    };

    const handleExportExcel = () => {
        const summaryMetrics = {
            totalInvoiced: stats.totalInvoiced,
            totalMeasured: stats.totalMeasured,
            totalVariance: stats.totalVariance,
            discrepancyRate: stats.discrepancyRate,
            period: 'All Time'
        };
        ExportService.exportDeliveriesToExcel(deliveries, summaryMetrics, orgName);
    };

    if (error) {
        return (
            <div className="dp-error">
                <FiAlertCircle size={48} />
                <h2>Failed to sync deliveries</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="dp-page animate-in fade-in duration-500">
            {/* Header Area */}
            <header className="dp-header">
                <div className="dp-header-left">
                    <div className="dp-icon-box">
                        <FiTruck size={24} />
                    </div>
                    <div>
                        <h1>Delivery Intelligence</h1>
                        <p className="dp-subtitle">Forensic audit, supplier verification and historical reconciliation.</p>
                    </div>
                </div>
                <div className="dp-header-actions">
                    <button className="dp-btn dp-btn--primary" onClick={handleExportExcel}>
                        <FiDownload /> Export Bulk Data (.xlsx)
                    </button>
                    <div className="dp-meta-stats">
                        <div className="dp-meta-chip">
                            <FiDatabase size={12} /> {deliveries.length} Records
                        </div>
                    </div>
                </div>
            </header>

            {/* Summary Cards */}
            <section className="dp-stats-grid">
                <div className="ds-card dp-stat-card">
                    <span className="dp-stat-label">Total Invoiced Volume</span>
                    <span className="dp-stat-value">{stats.totalInvoiced.toLocaleString()} L</span>
                    <div className="dp-stat-footer text-blue-500">Waybill Aggregate</div>
                </div>
                <div className="ds-card dp-stat-card">
                    <span className="dp-stat-label">System Measured Volume</span>
                    <span className="dp-stat-value">{stats.totalMeasured.toLocaleString()} L</span>
                    <div className="dp-stat-footer text-emerald-500">ATG Verified Litres</div>
                </div>
                <div className={`ds-card dp-stat-card ${stats.totalVariance < 0 ? 'dp-stat-card--danger' : ''}`}>
                    <span className="dp-stat-label">Cumulative Variance</span>
                    <span className="dp-stat-value">{stats.totalVariance > 0 ? '+' : ''}{stats.totalVariance.toLocaleString()} L</span>
                    <div className="dp-stat-footer">Efficiency Check</div>
                </div>
                <div className="ds-card dp-stat-card">
                    <span className="dp-stat-label">Discrepancy Rate</span>
                    <span className="dp-stat-value">{stats.discrepancyRate}%</span>
                    <div className="dp-stat-footer text-amber-500">Audit Flags</div>
                </div>
            </section>

            {/* Main Content Area */}
            <div className="dp-main-layout">
                {/* Filters & Table Section */}
                <div className="dp-content-left">
                    <div className="dp-table-actions">
                        <div className="dp-search-box">
                            <FiSearch className="dp-search-icon" />
                            <input 
                                type="text" 
                                placeholder="Search Invoice # or Supplier..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="dp-filter-pills">
                            {(['ALL', 'VERIFIED', 'NEEDS_REVIEW', 'DISPUTED'] as const).map(status => (
                                <button 
                                    key={status}
                                    className={`dp-filter-pill ${statusFilter === status ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status === 'ALL' ? 'Total History' : status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ds-card dp-table-card">
                        <table className="dp-table">
                            <thead>
                                <tr>
                                    <th>Date & Time</th>
                                    <th>Invoice / Ticket</th>
                                    <th>Tank / Product</th>
                                    <th>Variance (L)</th>
                                    <th>Status</th>
                                    <th>Audit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => (
                                        <tr key={i}>
                                            <td colSpan={6}><div className="dp-skeleton-row" /></td>
                                        </tr>
                                    ))
                                ) : filteredDeliveries.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="dp-empty-state">
                                            No delivery records found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDeliveries.map(d => (
                                        <tr 
                                            key={d.id} 
                                            className={selectedDelivery?.id === d.id ? 'active' : ''}
                                            onClick={() => setSelectedDelivery(d)}
                                        >
                                            <td>
                                                <div className="dp-td-datetime">
                                                    <span className="dp-td-date">{format(new Date(d.ts), 'dd MMM yyyy')}</span>
                                                    <span className="dp-td-time">{format(new Date(d.ts), 'HH:mm')}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="dp-td-id">
                                                    <strong>{d.invoiceNo || 'N/A'}</strong>
                                                    <span>{d.supplier || 'Direct Terminal'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="dp-td-tank">
                                                    <strong>{tankNames[d.tankId] || 'Unit Alpha'}</strong>
                                                    <span>{d.product || 'Diesel'}</span>
                                                </div>
                                            </td>
                                            <td className={Math.abs(d.variance?.liters || 0) > 50 ? 'text-rose-500' : 'text-slate-500'}>
                                                <strong>{d.variance?.liters || 0} L</strong>
                                            </td>
                                            <td>
                                                <span className={`dp-status-badge dp-status-badge--${d.status?.toLowerCase()}`}>
                                                    {d.status === 'VERIFIED' ? <FiCheckCircle size={10} /> : <FiClock size={10} />}
                                                    {d.status}
                                                </span>
                                            </td>
                                            <td>
                                                <button 
                                                    className="dp-action-btn"
                                                    title="Download Delivery PDF Report"
                                                    onClick={(e) => { e.stopPropagation(); handleExportPDF(d); }}
                                                >
                                                    <FiFileText size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Sidebar Detail Inspector */}
                <aside className={`dp-inspector ds-card ${selectedDelivery ? 'dp-inspector--open' : ''}`}>
                    {selectedDelivery ? (
                        <>
                            <div className="dp-inspector-header">
                                <h3>Forensic Inspection</h3>
                                <button className="dp-inspector-close" onClick={() => setSelectedDelivery(null)}>&times;</button>
                            </div>
                            <div className="dp-inspector-body">
                                <div className="dp-inspector-hero">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Variance Analysis</span>
                                    <h2 className={Math.abs(selectedDelivery.variance?.liters || 0) > 50 ? 'text-rose-500' : 'text-emerald-500'}>
                                        {selectedDelivery.variance?.liters || 0} Litres
                                    </h2>
                                </div>
                                
                                <div className="dp-detail-section">
                                    <label>Basic Information</label>
                                    <div className="dp-detail-row"><span>ID</span> <strong>{selectedDelivery.id.split('-')[0]}...</strong></div>
                                    <div className="dp-detail-row"><span>Supplier</span> <strong>{selectedDelivery.supplier || 'Terminal'}</strong></div>
                                    <div className="dp-detail-row"><span>Invoice #</span> <strong>{selectedDelivery.invoiceNo}</strong></div>
                                </div>

                                <div className="dp-detail-section">
                                    <label>ATG Physics Audit</label>
                                    <div className="dp-detail-row"><span>Waybill Vol</span> <strong>{selectedDelivery.invoiceLiters} L</strong></div>
                                    <div className="dp-detail-row"><span>Standard Vol</span> <strong>{selectedDelivery.measured?.standardizedLiters || 0} L</strong></div>
                                    <div className="dp-detail-row"><span>Observed Vol</span> <strong>{selectedDelivery.measured?.observedLiters || 0} L</strong></div>
                                    <div className="dp-detail-row"><span>Variance %</span> <strong className={Math.abs(selectedDelivery.variance?.pct || 0) > 0.5 ? 'text-rose-500' : ''}>{(selectedDelivery.variance?.pct || 0).toFixed(2)}%</strong></div>
                                </div>

                                <div className="dp-detail-section">
                                    <label>Conditions</label>
                                    <div className="dp-detail-row"><span>Temp (°C)</span> <strong>{selectedDelivery.measured?.tempC || 'N/A'}</strong></div>
                                    <div className="dp-detail-row"><span>Dip Level</span> <strong>{selectedDelivery.notes?.match(/Dip: ([0-9.]+)L/)?.[1] || 'Manual Seal'}</strong></div>
                                </div>

                                {selectedDelivery.notes && (
                                    <div className="dp-detail-notes">
                                        <label>Auditor Notes</label>
                                        <p>{selectedDelivery.notes}</p>
                                    </div>
                                )}
                            </div>
                            <div className="dp-inspector-footer">
                                <button className="dp-btn dp-btn--outline w-full" onClick={() => handleExportPDF(selectedDelivery)}>
                                    <FiDownload /> Download Forensic PDF
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="dp-inspector-placeholder">
                            <FiSearch size={40} />
                            <p>Select a delivery record for forensic inspection</p>
                        </div>
                    )}
                </aside>
            </div>

            {/* Consolidated Transaction History (Moved from Fuel Statistics) */}
            <div className="dp-bottom-tables-grid mt-12 space-y-10">
                {/* Orders Section */}
                <div className="ds-card tdv-section-card pb-6">
                    <div className="section-header flex items-center justify-start gap-6 p-6">
                        <button className="btn-add-new flex items-center gap-2" onClick={() => {
                            if (shiftStatus !== 'open') {
                                setToast({
                                    message: 'No active shift found. Please start a shift first.',
                                    type: 'warning',
                                    actionLabel: 'Start New Shift',
                                    onAction: () => openModal('shift-open')
                                });
                            } else {
                                // Logic to add new order
                                alert('Order creation modal would go here');
                            }
                        }}>
                            <div className="plus-icon"><FiPlus /></div>
                            <span>Add New Order</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="section-icon-box">
                                <FiGrid className="text-primary" />
                            </div>
                            <h3 className="section-title">Logistics: New Orders</h3>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="tdv-transaction-table">
                            <thead>
                                <tr>
                                    <th>PO NUMBER</th>
                                    <th>CUSTOMER</th>
                                    <th>USER</th>
                                    <th>TOTAL LITERS</th>
                                    <th>DELIVERY DATE</th>
                                    <th>DELIVERY TIME</th>
                                    <th>CREATED ON</th>
                                    <th>ADDRESS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockOrders.map((order) => (
                                    <tr key={order.po} className={order.highlighted ? 'row-highlighted' : ''}>
                                        <td className="font-mono">{order.po}</td>
                                        <td className="customer-name">{order.customer}</td>
                                        <td>{order.user}</td>
                                        <td className="font-bold">{order.amount.toLocaleString()}</td>
                                        <td>{order.date}</td>
                                        <td>{order.time}</td>
                                        <td>{order.created}</td>
                                        <td className="address-col">{order.address}</td>
                                        <td className="action-col">Details</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Deliveries Section */}
                <div className="ds-card tdv-section-card pb-6">
                    <div className="section-header flex items-center justify-start gap-6 p-6">
                        <button className="btn-add-new flex items-center gap-2" onClick={() => {
                            if (shiftStatus !== 'open') {
                                setToast({
                                    message: 'No active shift found. Please start a shift first.',
                                    type: 'warning',
                                    actionLabel: 'Start New Shift',
                                    onAction: () => openModal('shift-open')
                                });
                            } else {
                                openModal('delivery');
                            }
                        }}>
                            <div className="plus-icon"><FiPlus /></div>
                            <span>Add New Delivery</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="section-icon-box">
                                <FiActivity className="text-primary" />
                            </div>
                            <h3 className="section-title">Logistics: New Deliveries</h3>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="tdv-transaction-table">
                            <thead>
                                <tr>
                                    <th>PO NUMBER</th>
                                    <th>SUPPLIER</th>
                                    <th>USER</th>
                                    <th>TOTAL LITERS</th>
                                    <th>DELIVERY DATE</th>
                                    <th>DELIVERY TIME</th>
                                    <th>CREATED ON</th>
                                    <th>ADDRESS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockDeliveries.map((delivery) => (
                                    <tr key={delivery.po} className={delivery.highlighted ? 'row-highlighted' : ''}>
                                        <td className="font-mono">{delivery.po}</td>
                                        <td className="customer-name">{delivery.supplier}</td>
                                        <td>{delivery.user}</td>
                                        <td className="font-bold">{delivery.amount.toLocaleString()}</td>
                                        <td>{delivery.date}</td>
                                        <td>{delivery.time}</td>
                                        <td>{delivery.created}</td>
                                        <td className="address-col">{delivery.address}</td>
                                        <td className="action-col">Details</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    actionLabel={toast.actionLabel}
                    onAction={toast.onAction}
                    onClose={() => setToast(null)} 
                />
            )}
        </div>
    );
};
