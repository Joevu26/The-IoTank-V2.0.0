import React from 'react';
import { FiX, FiCheckCircle, FiInfo, FiLayers, FiDatabase } from 'react-icons/fi';

interface ExplainabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    insight: {
        title: string;
        description: string;
        confidence: number;
        sources: string[];
        reasoning: string[];
    };
}

export const ExplainabilityModal: React.FC<ExplainabilityModalProps> = ({ isOpen, onClose, insight }) => {
    if (!isOpen) return null;

    return (
        <div className="wizard-overlay">
            <div className="wizard-container card max-w-2xl w-full p-0 relative overflow-hidden flex flex-col">
                <div className="p-6 border-b border-divider flex justify-between items-center bg-accent/5">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FiInfo className="text-accent" /> AI Decision Explainability
                    </h2>
                    <button onClick={onClose} className="btn btn-icon"><FiX /></button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Header Context */}
                    <div>
                        <div className="text-xs uppercase font-bold text-secondary mb-1">Subject Insight</div>
                        <h3 className="text-2xl font-bold mb-2">{insight.title}</h3>
                        <p className="text-lg opacity-80">{insight.description}</p>
                    </div>

                    {/* Confidence Meter */}
                    <div className="p-4 bg-white/5 rounded border border-divider">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm uppercase flex items-center gap-2">
                                <FiCheckCircle className="text-success" /> Confidence Score
                            </span>
                            <span className="text-xl font-mono text-success">{(insight.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="progress-bar-container h-2 bg-black/50">
                            <div
                                className="progress-bar bg-success"
                                style={{ width: `${insight.confidence * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-secondary mt-2">
                            Based on high-fidelity data from {insight.sources.length} independent sources.
                        </p>
                    </div>

                    {/* Reasoning Logic Chain */}
                    <div>
                        <h4 className="font-bold flex items-center gap-2 mb-4 text-accent">
                            <FiLayers /> Logical Deduction Chain
                        </h4>
                        <ul className="space-y-4">
                            {insight.reasoning.map((step, idx) => (
                                <li key={idx} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-6 h-6 rounded-full bg-accent text-black font-bold flex items-center justify-center text-xs">
                                            {idx + 1}
                                        </div>
                                        {idx < insight.reasoning.length - 1 && (
                                            <div className="w-0.5 h-full bg-accent/30 my-1"></div>
                                        )}
                                    </div>
                                    <div className="pt-0.5">{step}</div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Data Provenance */}
                    <div>
                        <h4 className="font-bold flex items-center gap-2 mb-3 text-info">
                            <FiDatabase /> Data Provenance
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {insight.sources.map(source => (
                                <span key={source} className="badge badge-outline text-xs">
                                    {source}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-divider bg-black/20 flex justify-end">
                    <button className="btn btn-primary" onClick={onClose}>Close Analysis</button>
                </div>
            </div>
        </div>
    );
};
