/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { FiX, FiTruck } from 'react-icons/fi';
import { Tank } from '@/types';
import { useTransactions } from '@/hooks/useTransactions';
import { useLatestReading } from '@/hooks/useSupabase';
import { useAuth } from '@/hooks/useAuth';
import { analyzeVariance } from '@/utils/thermalCorrection';

interface DeliveryEntryProps {
    tank: Tank;
    onClose: () => void;
}

export const DeliveryEntry: React.FC<DeliveryEntryProps> = ({ tank, onClose }) => {
    const { currentUser } = useAuth();
    const [amount, setAmount] = useState<number>(0);
    const [pricePerLiter, setPricePerLiter] = useState<number>(0);
    const [ticketId, setTicketId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [, setError] = useState<string | null>(null);
    const { logTransaction } = useTransactions(tank.stationId);

    // Fetch latest reading for verification
    const { reading: latestReading } = useLatestReading(tank.stationId, tank.id);

    // Sensor Verification State
    const [startVolume, setStartVolume] = useState<number>(0);
    const [endVolume, setEndVolume] = useState<number>(0);
    const [temperature, setTemperature] = useState<number>(20);

    // Initialize sensor validation fields when reading loads
    React.useEffect(() => {
        if (latestReading) {
            const currentVol = latestReading.volume || 0;
            setEndVolume(currentVol);
            // Guess start volume based on "current - delivery" is tricky before they type, so just default start to current for now
            // or perhaps default start to current and they edit it.
            setStartVolume(currentVol);
            setTemperature(latestReading.temperature || 20);
        }
    }, [latestReading]); // Only run when reading loads initially (or changes)

    const totalCost = amount * pricePerLiter;
    const sensorIncrease = Math.max(0, endVolume - startVolume);

    // Real-time Variance Analysis (Comparing Standardized Hardware Data vs Invoice)
    const varianceAnalysis = React.useMemo(() => {
        return analyzeVariance(
            amount,
            sensorIncrease,
            temperature,
            tank.fuelType as any || 'Diesel'
        );
    }, [amount, sensorIncrease, temperature, tank.fuelType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await logTransaction({
                type: 'delivery',
                tankId: tank.id,
                amount: amount,
                performedBy: currentUser?.authUserId || 'anonymous',
                metadata: {
                    deliveryTicketId: ticketId,
                    notes: `Delivery recorded. ${varianceAnalysis.explanation}`,
                    pricePerLiter: pricePerLiter,
                    totalCost: totalCost,
                    atgVolume: endVolume,
                    physicalVolume: amount,
                    variance: varianceAnalysis.totalVariance,
                    temperature: temperature,
                    varianceStatus: varianceAnalysis.status,
                    thermalVariance: varianceAnalysis.thermalVariance
                }
            });

            const message = `Delivery Logged Successfully!\n\n` +
                `Invoice: ${amount} L\n` +
                `Sensor Saw: ${sensorIncrease.toFixed(1)} L\n` +
                `Net Variance: ${varianceAnalysis.totalVariance.toFixed(1)} L\n\n` +
                `Analysis: ${varianceAnalysis.explanation}`;

            alert(message);
            onClose();
        } catch (err) {
            console.error('Delivery log failed:', err);
            setError('Failed to log delivery.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="wizard-overlay">
            <div className="wizard-container card max-w-2xl w-full p-8 relative flex gap-8">
                {/* Close Button */}
                <button className="absolute top-4 right-4 btn btn-icon" onClick={onClose}><FiX /></button>

                {/* Left Column: Input Form */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg text-primary">
                            <FiTruck size={24} />
                        </div>
                        <h2 className="text-xl font-bold">Log Delivery</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Invoice Data */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-bold uppercase text-secondary mb-3">Invoice Data</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="text-xs uppercase font-bold text-secondary mb-1 block">Volume (L) *</label>
                                    <input
                                        type="number"
                                        className="form-control text-lg font-bold"
                                        value={amount === 0 ? '' : amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        placeholder="0"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="text-xs uppercase font-bold text-secondary mb-1 block">Price / L *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-control text-lg"
                                        value={pricePerLiter === 0 ? '' : pricePerLiter}
                                        onChange={(e) => setPricePerLiter(Number(e.target.value))}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group mt-3">
                                <label className="text-xs uppercase font-bold text-secondary mb-1 block">Ticket ID</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={ticketId}
                                    onChange={(e) => setTicketId(e.target.value)}
                                    placeholder="INV-..."
                                />
                            </div>
                        </div>

                        {/* Sensor Reconciliation */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-bold uppercase text-secondary mb-3 flex justify-between">
                                Sensor Reconciliation
                                <span className="text-xs font-normal normal-case opacity-70">Verify against ATG</span>
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="form-group">
                                    <label className="text-xs uppercase font-bold text-secondary mb-1 block">Start Vol</label>
                                    <input
                                        type="number"
                                        className="form-control text-sm"
                                        value={startVolume}
                                        onChange={(e) => setStartVolume(Number(e.target.value))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="text-xs uppercase font-bold text-secondary mb-1 block">End Vol</label>
                                    <input
                                        type="number"
                                        className="form-control text-sm"
                                        value={endVolume}
                                        onChange={(e) => setEndVolume(Number(e.target.value))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="text-xs uppercase font-bold text-secondary mb-1 block">Temp (°C)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="form-control text-sm"
                                        value={temperature}
                                        onChange={(e) => setTemperature(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-right text-secondary">
                                Observed Increase: <strong>{sensorIncrease.toFixed(1)} L</strong>
                            </div>
                        </div>

                        <div className="pt-2 flex gap-3">
                            <button type="button" className="btn btn-outline flex-1" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Column: Analysis Panel */}
                <div className="w-64 border-l border-slate-200 dark:border-slate-700 pl-8 flex flex-col justify-center">
                    <h3 className="text-sm font-bold uppercase text-secondary mb-4">Variance Analysis</h3>

                    <div className={`p-4 rounded-lg mb-4 ${varianceAnalysis.status === 'MATCH' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        varianceAnalysis.status === 'WARNING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                            'bg-slate-100 text-slate-800'
                        }`}>
                        <div className="text-xs opacity-70 uppercase font-bold mb-1">Status</div>
                        <div className="font-bold">{varianceAnalysis.status === 'MATCH' ? 'Verified' : 'Variance Detected'}</div>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-secondary">Expected (Physics):</span>
                            <span className="font-mono">{varianceAnalysis.expectedSensorIncrease} L</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-secondary">Thermal Effect:</span>
                            <span className={`font-mono ${varianceAnalysis.thermalVariance > 0 ? 'text-green-500' : 'text-amber-500'}`}>
                                {varianceAnalysis.thermalVariance > 0 ? '+' : ''}{varianceAnalysis.thermalVariance.toFixed(1)} L
                            </span>
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t border-slate-200 dark:border-slate-700">
                            <span>Unexplained:</span>
                            <span className={`font-mono ${Math.abs(varianceAnalysis.unexplainedVariance) > 15 ? 'text-red-500' : 'text-green-500'}`}>
                                {varianceAnalysis.unexplainedVariance > 0 ? '+' : ''}{varianceAnalysis.unexplainedVariance.toFixed(1)} L
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 text-xs text-secondary italic leading-relaxed">
                        "{varianceAnalysis.explanation}"
                    </div>
                </div>
            </div>
        </div>
    );
};
