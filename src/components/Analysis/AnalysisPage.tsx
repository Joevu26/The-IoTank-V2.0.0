/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useFileAnalysis } from '@/hooks/useFileAnalysis';
import { useAuth } from '@/hooks/useAuth';
import FileUploader from './FileUploader';
import classNames from 'classnames';
import {
    FiDatabase,
    FiFileText,
    FiActivity,
    FiCheck,
    FiZap,
    FiArrowRight,
    FiCheckCircle,
    FiLoader
} from 'react-icons/fi';
import { CSVAnalysisCategory, PDFAnalysisCategory } from '@/types';

import { useTransactions } from '@/hooks/useTransactions';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip bg-slate-800 p-2 rounded text-white text-xs">
                <span className="label block">{payload[0].value} Transactions</span>
                <span className="date text-slate-400">Friday, 22 May</span>
            </div>
        );
    }
    return null;
};

const AnalysisPage: React.FC = () => {
    const { currentUser } = useAuth();
    const orgId = currentUser?.stationId || 'default-org';
    const userId = currentUser?.authUserId || 'guest';

    const { transactions } = useTransactions(orgId);
    const [timeFilter, setTimeFilter] = useState('Week');

    const stats = transactions.reduce((acc, tx) => {
        if (tx.type === 'sale') acc.totalSale += tx.amount * (tx.metadata?.pricePerLiter || 0);
        return acc;
    }, { totalSale: 0 });

    const chartData = transactions
        .filter(t => t.timestamp)
        .slice(0, 7)
        .reverse()
        .map(t => ({
            name: format(t.timestamp, 'MMM dd'),
            sales: t.amount,
            transactions: 1
        }));

    const displayData = chartData.length > 0 ? chartData : [
        { name: 'Jan', sales: 0, transactions: 10 },
        { name: 'Feb', sales: 45, transactions: 15 },
        { name: 'Mar', sales: 45, transactions: 8 },
        { name: 'Apr', sales: 65, transactions: 20 },
        { name: 'May', sales: 112, transactions: 35 },
        { name: 'Jun', sales: 30, transactions: 12 },
        { name: 'Jul', sales: 150, transactions: 28 },
    ];

    const {
        uploadFile,
        analyzeCSV,
        analyzePDF,
        isUploading,
        isAnalyzing,
        uploadProgress,
        uploadedFile,
        csvResult,
        pdfResult,
        error,
        reset
    } = useFileAnalysis(orgId, userId);

    const [category, setCategory] = useState<CSVAnalysisCategory | PDFAnalysisCategory>('general');

    const handleUpload = async (file: File) => {
        await uploadFile(file);
    };

    const handleAnalyze = async () => {
        if (!uploadedFile) return;

        if (uploadedFile.fileType === 'csv') {
            await analyzeCSV(uploadedFile, category as CSVAnalysisCategory);
        } else {
            await analyzePDF(uploadedFile, category as PDFAnalysisCategory);
        }
    };

    const csvCategories: { id: CSVAnalysisCategory; label: string }[] = [
        { id: 'fuel-consumption', label: 'Fuel Consumption' },
        { id: 'inventory', label: 'Inventory Audit' },
        { id: 'sensor-logs', label: 'Sensor Anomalies' },
        { id: 'market-data', label: 'Market Intelligence' },
        { id: 'general', label: 'General Data Analysis' },
    ];

    const pdfCategories: { id: PDFAnalysisCategory; label: string }[] = [
        { id: 'invoice', label: 'Invoice Processing' },
        { id: 'compliance', label: 'Compliance Audit' },
        { id: 'regulatory', label: 'Regulatory Notices' },
        { id: 'maintenance', label: 'Maintenance Records' },
        { id: 'general', label: 'Document Insights' },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-12 text-center">
                <div className="flex flex-col items-center gap-4 mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <FiZap className="text-primary w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">AI Document Intelligence & Sales Analysis</h1>
                </div>
                <p className="text-slate-400 max-w-2xl mx-auto text-lg mb-8">
                    Harness the power of Gemini 1.5 Flash for fuel logs, and monitor your sales projection patterns.
                </p>

                {/* Sales Analysis Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center">
                        <h3 className="text-slate-400 text-sm font-medium mb-1">Total Sale</h3>
                        <div className="text-3xl font-bold text-white">{stats.totalSale.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div className="text-success text-sm mt-2 flex items-center gap-1"><FiActivity /> Active</div>
                    </div>
                    <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-white font-bold">Number of transactions projection</h3>
                                <div className="text-success text-xs">+3.4% <span className="text-slate-500">from last period</span></div>
                            </div>
                            <div className="flex gap-2">
                                {['Day', 'Week', 'Month'].map(f => (
                                    <button
                                        key={f}
                                        className={`px-3 py-1 text-xs rounded-full border ${timeFilter === f ? 'bg-primary/20 border-primary text-primary' : 'bg-transparent border-slate-700 text-slate-400'}`}
                                        onClick={() => setTimeFilter(f)}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ width: '100%', height: 120 }}>
                            <ResponsiveContainer>
                                <AreaChart data={displayData}>
                                    <defs>
                                        <linearGradient id="colorSalesProj" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" hide />
                                    <YAxis hide />
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesProj)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Upload Section */}
                <div className="lg:col-span-12">
                    {!uploadedFile ? (
                        <FileUploader
                            isUploading={isUploading}
                            uploadProgress={uploadProgress}
                            error={error}
                            onUploadStarted={handleUpload}
                        />
                    ) : !csvResult && !pdfResult ? (
                        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 max-w-2xl mx-auto backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-slate-800 rounded-xl">
                                        {uploadedFile.fileType === 'pdf' ? <FiFileText className="text-info w-6 h-6" /> : <FiDatabase className="text-success w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h2 className="text-white font-semibold truncate max-w-[200px]">{uploadedFile.fileName}</h2>
                                        <p className="text-slate-500 text-xs">{(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB • Ready for analysis</p>
                                    </div>
                                </div>
                                <button onClick={reset} className="text-slate-500 hover:text-white text-sm">Cancel</button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-slate-400 text-sm font-medium mb-3">Select Analysis Focus</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(uploadedFile.fileType === 'csv' ? csvCategories : pdfCategories).map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setCategory(cat.id)}
                                                className={classNames(
                                                    "px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left",
                                                    category === cat.id
                                                        ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.1)]"
                                                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                                                )}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing}
                                    className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <FiLoader className="animate-spin" />
                                            Analyzing with Gemini...
                                        </>
                                    ) : (
                                        <>
                                            Start AI Analysis
                                            <FiArrowRight />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Results Section */}
                {(csvResult || pdfResult) && (
                    <div className="lg:col-span-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-success">
                                <FiCheckCircle />
                                <span className="font-semibold">Analysis Complete</span>
                            </div>
                            <button onClick={reset} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors">
                                New Analysis
                            </button>
                        </div>

                        {csvResult && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-6">
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Executive Summary</h3>
                                        <p className="text-slate-300 leading-relaxed">{csvResult.summary}</p>
                                    </div>

                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Strategic Insights</h3>
                                        <ul className="space-y-3">
                                            {csvResult.insights.map((insight, i) => (
                                                <li key={i} className="flex gap-3 text-slate-300">
                                                    <span className="text-primary font-bold">{i + 1}.</span>
                                                    {insight}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Data Quality</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                    <span>Completeness</span>
                                                    <span>{csvResult.dataQuality.completeness}%</span>
                                                </div>
                                                <div className="bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-success h-full" style={{ width: `${csvResult.dataQuality.completeness}%` }}></div>
                                                </div>
                                            </div>
                                            {csvResult.dataQuality.issues.length > 0 && (
                                                <div className="pt-2">
                                                    <p className="text-amber-400 text-xs font-bold mb-2">Detected Issues:</p>
                                                    <ul className="text-xs text-slate-400 space-y-1">
                                                        {csvResult.dataQuality.issues.map((issue, i) => (
                                                            <li key={i}>• {issue}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Recommendations</h3>
                                        <ul className="space-y-3">
                                            {csvResult.recommendations.map((rec, i) => (
                                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                    <FiActivity className="mt-1 text-primary shrink-0" />
                                                    {rec}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {pdfResult && (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-bold text-white">Extracted Intelligence</h3>
                                        <span className="px-3 py-1 bg-info/10 text-info text-xs rounded-full border border-info/20 font-bold uppercase tracking-wider">
                                            {pdfResult.documentType}
                                        </span>
                                    </div>
                                    <p className="text-slate-300 mb-8 pb-8 border-b border-slate-800 leading-relaxed italic">
                                        "{pdfResult.summary}"
                                    </p>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        {Object.entries(pdfResult.extractedData).map(([key, value]) => (
                                            <div key={key}>
                                                <p className="text-slate-500 text-xs uppercase mb-1">{key.replace(/_/g, ' ')}</p>
                                                <p className="text-white font-medium">{String(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="md:col-span-4 space-y-6">
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Action Items</h3>
                                        <ul className="space-y-4">
                                            {pdfResult.actionItems.map((item, i) => (
                                                <li key={i} className="flex gap-3">
                                                    <div className="w-5 h-5 bg-primary/20 rounded flex items-center justify-center shrink-0 mt-0.5">
                                                        <FiCheck className="text-primary w-3 h-3" />
                                                    </div>
                                                    <span className="text-sm text-slate-300">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisPage;
