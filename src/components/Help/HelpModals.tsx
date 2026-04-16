import React, { useState, useEffect } from 'react';
import {
    FiX, FiCheck, FiSettings,
    FiLayers, FiTerminal
} from 'react-icons/fi';
import { useModals } from '@/contexts/ModalContext';
import { motion } from 'framer-motion';
import './HelpModals.css';

export const HelpModals: React.FC = () => {
    const { activeModal, closeModal } = useModals();

    if (!activeModal || !activeModal.startsWith('support-')) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">

                {activeModal === 'support-setup' && <SetupWizard onClose={closeModal} />}
                {activeModal === 'support-diagnostics' && <SystemDiagnostics onClose={closeModal} />}

            </div>
        </div>
    );
};

/* ── 1. SETUP WIZARD ─────────────────────────────────────────────── */
const SetupWizard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [step, setStep] = useState(1);
    return (
        <div className="p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Configuration Wizard</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Step {step} of 3: Infrastructure Mapping</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Close" aria-label="Close modal"><FiX size={20} /></button>
            </header>

            <div className="space-y-6 min-h-[300px]">
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-4">
                            <FiInfo className="text-blue-500 mt-1" size={18} />
                            <p className="text-sm font-medium text-blue-800">This wizard will guide you through provisioning new IoT nodes and mapping them to physical fuel tanks.</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Site Identification</label>
                            <input type="text" className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold" placeholder="Region / Station Name" />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="operational-tier" className="text-[10px] font-black text-slate-400 uppercase">Operational Tier</label>
                            <select 
                                id="operational-tier"
                                className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold"
                                title="Select Operational Tier"
                            >
                                <option>Retail Forecourt</option>
                                <option>Industrial Depot</option>
                                <option>Logistics Hub</option>
                            </select>
                        </div>
                    </div>
                )}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 text-center py-10">
                        <FiLayers className="mx-auto text-accent mb-4" size={48} />
                        <h3 className="text-xl font-black">Scanning for Local Nodes...</h3>
                        <p className="text-slate-400 mt-2">Ensure your IoT node is powered on and in 'Provisioning Mode'.</p>
                        <div className="max-w-xs mx-auto mt-8 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-accent w-2/3 animate-pulse"></div>
                        </div>
                    </div>
                )}
                 {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 text-center py-10">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiCheck size={32} />
                        </div>
                        <h3 className="text-xl font-black">Provisioning Complete</h3>
                        <p className="text-slate-400 mt-2">Station physical layer mapped successfully and linked to security telemetry.</p>
                    </div>
                )}
            </div>

            <footer className="flex justify-between mt-8 pt-6 border-t border-slate-100">
                <motion.button
                    whileHover={{ scale: step === 1 ? 1 : 1.05 }}
                    whileTap={{ scale: step === 1 ? 1 : 0.95 }}
                    onClick={() => setStep(s => Math.max(1, s - 1))}
                    className="px-6 py-2 font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    disabled={step === 1}
                >
                    Back
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => step < 3 ? setStep(s => s + 1) : onClose()}
                    className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-accent transition-all shadow-lg shadow-slate-200"
                >
                    {step === 3 ? 'Finalize' : 'Continue'}
                </motion.button>
            </footer>
        </div>
    );
};


/* ── 3. SYSTEM DIAGNOSTICS ───────────────────────────────────────── */
const SystemDiagnostics: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [scanning, setScanning] = useState(true);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (scanning) {
            const interval = setInterval(() => {
                setProgress(p => {
                    if (p >= 100) {
                        setScanning(false);
                        return 100;
                    }
                    return p + 2;
                });
            }, 50);
            return () => clearInterval(interval);
        }
    }, [scanning]);

    return (
        <div className="p-8">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><FiSettings size={20} /></div>
                    <h2 className="text-2xl font-black text-slate-800">System Probe</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Close" aria-label="Close modal"><FiX size={20} /></button>
            </header>

            <div className="min-h-[250px] flex flex-col justify-center">
                {scanning ? (
                    <div className="text-center">
                        <FiTerminal className="mx-auto text-slate-400 mb-4 animate-pulse" size={48} />
                        <h3 className="text-xl font-black text-slate-700">Injecting Diagnostic Probes...</h3>
                        <div className="max-w-md mx-auto mt-8">
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-2">
                                <span>Scanning Edge Network</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="diagnostic-progress-container h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="diagnostic-progress-bar h-full bg-accent transition-all duration-300" 
                                    ref={(el) => { if (el) el.style.width = `${progress}%`; }}
                                    title={`Scan Progress: ${progress}%`}
                                ></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in zoom-in-95 duration-500">
                        <div className="space-y-4">
                            {[
                                { label: 'Node Hardware', status: 'Online', val: 'V.2.1.0' },
                                { label: 'Database Sync', status: 'Healthy', val: '12ms Latency' },
                                { label: 'AI Prediction', status: 'Active', val: 'Baseline Set' },
                                { label: 'API Endpoints', status: 'Operational', val: 'HTTPS Secured' }
                            ].map((row, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                        <span className="text-sm font-bold text-slate-700">{row.label}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-emerald-600 uppercase">{row.status}</div>
                                        <div className="text-[10px] font-bold text-slate-400">{row.val}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onClose}
                            className="w-full mt-8 py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-accent transition-all"
                        >
                            Report Analyzed - Close
                        </motion.button>
                    </div>
                )}
            </div>
        </div>
    );
};

const FiInfo: React.FC<{ className?: string, size?: number }> = ({ className, size }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);
