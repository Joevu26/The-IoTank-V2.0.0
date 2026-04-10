import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { communicationService, Announcement, DashboardBanner, NewsletterTemplate } from '../services/communicationService';
import { 
    FiSend, FiMail, FiMessageSquare, FiMonitor, 
    FiBell, FiCalendar, FiUsers, FiBarChart2, 
    FiActivity, FiLayout, FiPlus, FiMoreVertical,
    FiCheckCircle, FiAlertCircle, FiClock, FiEye,
    FiTrash2, FiEdit3, FiChevronRight, FiChevronDown,
    FiSmartphone, FiFileText, FiLayers, FiType,
    FiImage, FiMinusCircle, FiMove, FiTarget
} from 'react-icons/fi';
import './Announcements.css';

const Announcements: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'build' | 'history' | 'banners' | 'newsletters'>('build');
    const [history, setHistory] = useState<Announcement[]>([]);
    const [banners, setBanners] = useState<DashboardBanner[]>([]);
    const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['Email']);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [histData, bannerData, templateData] = await Promise.all([
                    communicationService.getAnnouncements(),
                    communicationService.getActiveBanners(),
                    communicationService.getNewsletterTemplates()
                ]);
                setHistory(histData);
                setBanners(bannerData);
                setTemplates(templateData);
            } catch (error) {
                console.error('Error fetching communication data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const toggleChannel = (channel: string) => {
        setSelectedChannels(prev => 
            prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
        );
    };

    const renderBuildAnnouncement = () => (
        <div className="builder-studio animate-fade-in">
            {/* 10.1 Announcement Builder */}
            <div className="builder-main">
                <div className="mb-8">
                    <label className="info-label mb-2">Announcement Subject</label>
                    <input type="text" placeholder="e.g., Scheduled Maintenance: System Upgrade" className="support-input text-lg font-bold" />
                </div>

                <div className="mb-8">
                    <div className="flex justify-between items-end mb-2">
                        <label className="info-label">Message Body (Rich Text)</label>
                        <div className="flex gap-2 text-[10px] font-black uppercase opacity-40">
                            <span>Markdown Supported</span>
                            <span>| 1250 Characters Max</span>
                        </div>
                    </div>
                    <div className="rich-text-editor">
                        <textarea 
                            className="w-full h-full bg-transparent border-none outline-none text-white resize-none font-medium"
                            placeholder="Compose your broadcast message here..."
                        ></textarea>
                    </div>
                </div>

                <div className="flex justify-between items-center gap-6 mt-12 bg-white bg-opacity-5 p-6 rounded-2xl border border-white border-opacity-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary bg-opacity-10 flex items-center justify-center text-primary text-2xl">
                            <FiSend />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Ready to Broadcast?</h4>
                            <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Messages will be queued for delivery immediately</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                         <button className="btn-secondary text-xs px-8">Preview</button>
                         <button className="btn-primary text-xs px-10">Send Now</button>
                    </div>
                </div>
            </div>

            <div className="builder-sidebar">
                <div className="glass-card">
                    <h5 className="font-black lowercase tracking-tighter text-lg mb-4">Delivery Channels</h5>
                    <div className="channel-pill-group flex-wrap">
                        {[
                            { id: 'Email', icon: <FiMail /> },
                            { id: 'SMS', icon: <FiMessageSquare /> },
                            { id: 'Dashboard', icon: <FiMonitor /> },
                            { id: 'Push', icon: <FiSmartphone /> }
                        ].map(ch => (
                            <div 
                                key={ch.id} 
                                className={`channel-pill ${selectedChannels.includes(ch.id) ? 'active' : ''}`}
                                onClick={() => toggleChannel(ch.id)}
                            >
                                <div className="text-xl">{ch.icon}</div>
                                <span className="text-[9px] font-black uppercase tracking-widest">{ch.id}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card">
                    <h5 className="font-black lowercase tracking-tighter text-lg mb-4">Target Audience</h5>
                    <div className="flex flex-col gap-3">
                        <select className="support-input text-xs font-bold py-3 bg-white bg-opacity-5">
                            <option>All Active Clients</option>
                            <option>Specific Tier: Enterprise</option>
                            <option>Trial Users Only</option>
                            <option>County: Nairobi</option>
                            <option>Specific IDs (CSV Upload)</option>
                        </select>
                        <div className="p-4 bg-white bg-opacity-5 rounded-xl border border-white border-opacity-5">
                             <div className="flex justify-between text-[10px] font-bold uppercase opacity-40 mb-2">
                                 <span>Estimated Reach</span>
                                 <span>1,250 Clients</span>
                             </div>
                             <div className="h-1 bg-white bg-opacity-5 rounded-full overflow-hidden">
                                 <div className="h-full bg-primary" style={{width: '65%'}}></div>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card">
                    <h5 className="font-black lowercase tracking-tighter text-lg mb-4">Scheduling</h5>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 p-3 bg-white bg-opacity-5 rounded-xl">
                            <input type="radio" name="timing" defaultChecked />
                            <span className="text-xs font-bold">Send Immediately</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-white bg-opacity-5 rounded-xl opacity-40">
                            <input type="radio" name="timing" />
                            <span className="text-xs font-bold">Schedule for Later</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderHistory = () => (
        <div className="history-section animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                 {[
                    { label: 'Total Sent', val: '42', icon: <FiSend /> },
                    { label: 'Avg Open Rate', val: '58.4%', icon: <FiBarChart2 /> },
                    { label: 'Avg Click Rate', val: '12.8%', icon: <FiTarget /> },
                    { label: 'Scheduled', val: '3', icon: <FiCalendar /> }
                 ].map(k => (
                    <div key={k.label} className="engagement-card glass-card">
                         <div className="text-primary text-xl mb-2 flex justify-center">{k.icon}</div>
                         <div className="text-[10px] font-black uppercase opacity-40 tracking-widest">{k.label}</div>
                         <div className="text-3xl font-black mt-1">{k.val}</div>
                    </div>
                 ))}
             </div>

             <div className="ticket-table-container">
                <table className="ticket-table">
                    <thead>
                        <tr>
                            <th>Date / Time</th>
                            <th>Subject & Channels</th>
                            <th>Recipients</th>
                            <th>Engagement</th>
                            <th>Status</th>
                            <th className="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(h => (
                            <tr key={h.id}>
                                <td className="text-xs font-bold opacity-40">{h.date_sent}</td>
                                <td>
                                    <div className="font-bold text-sm">{h.subject}</div>
                                    <div className="flex gap-2 mt-1">
                                        {h.methods.map(m => (
                                            <span key={m} className="text-[8px] font-black uppercase tracking-widest opacity-30">{m}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="font-mono font-bold text-sm text-primary">{h.recipients_count.toLocaleString()}</td>
                                <td>
                                    <div className="flex gap-4">
                                        <div className="text-center">
                                             <div className="text-[9px] font-bold opacity-30 uppercase">Open</div>
                                             <div className="text-xs font-black text-success">{h.open_rate}%</div>
                                        </div>
                                        <div className="text-center">
                                             <div className="text-[9px] font-bold opacity-30 uppercase">Click</div>
                                             <div className="text-xs font-black text-amber-500">{h.click_rate}%</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge text-[8px] bg-opacity-10 border border-opacity-20 ${h.status === 'sent' ? 'text-success border-success' : 'text-amber-500 border-amber-500'}`}>
                                        {h.status}
                                    </span>
                                </td>
                                <td className="text-right">
                                    <button className="icon-btn hover:text-primary"><FiEye /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>
    );

    const renderBanners = () => (
        <div className="banners-section animate-fade-in">
            <div className="flex justify-between items-end mb-8">
                 <div>
                    <h3 className="text-2xl font-black lowercase tracking-tighter">Live Dashboard Banners</h3>
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Active persistent notifications on client dashboards</p>
                 </div>
                 <button className="btn-primary text-xs flex items-center gap-2"><FiPlus /> Create Banner</button>
            </div>

            <div className="banner-preview-stack">
                {banners.map(b => (
                    <div key={b.id} className={`banner-item ${b.type} glass-card`}>
                         <div className="flex items-center gap-6">
                            <div className="w-10 h-10 rounded-full bg-white bg-opacity-5 flex items-center justify-center text-xl">
                                {b.type === 'warning' ? <FiAlertCircle className="text-amber-500" /> : <FiAlertCircle className="text-danger" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-white">{b.message}</div>
                                <div className="text-[9px] font-black uppercase opacity-40 mt-1">Target: {b.target} Audience • {b.is_dismissible ? 'Dismissible' : 'Persistent'}</div>
                            </div>
                         </div>
                         <div className="flex gap-3">
                             <button className="icon-btn hover:text-primary"><FiEdit3 /></button>
                             <button className="icon-btn hover:text-danger"><FiTrash2 /></button>
                         </div>
                    </div>
                ))}
            </div>

            <div className="glass-card p-8 bg-white bg-opacity-5 border-dashed border-2 border-white border-opacity-10 text-center">
                 <FiLayout size={32} className="mx-auto mb-4 opacity-20" />
                 <h4 className="font-bold opacity-40 mb-2">No Historical Banners found</h4>
                 <p className="text-xs opacity-20">Recently expired or deleted banners will appear here</p>
            </div>
        </div>
    );

    const renderNewsletters = () => (
        <div className="newsletters-section animate-fade-in">
             <div className="builder-studio">
                 <div className="builder-main">
                     <div className="flex justify-between items-center mb-10 pb-6 border-b border-white border-opacity-5">
                          <h3 className="text-2xl font-black lowercase tracking-tighter">Newsletter Studio</h3>
                          <div className="flex gap-4">
                               <button className="btn-secondary text-[10px] flex items-center gap-2 font-black uppercase tracking-widest">Save Draft</button>
                               <button className="btn-primary text-[10px] flex items-center gap-2 font-black uppercase tracking-widest"><FiSend /> Deploy Newsletter</button>
                          </div>
                     </div>

                     <div className="newsletter-editor-space flex flex-col gap-4">
                          <div className="newsletter-block flex justify-between items-center group">
                               <div className="flex items-center gap-4">
                                   <FiMove className="opacity-20 translate-[-10px] group-hover:opacity-100 transition-opacity" />
                                   <div className="text-xs font-black uppercase opacity-40 tracking-widest text-primary">Header / Logo Block</div>
                               </div>
                               <FiMinusCircle className="opacity-0 group-hover:opacity-100 text-danger" />
                          </div>
                          <div className="newsletter-block flex justify-between items-center group">
                               <div className="flex items-center gap-4">
                                   <FiMove className="opacity-20 group-hover:opacity-100 transition-opacity" />
                                   <div className="text-xs font-black uppercase opacity-40 tracking-widest">Feature Spotlight: 3D Mapping</div>
                               </div>
                               <FiMinusCircle className="opacity-0 group-hover:opacity-100 text-danger" />
                          </div>
                          <div className="newsletter-block min-h-[150px] border-dashed flex items-center justify-center opacity-40 hover:opacity-100 transition-all">
                               <div className="text-center">
                                    <FiPlus size={24} className="mx-auto mb-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Drag Block Here to Append Content</span>
                               </div>
                          </div>
                     </div>
                 </div>

                 <div className="builder-sidebar">
                      <div className="glass-card">
                           <h5 className="font-black lowercase tracking-tighter text-lg mb-6">Component Library</h5>
                           <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Sub-Head', icon: <FiType /> },
                                    { label: 'Image', icon: <FiImage /> },
                                    { label: 'Text Body', icon: <FiFileText /> },
                                    { label: 'CTA Button', icon: <FiTarget /> },
                                    { label: 'KPI Chart', icon: <FiBarChart2 /> },
                                    { label: 'Footer', icon: <FiLayers /> }
                                ].map(lib => (
                                    <div key={lib.label} className="p-4 bg-white bg-opacity-5 rounded-xl flex flex-col items-center gap-2 cursor-grab hover:bg-white hover:bg-opacity-10 transition-colors">
                                         <div className="text-xl opacity-60">{lib.icon}</div>
                                         <span className="text-[8px] font-black uppercase tracking-[0.2em]">{lib.label}</span>
                                    </div>
                                ))}
                           </div>
                      </div>

                      <div className="glass-card">
                           <h5 className="font-black lowercase tracking-tighter text-lg mb-6">Template Presets</h5>
                           <div className="flex flex-col gap-4">
                                {templates.map(t => (
                                    <div key={t.id} className="p-4 rounded-xl border border-white border-opacity-10 bg-black hover:border-primary transition-all group cursor-pointer">
                                         <div className="text-xs font-bold text-white group-hover:text-primary transition-colors">{t.name}</div>
                                         <div className="flex justify-between items-center mt-2">
                                              <span className="text-[8px] font-black uppercase opacity-30">{t.category}</span>
                                              <span className="text-[8px] font-mono opacity-20">{t.last_modified}</span>
                                         </div>
                                    </div>
                                ))}
                           </div>
                      </div>
                 </div>
             </div>
        </div>
    );

    return (
        <Layout>
            <div className="announcements-page">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-black text-primary tracking-tighter lowercase">announcements & communications</h1>
                        <p className="text-secondary font-bold text-sm mt-1 uppercase tracking-widest opacity-60">
                            (System broadcasting & client engagement terminal)
                        </p>
                    </div>
                     <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-6 py-3 bg-[#0a0a0a] border border-primary border-opacity-20 rounded-2xl">
                            <FiBell className="text-primary animate-bounce-slow" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live Broadcast Engine</span>
                        </div>
                    </div>
                </header>

                <div className="hw-tabs mb-8">
                    <button className={`hw-tab-btn ${activeTab === 'build' ? 'active' : ''}`} onClick={() => setActiveTab('build')}>Send announcement</button>
                    <button className={`hw-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Announcement history</button>
                    <button className={`hw-tab-btn ${activeTab === 'banners' ? 'active' : ''}`} onClick={() => setActiveTab('banners')}>Dashboard banners</button>
                    <button className={`hw-tab-btn ${activeTab === 'newsletters' ? 'active' : ''}`} onClick={() => setActiveTab('newsletters')}>Client newsletters</button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                        <div className="animate-spin mb-4"><FiMonitor size={32} /></div>
                        <p className="font-bold tracking-widest uppercase text-xs">Synchronizing Global Airwaves...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'build' && renderBuildAnnouncement()}
                        {activeTab === 'history' && renderHistory()}
                        {activeTab === 'banners' && renderBanners()}
                        {activeTab === 'newsletters' && renderNewsletters()}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default Announcements;
