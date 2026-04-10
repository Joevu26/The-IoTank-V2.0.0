/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiDollarSign, FiActivity, FiX, FiShield, FiUser, FiClock, FiSmartphone } from 'react-icons/fi';
import { Tank, ShiftDocument } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useHistoricalReadings, createShift } from '@/hooks/useSupabase';

interface ShiftClosureWizardProps {
    tank: Tank;
    onClose: () => void;
    onSuccess?: () => void;
    isInline?: boolean;
}

// Local type for Wizard UI State
interface WizardPumpReading {
    pumpId: string;
    pumpName: string;
    startReading: number;
    endReading: number;
    litersSold: number;
    pricePerLiter: number;
    totalSalesAmount: number;
}

export const ShiftClosureWizard: React.FC<ShiftClosureWizardProps> = ({ tank, onClose, onSuccess, isInline = false }) => {
    const { currentUser } = useAuth();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1 State: Pump Readings
    const [pumpReadings, setPumpReadings] = useState<WizardPumpReading[]>([
        {
            pumpId: `pump-${tank.id}`,
            pumpName: `${tank.name} Pump`,
            startReading: 0,
            endReading: 0,
            litersSold: 0,
            pricePerLiter: 1.50,
            totalSalesAmount: 0
        }
    ]);

    // Step 2 State: Cash Reconciliation
    const [cashCollected, setCashCollected] = useState<number>(0);
    const [mpesaCollected, setMpesaCollected] = useState<number>(0);
    const [cardCollected, setCardCollected] = useState<number>(0);

    // Step 3 State: Review (Derived)
    const totalSalesVolume = pumpReadings.reduce((sum, p) => sum + p.litersSold, 0);
    const expectedCash = pumpReadings.reduce((sum, p) => sum + p.totalSalesAmount, 0);
    const totalCollected = cashCollected + mpesaCollected + cardCollected;
    const cashVariance = totalCollected - expectedCash;

    // Time range for the shift (last 8 hours)
    const [timeRange] = useState({
        start: Date.now() - (8 * 60 * 60 * 1000),
        end: Date.now()
    });
    const { readings } = useHistoricalReadings(tank.stationId, tank.id, timeRange);

    // Calculate real drawdown if we have telemetry
    let tankDrawdown = 0;
    if (readings && readings.length > 0) {
        const startVolume = readings[0].volumeCorrected;
        const endVolume = readings[readings.length - 1].volumeCorrected;
        const measuredDrawdown = startVolume - endVolume;
        // If telemetry showed filling during shift, drawdown might look negative;
        // logic should handle it, but for simplistic variance we take max 0 or drawdown
        tankDrawdown = Math.max(0, measuredDrawdown);
    } else {
        // Fallback for simulation if no telemetry exists for this tank
        tankDrawdown = totalSalesVolume > 0 ? totalSalesVolume + 15 : 0;
    }

    const volumeVariance = totalSalesVolume - tankDrawdown;

    let riskLevel: 'Low' | 'Moderate' | 'High' = 'Low';
    let riskConfidence = 0;
    if (Math.abs(volumeVariance) > 20 || Math.abs(cashVariance) > 500) {
        riskLevel = 'Moderate';
        riskConfidence = 82;
    }
    if (Math.abs(volumeVariance) > 100 || Math.abs(cashVariance) > 5000) {
        riskLevel = 'High';
        riskConfidence = 95;
    }

    const shiftIntegrityScore = riskLevel === 'Low' ? 98 : (riskLevel === 'Moderate' ? 82 : 45);

    // Step 3 State: Checklist & Evidence
    const [checklist, setChecklist] = useState({
        pumpReadingsEntered: false,
        cashRecorded: false,
        varianceExplained: false,
    });
    const [supervisorNotes, setSupervisorNotes] = useState('');

    useEffect(() => {
        // Auto-check first two based on state, third requires manual interaction or valid state
        setChecklist(prev => ({
            ...prev,
            pumpReadingsEntered: totalSalesVolume > 0,
            cashRecorded: totalCollected > 0,
            // If no variance, auto-check. Otherwise require notes.
            varianceExplained: (Math.abs(volumeVariance) <= 5 && Math.abs(cashVariance) <= 10) || supervisorNotes.trim().length > 5
        }));
    }, [totalSalesVolume, totalCollected, volumeVariance, cashVariance, supervisorNotes]);

    const isChecklistComplete = checklist.pumpReadingsEntered && checklist.cashRecorded && checklist.varianceExplained;

    // Handlers
    const handleReadingChange = (index: number, newEndReading: number) => {
        const updated = [...pumpReadings];
        const pump = updated[index];
        pump.endReading = newEndReading;
        pump.litersSold = Math.max(0, newEndReading - pump.startReading);
        pump.totalSalesAmount = pump.litersSold * pump.pricePerLiter;
        setPumpReadings(updated);
    };

    const handleSubmit = async () => {
        if (!currentUser) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const shiftStartMs = Date.now() - (8 * 60 * 60 * 1000); // Mock 8 hour shift

            // Convert array of readings to a map for ShiftDocument
            const readingsRecord: Record<string, any> = {};
            pumpReadings.forEach(p => {
                readingsRecord[p.pumpName] = { start: p.startReading, end: p.endReading };
            });

            const shiftData: Omit<ShiftDocument, 'id'> = {
                openedAt: new Date(shiftStartMs).toISOString(),
                closedAt: new Date().toISOString(),
                durationMin: 8 * 60,
                siteId: tank.siteId,
                nodeId: tank.sensorId || 'esp_simulated',
                tankId: tank.id,

                pumpReadings: readingsRecord,
                volumeSoldLiters: totalSalesVolume,

                expected: {
                    cash: expectedCash, // Simplifying mock to put everything in cash
                    mpesa: 0,
                    pos: 0,
                    total: expectedCash
                },
                received: {
                    cash: cashCollected,
                    mpesa: mpesaCollected,
                    pos: cardCollected,
                    total: totalCollected
                },
                variance: {
                    amount: cashVariance,
                    pct: expectedCash > 0 ? (cashVariance / expectedCash) * 100 : 0
                },

                status: Math.abs(cashVariance) < 1 ? 'BALANCED' : (cashVariance > 0 ? 'OVER' : 'SHORT'),
                reviewState: 'CLOSED',

                closedBy: { userId: currentUser.authUserId, display: currentUser.displayName || currentUser.email || 'Operator' },
                createdAt: new Date().toISOString()
            };

            // Save to Supabase
            await createShift(shiftData);

            // Also log a 'reconciliation' transaction for the tank history
            // usage: logTransaction(...) would be better if passed in as prop or imported, 
            // but for now we focus on the shift record itself.

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Shift closure failed', err);
            setError('Failed to close shift. Please check connection.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Steps
    const renderStep1 = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Closing Pump Readings</h3>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wide">Step 1 of 3</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {pumpReadings.map((pump, idx) => (
                    <div key={pump.pumpId} className="p-5 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-xs">
                                    P{idx + 1}
                                </div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{pump.pumpName}</label>
                            </div>
                            <div className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                START: {pump.startReading.toLocaleString()}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 relative group">
                                <span className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 text-xs font-bold uppercase tracking-wider group-focus-within:text-indigo-500 transition-colors">
                                    End
                                </span>
                                <input
                                    type="number"
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-lg"
                                    value={pump.endReading}
                                    placeholder="0"
                                    onChange={(e) => handleReadingChange(idx, Number(e.target.value))}
                                />
                            </div>
                            <div className="text-right min-w-[100px]">
                                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{pump.litersSold.toFixed(1)} <span className="text-xs text-indigo-400">L</span></div>
                                <div className="text-xs font-semibold text-slate-400">${pump.totalSalesAmount.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between items-center px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-semibold text-sm uppercase tracking-wide">Total Volume</span>
                <span className="text-xl font-bold text-slate-800 dark:text-white font-mono">{totalSalesVolume.toFixed(1)} L</span>
            </div>

            <button
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all transform active:scale-[0.98] mt-4"
                onClick={() => setStep(2)}
            >
                Continue to Reconciliation
            </button>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Cash Reconciliation</h3>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wide">Step 2 of 3</span>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-5 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10">
                    <span className="text-blue-800 dark:text-blue-200 font-semibold text-sm uppercase tracking-wider block mb-1">Expected Cash</span>
                    <span className="text-3xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">${expectedCash.toFixed(2)}</span>
                </div>
                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-white/20 to-transparent"></div>
                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-full backdrop-blur-sm">
                    <FiDollarSign className="text-blue-600 dark:text-blue-300" size={24} />
                </div>
            </div>

            <div className="space-y-4">
                {[
                    { label: 'Cash (Notes/Coins)', value: cashCollected, setter: setCashCollected, icon: '💵' },
                    { label: 'M-Pesa / Mobile', value: mpesaCollected, setter: setMpesaCollected, icon: '📱' },
                    { label: 'Card / POS', value: cardCollected, setter: setCardCollected, icon: '💳' }
                ].map((item, i) => (
                    <div key={i} className="group">
                        <label className="text-xs uppercase font-bold text-slate-500 mb-1.5 block ml-1">{item.label}</label>
                        <div className="relative transition-all duration-200 ease-in-out transform group-focus-within:-translate-y-0.5">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg grayscale opacity-70 group-focus-within:grayscale-0 group-focus-within:opacity-100 transition-all">{item.icon}</span>
                            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-lg">$</span>
                            <input
                                type="number"
                                className="w-full pl-14 pr-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-lg font-medium text-slate-700 dark:text-slate-200 shadow-sm"
                                value={item.value === 0 ? '' : item.value}
                                onChange={(e) => item.setter(Number(e.target.value))}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-lg transition-colors" onClick={() => setStep(1)}>
                    Back
                </button>
                <button className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all transform active:scale-[0.98]" onClick={() => setStep(3)}>
                    Review & Close
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => {
        const isBalanced = Math.abs(cashVariance) < 1; // Tolerance of $1
        const varianceColor = isBalanced ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : (cashVariance > 0 ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20');
        const borderColor = isBalanced ? 'border-emerald-200 dark:border-emerald-800' : (cashVariance > 0 ? 'border-blue-200 dark:border-blue-800' : 'border-rose-200 dark:border-rose-800');
        const statusText = isBalanced ? 'Perfectly Balanced' : (cashVariance > 0 ? 'Cash Overage' : 'Cash Shortage');
        const icon = isBalanced ? <FiCheckCircle size={40} /> : <FiAlertTriangle size={40} />;

        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="text-center pt-4">
                    <div className={`inline-flex items-center justify-center p-4 rounded-full mb-4 shadow-sm ${varianceColor} ${borderColor} border-4`}>
                        {icon}
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">{statusText}</h2>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                        {isBalanced
                            ? "Great job! All collections match the pump readings."
                            : "Please review the discrepancies below before closing."}
                    </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    {/* Variance Intelligence Panel */}
                    <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <FiActivity className="text-indigo-500" /> Variance Intelligence
                        </h4>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="block text-xs text-slate-500 mb-1">Volume Variance</span>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Tank Drawdown: {tankDrawdown.toFixed(1)}L</span>
                                    <span className={`font-bold ${Math.abs(volumeVariance) > 5 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {volumeVariance > 0 ? '+' : ''}{volumeVariance.toFixed(1)}L
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <span className="block text-xs text-slate-500 mb-1">Revenue Variance</span>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Cash Gap</span>
                                    <span className={`font-bold ${cashVariance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {cashVariance > 0 ? '+' : ''}${cashVariance.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={`p-3 rounded-lg border flex justify-between items-center ${riskLevel === 'Low' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : (riskLevel === 'Moderate' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800')}`}>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold uppercase">Risk Classification</span>
                                <span className="font-bold flex items-center gap-1">
                                    {riskLevel} Risk
                                    <span className="text-xs font-normal opacity-80">(Confidence {riskConfidence}%)</span>
                                </span>
                            </div>
                            {riskLevel !== 'Low' && (
                                <div className="text-xs font-medium text-right">
                                    Suggested Causes:<br />
                                    • Meter drift • Unrecorded test
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pre-Closure Checklist */}
                    <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <FiCheckCircle className="text-emerald-500" /> Pre-Closure Checklist
                        </h4>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                {checklist.pumpReadingsEntered ? <FiCheckCircle className="text-emerald-500" /> : <FiX className="text-slate-300" />}
                                <span className={`text-sm ${checklist.pumpReadingsEntered ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400'}`}>Pump readings entered</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {checklist.cashRecorded ? <FiCheckCircle className="text-emerald-500" /> : <FiX className="text-slate-300" />}
                                <span className={`text-sm ${checklist.cashRecorded ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400'}`}>Cash collections recorded</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {checklist.varianceExplained ? <FiCheckCircle className="text-emerald-500" /> : <FiAlertTriangle className="text-amber-500" />}
                                <span className={`text-sm ${checklist.varianceExplained ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-amber-600 font-bold'}`}>Variance justified (or none)</span>
                            </div>
                        </div>

                        {(!checklist.varianceExplained || riskLevel !== 'Low') && (
                            <div className="mt-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Supervisor Notes / Evidence</label>
                                <textarea
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-2 outline-none"
                                    placeholder="Explain the variance or attach notes before closing..."
                                    rows={3}
                                    value={supervisorNotes}
                                    onChange={(e) => setSupervisorNotes(e.target.value)}
                                ></textarea>
                            </div>
                        )}
                    </div>

                    {/* Audit Trail */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <FiShield className="text-slate-500" /> Audit Trail
                            </h4>
                            <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 ${shiftIntegrityScore >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                Integrity Score: {shiftIntegrityScore}%
                            </span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-xs text-slate-500 space-y-1">
                            <div className="flex items-center gap-2"><FiUser /> Closed by: {currentUser?.email || 'Unknown User'} (Manager)</div>
                            <div className="flex items-center gap-2"><FiClock /> Time: {new Date().toLocaleTimeString()}</div>
                            <div className="flex items-center gap-2"><FiSmartphone /> Device ID: Trusted Terminal 1</div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                        <FiAlertTriangle className="shrink-0" />
                        {error}
                    </div>
                )}

                <div className="flex gap-4 mt-8 pt-2">
                    <button className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-lg transition-colors" onClick={() => setStep(2)}>
                        Back
                    </button>
                    <button
                        className={`flex-[2] py-3 px-4 text-white font-bold rounded-lg shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2
                        ${(!isChecklistComplete || isSubmitting) ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700'}`}
                        onClick={handleSubmit}
                        disabled={!isChecklistComplete || isSubmitting}
                    >
                        {isSubmitting ? <FiActivity className="animate-spin" /> : <FiShield />}
                        {isSubmitting ? 'Securing Shift...' : 'Close Shift Securely'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={isInline ? "wizard-inline animate-fadeIn" : "wizard-overlay"}>
            <div className={`wizard-container card ${isInline ? 'w-full shadow-none border-none p-4' : 'max-w-xl w-full p-8 shadow-2xl animate-scaleIn'}`}>
                <button
                    className={`absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 z-50`}
                    onClick={onClose}
                >
                    <FiX size={20} />
                </button>

                {/* Progress Bar */}
                <div className="flex gap-3 mb-8 px-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    ))}
                </div>

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </div>
        </div>
    );
};
