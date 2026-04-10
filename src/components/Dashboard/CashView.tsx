import React from 'react';
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiArrowUpRight } from 'react-icons/fi';
import '../Common/DesignSystemCards.css';

interface CashViewProps {
    currency?: 'USD' | 'Ksh';
    stationId?: string;
}

export const CashView: React.FC<CashViewProps> = ({ currency = 'Ksh', stationId }) => {
    return (
        <div className="ds-card ds-card-panel p-6 h-full flex flex-col justify-between group hover:border-amber-200 transition-all duration-300">
            <div className="flex-1">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl shadow-sm border border-amber-100 group-hover:scale-110 transition-transform">
                            <FiDollarSign size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">Revenue Flow</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Liquid Capital Tracking</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 relative overflow-hidden group/item">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                            <FiTrendingUp size={30} />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Inflow</span>
                        <span className="text-lg font-black text-emerald-700 tracking-tight">{currency} 1.2M</span>
                    </div>
                    <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 relative overflow-hidden group/item">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                            <FiTrendingDown size={30} />
                        </div>
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-1">Outflow</span>
                        <span className="text-lg font-black text-rose-700 tracking-tight">{currency} 840K</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">
                        <span>Recent Invoices</span>
                        <FiArrowUpRight />
                    </div>
                    {[
                        { id: 'INV-882', amount: '240,000', vendor: 'KPC Terminal' },
                        { id: 'INV-881', amount: '12,500', vendor: 'Shell Retail' }
                    ].map((tx, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 block tracking-tighter">{tx.id}</span>
                                <span className="text-xs font-bold text-slate-700">{tx.vendor}</span>
                            </div>
                            <span className="text-xs font-black text-slate-900">{currency} {tx.amount}</span>
                        </div>
                    ))}
                </div>
            </div>
            {stationId && <div className="text-[8px] text-slate-300 mt-2 text-right">Station: {stationId}</div>}
        </div>
    );
};
