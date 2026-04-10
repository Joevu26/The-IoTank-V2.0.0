import React, { useState } from 'react';
import {
    FiArrowRight, FiPhone, FiMail,
    FiShield, FiCheck, FiX, FiLayers, 
    FiSettings, FiInfo
} from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useSites } from '@/hooks/useSupabase';
import { useModals } from '@/contexts/ModalContext';
import { useMarketNews } from '@/hooks/useMarketNews';
import { supabase } from '@/config/supabase';
import { SupportCategory, SupportSeverity } from '@/types';
import { FAQ_CATEGORIES } from './HelpConstants';
import { HelpModals } from './HelpModals';
import './HelpPage.css';

export const HelpPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { openModal } = useModals();
    const orgId = currentUser?.stationId || '';
    const { tanks } = useTanks(orgId);
    const { sites } = useSites(orgId);
    const { status: newsStatus } = useMarketNews();

    // State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [attachSnapshot, setAttachSnapshot] = useState(true);
    const [activeCategory, setActiveCategory] = useState(FAQ_CATEGORIES[0].name);
    const [openFaqId, setOpenFaqId] = useState<number | null>(null);

    const [ticketForm, setTicketForm] = useState({
        category: 'telemetry_offline' as SupportCategory,
        severity: 'medium' as SupportSeverity,
        siteId: '',
        tankId: '',
        description: '',
    });

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !orgId) return;

        setIsSubmitting(true);
        setShowSuccess(false);
        try {
            const { error } = await supabase
                .from('support_tickets')
                .insert({
                    station_id: orgId,
                    subject: `Escalation: ${ticketForm.category.replace(/_/g, ' ')}`,
                    description: ticketForm.description,
                    status: 'open',
                    priority: ticketForm.severity,
                    created_at: new Date().toISOString()
                });
            
            if (error) throw error;

            setShowSuccess(true);
            setTicketForm({ category: 'telemetry_offline', severity: 'medium', siteId: '', tankId: '', description: '' });
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (error) {
            console.error('Error creating ticket:', error);
            alert('Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentFaqs = FAQ_CATEGORIES.find(c => c.name === activeCategory)?.items || [];

    return (
        <div className="help-page">
            {showSuccess && (
                <div className="support-success-toast animate-in">
                    <FiCheck />
                    <span>Support Ticket Created. Our team is investigating.</span>
                    <button onClick={() => setShowSuccess(false)}><FiX size={14}/></button>
                </div>
            )}

            {/* ── TOP TIER: TICKETING & EMERGENCY ─────────────────────────── */}
            <div className="support-footer-grid mb-10">
                <div className="glass-panel ticket-panel-legacy">
                    <span className="uppercase-label mb-6">Support Escalation</span>
                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <select
                                className="form-input-cc"
                                value={ticketForm.category}
                                onChange={e => setTicketForm({ ...ticketForm, category: e.target.value as SupportCategory })}
                            >
                                <option value="telemetry_offline">Telemetry Offline</option>
                                <option value="calibration_drift">Calibration Drift</option>
                                <option value="ai_forecasting">AI Sync Error</option>
                                <option value="billing_subscription">Billing & Plan</option>
                                <option value="compliance_reporting">Regulatory Reporting</option>
                                <option value="user_access">Access Control</option>
                                <option value="other">General Query</option>
                            </select>
                            <select
                                className="form-input-cc"
                                value={ticketForm.severity}
                                onChange={e => setTicketForm({ ...ticketForm, severity: e.target.value as SupportSeverity })}
                            >
                                <option value="low">Low Impact</option>
                                <option value="medium">Medium Impact</option>
                                <option value="high">High Operational</option>
                                <option value="critical">Critical - System Down</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <select
                                className="form-input-cc"
                                value={ticketForm.siteId}
                                onChange={e => setTicketForm({ ...ticketForm, siteId: e.target.value })}
                            >
                                <option value="">Select Site</option>
                                {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
                            </select>
                            <select
                                className="form-input-cc"
                                value={ticketForm.tankId}
                                onChange={e => setTicketForm({ ...ticketForm, tankId: e.target.value })}
                            >
                                <option value="">Select Tank</option>
                                {tanks.filter(t => !ticketForm.siteId || t.siteId === ticketForm.siteId).map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <textarea
                            className="form-input-cc min-h-[80px]"
                            placeholder="Describe the operational issue..."
                            required
                            value={ticketForm.description}
                            onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })}
                        />
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300"
                                    checked={attachSnapshot}
                                    onChange={e => setAttachSnapshot(e.target.checked)}
                                />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Attach Snapshot</span>
                            </label>
                            <button
                                type="submit"
                                className="help-btn-submit-legacy"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? '...' : 'Initiate Ticket'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="emergency-contact-pro">
                    <div className="glass-panel emergency-card-legacy">
                        <span className="uppercase-label text-rose-500 mb-4">🚨 Emergency line</span>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="contact-icon-legacy"><FiPhone /></div>
                                <a href="tel:+254111746901" className="text-xl font-black text-slate-900">+254 111 746 901</a>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="contact-icon-legacy email"><FiMail /></div>
                                <a href="mailto:iotank.com@gmail.com" className="text-sm font-bold text-slate-700">iotank.com@gmail.com</a>
                            </div>
                        </div>
                    </div>
                    
                    <div className="glass-panel sla-panel-legacy">
                        <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Global Support Hours</p>
                        <p className="text-xs font-bold text-slate-700">Mon - Fri: 08:30 - 18:00 (EAT)</p>
                        <div className="mt-3 flex gap-2">
                            <div className="tag-cc-mini green">24/7 Priority Response</div>
                        </div>
                    </div>
                </div>
            </div>

            <header className="page-header mb-10">
                <div className="flex items-center gap-3">
                    <FiShield className="text-accent" size={32} />
                    <h1 className="text-3xl font-black">Command Center <span className="text-[#7A7A95] font-normal">Support</span></h1>
                </div>
                <p className="text-slate-500 font-medium mt-2">Operational assistance, diagnostics, and environment status.</p>
            </header>

            {/* ── ROW 2: HEALTH + QUICK ACTIONS ────────────────────────── */}
            <div className="command-row mb-10">
                <div className="glass-panel health-panel-pro">
                    <span className="uppercase-label mb-6">Live System Health</span>
                    <div className="health-stack">
                        <div className="health-row">
                            <div className="flex items-center gap-3">
                                <div className={`status-pulse ${tanks.length > 0 ? 'online' : 'warn'}`}></div>
                                <span className="health-tag">Edge Telemetry</span>
                            </div>
                            <span className="health-data">{tanks.length > 0 ? 'ACTIVE' : 'WAITING'}</span>
                        </div>
                        <div className="health-row">
                            <div className="flex items-center gap-3">
                                <div className={`status-pulse ${tanks.length > 0 ? 'online' : 'offline'}`}></div>
                                <span className="health-tag">IoT Nodes</span>
                            </div>
                            <span className="health-data">{tanks.length} / {tanks.length} ONLINE</span>
                        </div>
                        <div className="health-row">
                            <div className="flex items-center gap-3">
                                <div className={`status-pulse ${newsStatus === 'ok' ? 'online' : 'warn'}`}></div>
                                <span className="health-tag">Market Feed</span>
                            </div>
                            <span className="health-data">{newsStatus === 'ok' ? 'NOMINAL' : 'DELAYED'}</span>
                        </div>
                    </div>
                </div>

                <div className="glass-panel quick-tools-panel">
                    <span className="uppercase-label mb-6">Quick Actions</span>
                    <div className="tools-grid-legacy" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="tool-card-legacy" onClick={() => openModal('support-setup')}>
                            <FiLayers className="text-accent" size={24} />
                            <div>
                                <h4>Setup Wizard</h4>
                                <p>Provision nodes & tanks.</p>
                            </div>
                        </div>
                        <div className="tool-card-legacy" onClick={() => openModal('support-diagnostics')}>
                            <FiSettings className="text-slate-600" size={24} />
                            <div>
                                <h4>Diagnostics</h4>
                                <p>Run system scan.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── ROW 3: KNOWLEDGE BASE ─────────────────────────────────── */}
            <div className="kb-layout-legacy">
                <aside className="kb-sidebar-legacy">
                    <span className="uppercase-label mb-4 px-2">Knowledge Base</span>
                    <nav className="space-y-1">
                        {FAQ_CATEGORIES.map(cat => (
                            <button
                                key={cat.name}
                                className={`kb-nav-link-legacy ${activeCategory === cat.name ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat.name)}
                            >
                                {cat.icon} {cat.name}
                            </button>
                        ))}
                    </nav>
                </aside>

                <main className="kb-main-legacy">
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-4">
                        <FiInfo className="text-accent" size={24} />
                        <h2 className="text-xl font-black text-slate-800 m-0">{activeCategory}</h2>
                    </div>

                    <div className="faq-grid-legacy">
                        {currentFaqs.map(item => (
                            <div
                                key={item.id}
                                className={`faq-card-legacy ${openFaqId === item.id ? 'open' : ''}`}
                                onClick={() => setOpenFaqId(openFaqId === item.id ? null : item.id)}
                            >
                                <div className="faq-q-legacy">
                                    <span>{item.question}</span>
                                    <FiArrowRight className="arrow-icon" />
                                </div>
                                {openFaqId === item.id && (
                                    <div className="faq-a-legacy animate-in fade-in duration-300">
                                        {item.answer}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </main>
            </div>

            <HelpModals />
        </div>
    );
};
