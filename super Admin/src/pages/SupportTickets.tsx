import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supportService, Ticket, TicketMessage, SupportStats } from '../services/supportService';
import { 
    FiMessageSquare, FiAlertCircle, FiClock, FiCheckCircle, 
    FiUser, FiSearch, FiFilter, FiPlus, FiSend, 
    FiFileText, FiBarChart2, FiUsers, FiBook, FiMoreVertical,
    FiArrowUpRight, FiMail, FiPhone
} from 'react-icons/fi';
import './SupportTickets.css';

const SupportTickets: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'detail' | 'create' | 'categories' | 'templates' | 'feedback' | 'team' | 'kb'>('overview');
    const [stats, setStats] = useState<SupportStats | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [statsData, ticketsData] = await Promise.all([
                    supportService.getSupportStats(),
                    supportService.getTickets()
                ]);
                setStats(statsData);
                setTickets(ticketsData.data || []);
            } catch (error) {
                console.error('Error fetching support data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleTicketClick = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setActiveTab('detail');
    };

    const renderOverview = () => (
        <div className="support-overview animate-fade-in">
            {/* 5.1 Metrics Cards */}
            <div className="support-metrics-grid">
                <div className="support-stats-card highlight">
                    <span className="stat-label">Open Tickets</span>
                    <h2 className="stat-value">{stats?.openTickets}</h2>
                    <span className="stat-subtext">Active cases across system</span>
                </div>
                <div className="support-stats-card urgent">
                    <div className="stat-header">
                        <span className="stat-label">Urgent Tickets</span>
                        <FiAlertCircle className="text-danger" />
                    </div>
                    <h2 className="stat-value text-danger">{stats?.urgentTickets}</h2>
                    <span className="stat-subtext">Requires immediate attention</span>
                </div>
                <div className="support-stats-card">
                    <span className="stat-label">Avg Response Time</span>
                    <h2 className="stat-value">{stats?.avgResponseTime}</h2>
                    <span className="stat-subtext">Target: Under 1 hour</span>
                </div>
                <div className="support-stats-card">
                    <span className="stat-label">SLA Compliance</span>
                    <h2 className="stat-value text-success">{stats?.slaResponseRate}%</h2>
                    <span className="stat-subtext">Response SLA target: 95%</span>
                </div>
            </div>

            {/* SLA Compliance Bars */}
            <div className="sla-status-row">
                <div className="sla-card">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold opacity-60 uppercase">Resolution SLA Met</span>
                        <span className="text-xs font-black text-primary">{stats?.slaResolutionRate}%</span>
                    </div>
                    <div className="sla-progress-bg">
                        <div className="sla-progress bg-primary" style={{width: `${stats?.slaResolutionRate}%`}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold opacity-40">
                        <span>Target: &gt;90%</span>
                        <span>{stats?.closedToday} closed today</span>
                    </div>
                </div>

                <div className="sla-card">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold opacity-60 uppercase">Response SLA Met</span>
                        <span className="text-xs font-black text-cyan-400">{stats?.slaResponseRate}%</span>
                    </div>
                    <div className="sla-progress-bg">
                        <div className="sla-progress bg-cyan-400" style={{width: `${stats?.slaResponseRate}%`}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold opacity-40">
                        <span>Target: 95%</span>
                        <span>{stats?.overdueTickets} Overdue tickets</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderQueue = () => (
        <div className="support-queue animate-fade-in">
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-4 mb-6">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                    <input 
                        type="text" 
                        placeholder="Search by ticket #, client, or subject..." 
                        className="support-input pl-12"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="support-input w-auto">
                    <option>All Categories</option>
                    <option>Payment Issue</option>
                    <option>Technical Support</option>
                </select>
                <select className="support-input w-auto text-danger font-bold">
                    <option>All Priorities</option>
                    <option>Urgent</option>
                    <option>High</option>
                </select>
                <button className="btn-primary flex items-center gap-2" onClick={() => setActiveTab('create')}>
                    <FiPlus /> New Ticket
                </button>
            </div>

            <div className="ticket-table-container">
                <table className="ticket-table">
                    <thead>
                        <tr>
                            <th>Ticket #</th>
                            <th>Created Date</th>
                            <th>Client / Station</th>
                            <th>Category</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Assigned To</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.filter(t => 
                            t.ticket_no.includes(searchTerm) || 
                            t.client?.station_name.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map(ticket => (
                            <tr key={ticket.id} className="cursor-pointer" onClick={() => handleTicketClick(ticket)}>
                                <td className="font-mono text-xs opacity-70">TICK-{ticket.ticket_no}</td>
                                <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                                <td>
                                    <div className="font-bold">{ticket.client?.station_name}</div>
                                    <div className="text-[10px] opacity-50 uppercase">{ticket.client?.full_name}</div>
                                </td>
                                <td className="text-xs opacity-80">{ticket.category}</td>
                                <td><span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span></td>
                                <td><span className="badge bg-secondary-soft text-secondary uppercase">{ticket.status}</span></td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-accent-primary flex items-center justify-center text-[10px] font-bold">
                                            {ticket.assignee?.full_name.charAt(0) || '?'}
                                        </div>
                                        <span className="text-xs">{ticket.assignee?.full_name || 'Unassigned'}</span>
                                    </div>
                                </td>
                                <td className="text-right">
                                    <button className="icon-btn"><FiMoreVertical /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderDetail = () => {
        if (!selectedTicket) return <div>No ticket selected</div>;
        return (
            <div className="ticket-detail-view animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <button className="btn-secondary text-xs" onClick={() => setActiveTab('queue')}>Back to Queue</button>
                        <h2 className="text-2xl font-black lowercase tracking-tighter">ticket: {selectedTicket.ticket_no}</h2>
                    </div>
                    <div className="flex gap-4">
                        <select className="support-input w-auto font-bold bg-danger-soft text-danger">
                            <option value="urgent">Priority: Urgent</option>
                            <option value="high">Priority: High</option>
                        </select>
                        <button className="btn-primary bg-success">Mark Resolved</button>
                    </div>
                </div>

                <div className="ticket-detail-grid">
                    <div className="main-conversation">
                        <div className="glass-card mb-6">
                            <h4 className="font-black text-lg mb-2">{selectedTicket.subject}</h4>
                            <p className="opacity-70 leading-relaxed text-sm">{selectedTicket.description}</p>
                        </div>

                        <div className="conversation-thread mb-6">
                            <div className="message-bubble client">
                                <div className="message-meta">
                                    <span>{selectedTicket.client?.full_name}</span>
                                    <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                                </div>
                                <div className="text-sm">I am unable to process payments via M-Pesa. It keeps saying 'System Busy'. Please assist.</div>
                            </div>

                            <div className="message-bubble internal">
                                <div className="message-meta">
                                    <span>Internal Note: Admin</span>
                                    <span>Just now</span>
                                </div>
                                <div>Checking M-Pesa Gateway logs. Might be a temporary outage.</div>
                            </div>
                        </div>

                        <div className="reply-box glass-card">
                            <textarea className="support-input h-32 mb-4 w-full" placeholder="Type your response to the client..."></textarea>
                            <div className="flex justify-between items-center">
                                <div className="flex gap-4">
                                    <button className="text-xs font-bold opacity-60">Add Internal Note</button>
                                    <button className="text-xs font-bold opacity-60">Attach Files</button>
                                </div>
                                <button className="btn-primary flex items-center gap-2">
                                    <FiSend /> Send Message
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-info animate-fade-in">
                        <div className="glass-card p-0 overflow-hidden">
                            <div className="info-panel-section bg-secondary-soft">
                                <span className="info-label">Client Details</span>
                                <h3 className="font-black text-lg">{selectedTicket.client?.full_name}</h3>
                                <div className="text-xs opacity-60">{selectedTicket.client?.station_name}</div>
                            </div>

                            <div className="info-panel-section">
                                <div className="flex items-center gap-2 mb-3">
                                    <FiMail className="opacity-40" /> <span className="text-sm">{selectedTicket.client?.email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <FiPhone className="opacity-40" /> <span className="text-sm">{selectedTicket.client?.phone}</span>
                                </div>
                            </div>


                            <div className="info-panel-section">
                                <span className="info-label">Account Health</span>
                                <div className="flex items-center gap-2 text-success font-bold text-xs">
                                    <FiCheckCircle /> No Outstanding Debt
                                </div>
                            </div>

                            <div className="info-panel-section bg-danger-soft">
                                <span className="info-label">SLA Countdown</span>
                                <div className="flex items-center gap-2 text-danger font-black text-xl">
                                    <FiClock /> 01:45:22
                                </div>
                                <div className="text-[10px] opacity-60 uppercase mt-1">Resolution overdue in</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCreate = () => (
        <div className="ticket-create-view animate-fade-in max-w-2xl mx-auto">
            <h2 className="text-2xl font-black mb-8 lowercase tracking-tighter">Create support ticket</h2>
            <div className="glass-card flex flex-col gap-6">
                <div>
                    <label className="info-label">Target Client</label>
                    <input type="text" className="support-input" placeholder="Search for client name or station..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="info-label">Category</label>
                        <select className="support-input">
                            <option>Payment Issue</option>
                            <option>Technical Support</option>
                            <option>Account Access</option>
                        </select>
                    </div>
                    <div>
                        <label className="info-label">Initial Priority</label>
                        <select className="support-input">
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                            <option>Urgent</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="info-label">Subject</label>
                    <input type="text" className="support-input" placeholder="Brief summary of the issue" />
                </div>
                <div>
                    <label className="info-label">Internal Description</label>
                    <textarea className="support-input h-32" placeholder="Detailed notes for support staff..."></textarea>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="notify-client" />
                    <label htmlFor="notify-client" className="text-sm font-bold opacity-60">Notify client via email</label>
                </div>
                <button className="btn-primary py-4 text-sm font-bold tracking-widest uppercase">Launch Support Ticket</button>
            </div>
        </div>
    );

    const renderCategories = () => (
        <div className="categories-view animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black lowercase tracking-tighter">ticket categories</h2>
                <button className="btn-primary text-xs">+ Add Category</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    { name: 'Hardware Failure', priority: 'Urgent', sla: '2 Hours' },
                    { name: 'Billing Dispute', priority: 'High', sla: '6 Hours' },
                    { name: 'Feature Request', priority: 'Low', sla: '72 Hours' }
                ].map(cat => (
                    <div className="glass-card">
                        <h4 className="font-bold text-lg mb-4">{cat.name}</h4>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs font-bold opacity-60">
                                <span>Default Priority</span>
                                <span className="text-primary">{cat.priority}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold opacity-60">
                                <span>Response SLA</span>
                                <span>{cat.sla}</span>
                            </div>
                        </div>
                        <button className="text-xs font-black text-cyan-400 mt-6 uppercase tracking-widest">Configure SLA</button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderTemplates = () => (
        <div className="templates-view animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black lowercase tracking-tighter">canned responses</h2>
                <button className="btn-primary text-xs">+ New Template</button>
            </div>
            <div className="grid gap-4">
                {[
                    { title: 'Payment Confirmation', body: 'We have received your payment for invoice #...' },
                    { title: 'Under Investigation', body: 'Our engineering team is currently looking into...' },
                    { title: 'Account Recovery', body: 'To reset your password, please follow these steps...' }
                ].map(t => (
                    <div className="glass-card flex justify-between items-center">
                        <div>
                            <h5 className="font-bold">{t.title}</h5>
                            <p className="text-xs opacity-50 truncate max-w-lg">{t.body}</p>
                        </div>
                        <div className="flex gap-4">
                            <button className="text-[10px] font-black uppercase opacity-60">Edit</button>
                            <button className="text-[10px] font-black uppercase text-danger">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderFeedback = () => (
        <div className="feedback-view animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="glass-card text-center">
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Net Promoter Score</div>
                    <div className="text-4xl font-black text-success">78</div>
                    <div className="text-[10px] font-bold opacity-60 mt-1">+4.2% from last month</div>
                </div>
                <div className="glass-card text-center">
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">CSAT Rating</div>
                    <div className="text-4xl font-black text-cyan-400">4.8/5</div>
                    <div className="text-[10px] font-bold opacity-60 mt-1">Based on 240 surveys</div>
                </div>
                <div className="glass-card text-center">
                    <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">SLA Adherence</div>
                    <div className="text-4xl font-black text-amber-500">92.4%</div>
                    <div className="text-[10px] font-bold opacity-60 mt-1">Target: &gt;90%</div>
                </div>
            </div>

            <h4 className="font-black lowercase tracking-tighter mb-4">recent survey responses</h4>
            <div className="glass-card p-0 overflow-hidden">
                <table className="ticket-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Client</th>
                            <th>Rating</th>
                            <th>Comment</th>
                            <th className="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Today</td>
                            <td>Main Station Hub</td>
                            <td><span className="text-success font-bold">★★★★★</span></td>
                            <td className="text-xs italic opacity-60">"Excellent response time on my hardware issue."</td>
                            <td className="text-right"><button className="icon-btn"><FiMoreVertical /></button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderPerformance = () => (
        <div className="performance-view animate-fade-in">
            <h2 className="text-2xl font-black mb-8 lowercase tracking-tighter">staff leaderboard</h2>
            <div className="grid gap-4">
                {[
                    { name: 'Joseph M.', tickets: 124, speed: '45m', csat: 4.9 },
                    { name: 'Alice W.', tickets: 98, speed: '1h 10m', csat: 4.7 },
                    { name: 'Kevin O.', tickets: 85, speed: '1h 30m', csat: 4.5 }
                ].map((staff, i) => (
                    <div className="glass-card flex items-center gap-6">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-black">#{i+1}</div>
                        <div className="flex-1">
                            <h5 className="font-bold">{staff.name}</h5>
                            <div className="flex gap-4 text-[10px] font-bold opacity-40 uppercase">
                                <span>{staff.tickets} Resolved</span>
                                <span>{staff.speed} Avg Response</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-black text-accent-primary">{staff.csat}</div>
                            <div className="text-[10px] font-bold opacity-40 uppercase">CSAT Score</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderKB = () => (
        <div className="kb-view animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black lowercase tracking-tighter">knowledge base manager</h2>
                <button className="btn-primary text-xs">+ Add Article</button>
            </div>
            <div className="kb-grid">
                {[
                    { title: 'Integrating Flow Sensors', views: 2450, help: '92%', tag: 'Hardware' },
                    { title: 'Billing Cycle Explained', views: 890, help: '85%', tag: 'Billing' },
                    { title: 'Worker Permissions FAQ', views: 1200, help: '78%', tag: 'Security' }
                ].map(item => (
                    <div className="kb-card glass-card">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.tag}</span>
                        <h4 className="font-bold text-lg">{item.title}</h4>
                        <div className="kb-meta">
                            <span>{item.views} Views</span>
                            <span className="text-success">{item.help} Helpful</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button className="text-[10px] font-black uppercase opacity-60">Edit</button>
                            <button className="text-[10px] font-black uppercase opacity-60">Stats</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="support-page">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-primary tracking-tighter lowercase">customer support & tickets</h1>
                        <p className="text-secondary font-bold text-sm mt-1 uppercase tracking-widest opacity-60">
                            (Administrative Help Desk & SLA Monitor)
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button className="btn-secondary flex items-center gap-2">
                             <FiBarChart2 /> Export Performance
                        </button>
                    </div>
                </div>

                <div className="support-tabs">
                    <button className={`support-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                    <button className={`support-tab-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>Ticket Queue</button>
                    {selectedTicket && (
                        <button className={`support-tab-btn ${activeTab === 'detail' ? 'active' : ''}`} onClick={() => setActiveTab('detail')}>Current Ticket</button>
                    )}
                    <button className={`support-tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>Categories</button>
                    <button className={`support-tab-btn ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>Templates</button>
                    <button className={`support-tab-btn ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>Feedback</button>
                    <button className={`support-tab-btn ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>Staff Performance</button>
                    <button className={`support-tab-btn ${activeTab === 'kb' ? 'active' : ''}`} onClick={() => setActiveTab('kb')}>Knowledge Base</button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                        <div className="animate-spin mb-4"><FiClock size={32} /></div>
                        <p className="font-bold tracking-widest uppercase text-xs">Synchronizing Support Engine...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'queue' && renderQueue()}
                        {activeTab === 'detail' && renderDetail()}
                        {activeTab === 'create' && renderCreate()}
                        {activeTab === 'categories' && renderCategories()}
                        {activeTab === 'templates' && renderTemplates()}
                        {activeTab === 'feedback' && renderFeedback()}
                        {activeTab === 'team' && renderPerformance()}
                        {activeTab === 'kb' && renderKB()}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default SupportTickets;
