import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTanks } from '@/hooks/useSupabase';
import { useAuth } from '@/hooks/useAuth';
import { AuditService } from '@/services/AuditService';
import { supabase } from '@/config/supabase';
import { FiX, FiInfo, FiDroplet, FiCheckCircle, FiShoppingCart, FiCalendar } from 'react-icons/fi';
import '../Inventory/AddTankModal.css';
import './QuickActions.css';

interface OrderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose }) => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId || '';
    const { tanks } = useTanks(stationId);

    const [isHibernating, setIsHibernating] = useState(false);
    const [formData, setFormData] = useState({
        tankId: '',
        supplier: '',
        product: '',
        quantity: '',
        expectedDate: new Date().toISOString().slice(0, 10),
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({
                ...prev,
                expectedDate: new Date().toISOString().slice(0, 10)
            }));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const executeSubmission = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.stationId) {
            alert('Organization context missing. Please sign in again.');
            return;
        }

        setSubmitting(true);
        try {
            const selectedTank = tanks.find(t => t.id === formData.tankId);
            
            const payload = {
                station_id: currentUser.stationId,
                auth_user_id: currentUser.authUserId,
                type: 'fuel_order',
                status: 'pending',
                data: {
                    tank_id: formData.tankId,
                    supplier: formData.supplier,
                    product: formData.product || selectedTank?.fuelType,
                    quantity: Number(formData.quantity),
                    expected_date: formData.expectedDate,
                    notes: formData.notes
                }
            };

            // Assuming we have an 'orders' table or similar. If not, we log the event.
            // For now, let's treat it as a task/event log since user wants it recorded.
            const { error: eventError } = await supabase.from('unified_events').insert([{
                station_id: currentUser.stationId,
                event_category: 'ORDER',
                event_type: 'ORDER_REQUESTED',
                description: `Fuel Order requested from ${formData.supplier}: ${formData.quantity}L of ${formData.product || selectedTank?.fuelType}.`,
                severity: 'INFO',
                metadata: payload.data,
                actor_id: currentUser.authUserId,
                actor_name: currentUser.displayName,
                actor_email: currentUser.email
            }]);

            if (eventError) throw eventError;

            // Also log via AuditService for consistency
            await AuditService.log(
                'ORDER',
                'ORDER_REQUESTED',
                stationId,
                `Strategic Order Broadcast: ${formData.quantity}L of ${formData.product || selectedTank?.fuelType} requested from ${formData.supplier}. Expected delivery: ${formData.expectedDate}`,
                'INFO',
                payload.data
            );

            alert('Order request recorded successfully in the forensic audit trail.');
            onClose();
        } catch (err: any) {
            alert(`Failed to record order: ${err.message || 'Unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const triggerHibernate = () => {
        setIsHibernating(true);
        setTimeout(() => setIsHibernating(false), 800);
    };

    const selectedTank = tanks.find(t => t.id === formData.tankId);

    return createPortal(
        <div className="add-tank-modal-overlay animate-in fade-in duration-300" onClick={triggerHibernate}>
            <div className="add-tank-modal-content max-w-xl" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-text-container">
                        <h2>Request New Fuel Order</h2>
                        <p>Initialize a strategic fuel procurement request.</p>
                        <div className="modal-header-badges">
                            <span className="modal-badge blue">Order</span>
                            <span className="modal-badge cyan">PROCUREMENT</span>
                        </div>
                    </div>
                    <button className={`close-btn ${isHibernating ? 'hibernate' : ''}`} type="button" onClick={onClose} title="Close Modal" aria-label="Close Modal"><FiX size={18} /></button>
                </div>

                <form onSubmit={executeSubmission} className="add-tank-form">
                    <div className="max-h-[70vh] overflow-y-auto px-1 pr-3">
                        <div className="atm-section">
                            <div className="atm-section-header">
                                <div className="atm-section-icon"><FiShoppingCart size={14} /></div>
                                <span className="atm-section-title">Procurement Details</span>
                            </div>

                            <div className="atm-section-body atm-grid atm-grid-2">
                                <div className="form-group atm-col-2">
                                    <label>Target Tank / Product Context</label>
                                    <select required title="Target Tank" aria-label="Target Tank" value={formData.tankId} onChange={e => {
                                        const newTankId = e.target.value;
                                        const tank = tanks.find(t => t.id === newTankId);
                                        setFormData({
                                            ...formData,
                                            tankId: newTankId,
                                            product: tank?.fuelType || ''
                                        });
                                    }}>
                                        <option value="">Select Target Storage...</option>
                                        {tanks.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.fuelType})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Supplier</label>
                                    <input required placeholder="e.g. Shell / Vivo Energy" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label>Product Type</label>
                                    <input required placeholder="e.g. Premium Diesel" value={formData.product} onChange={e => setFormData({ ...formData, product: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label>Order Quantity (L)</label>
                                    <input required type="number" placeholder="10000" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                                </div>

                                <div className="form-group">
                                    <label>Expected Delivery Date</label>
                                    <div className="relative">
                                        <input required type="date" title="Expected Date" aria-label="Expected Date" value={formData.expectedDate} onChange={e => setFormData({ ...formData, expectedDate: e.target.value })} />
                                        <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="form-group atm-col-2">
                                    <label>Special Instructions / Notes</label>
                                    <textarea 
                                        rows={3} 
                                        placeholder="Enter any specific procurement notes..." 
                                        value={formData.notes} 
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-400 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="tm-verification-card">
                            <FiCheckCircle size={18} />
                            <p>
                                This order request will be recorded in the centralized forensic audit trail for management review.
                            </p>
                        </div>

                        <div className="form-actions pt-4 pb-2">
                            <button type="button" className="btn-danger" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-submit" disabled={submitting}>
                                {submitting ? 'Recording Action...' : 'Request Order'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
