import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import Layout from '../components/Layout';
import { 
    FiPhone, FiMail, FiCheckCircle, FiXCircle, FiInfo, FiLoader, 
    FiPlus, FiRefreshCw, FiArrowRight, FiUser, FiUsers, 
    FiShield, FiMapPin, FiCalendar, FiClock, FiSearch, FiAlertTriangle,
    FiChevronRight, FiAlertCircle, FiActivity
} from 'react-icons/fi';
import './PendingRegistrations.css';

interface PendingReg {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  station_name: string;
  county: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'contacted';
  created_at: string;
}

interface PendingStaff {
  id: string;
  station_id: string;
  station_name: string;
  full_name: string;
  email: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const PendingRegistrations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'admins' | 'staff'>('admins');
  const [registrations, setRegistrations] = useState<PendingReg[]>([]);
  const [staffRequests, setStaffRequests] = useState<PendingStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  // Notification States
  const [toast, setToast] = useState<{show: boolean, type: 'error' | 'success', title: string, message: string, step?: string} | null>(null);

  const fetchRegistrations = async () => {
    setLoading(true);
    setError('');
    try {
      await supabase.rpc('repair_my_identity');
      const { data: regData, error: regError } = await supabase
        .from('pending_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (regError) throw regError;
      setRegistrations(regData as PendingReg[]);

      const { data: staffData, error: staffError } = await supabase
        .from('team_member_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (staffError) throw staffError;
      setStaffRequests(staffData as PendingStaff[]);

    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setTimeout(() => setLoading(false), 800); 
    }
  };

  // REALTIME SUBSCRIPTIONS
  useEffect(() => {
    fetchRegistrations();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_registrations' }, () => {
          fetchRegistrations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_member_requests' }, () => {
          fetchRegistrations();
      })
      .subscribe((status) => {
          if (status === 'SUBSCRIBED') setIsRealtimeActive(true);
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  // TOAST AUTO-DISMISS
  useEffect(() => {
    if (toast?.show) {
      const duration = toast.type === 'success' ? 10000 : 20000;
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleApproveAdmin = async (reg: PendingReg) => {
    setApproving(true);
    setToast(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('approve-registration', {
        body: { registrationId: reg.id }
      });
      
      // 1. Handle Logical Failures (returned with 200 but success: false)
      if (data && data.success === false) {
          setToast({
              show: true,
              type: 'error',
              title: "Provisioning Interrupted",
              message: data.error || data.details?.message || "Logical desync in handshake.",
              step: data.details?.step || 'PIPELINE_DESYNC'
          });
          return;
      }

      // 2. Handle HTTP/Network Errors
      if (functionError) {
        console.error("Function invoke error details:", functionError);
        
        let detailedMessage = functionError.message;
        
        // Try to extract body from FunctionsHttpError (Supabase JS V2)
        try {
          if ((functionError as any).context) {
            const errorBody = await (functionError as any).context.json();
            detailedMessage = errorBody.error || errorBody.message || detailedMessage;
          }
        } catch (e) {
            console.warn("Could not parse error context:", e);
        }

        const isNetworkError = detailedMessage?.toLowerCase().includes('fetch') || 
                              detailedMessage?.toLowerCase().includes('network') ||
                              detailedMessage?.toLowerCase().includes('failed to fetch');
        
        setToast({
            show: true,
            type: 'error',
            title: isNetworkError ? "Network Unreachable" : "Provisioning Failed",
            message: detailedMessage || "The provisioning hub could not be reached.",
            step: isNetworkError ? 'HUB_OFFLINE' : 'SERVER_ERROR'
        });
        return;
      }
      
      setToast({
          show: true,
          type: 'success',
          title: 'Provisioning Success',
          message: `${reg.full_name} has been synchronized as Executive Administrator.`
      });
      await fetchRegistrations();
    } catch (err: any) {
      setToast({ show: true, type: 'error', title: "Critical Exception", message: err.message });
    } finally {
      setApproving(false);
    }
  };

  const testConnection = async () => {
    setToast({ show: true, type: 'error', title: "Diagnostic in Progress", message: "Probing hub link...", step: 'DIAGNOSTIC' });
    try {
        const currentProjectUrl = import.meta.env.VITE_SUPABASE_URL;
        // FIX: Use the standard Supabase API URL format for Edge Functions.
        // The .functions.supabase.co host does NOT use the /functions/v1/ prefix.
        // The correct format is: {SUPABASE_URL}/functions/v1/{function-name}
        const pingUrl = `${currentProjectUrl}/functions/v1/approve-registration/ping`;
        
        const start = Date.now();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            setToast({
                show: true,
                type: 'error',
                title: "Session Not Found",
                message: `You are disconnected from the system. Source Project: ${currentProjectUrl}. Please log out and back in.`,
                step: 'AUTH_MISSING'
            });
            return;
        }

        const resp = await fetch(pingUrl, { 
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        const duration = Date.now() - start;
        
        if (resp.ok) {
            const data = await resp.json();
            const serverTime = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'N/A';
            setToast({
                show: true,
                type: 'success',
                title: "Link Active",
                message: `Connection established in ${duration}ms. Active Project: ${currentProjectUrl}. Hub Online and responding to diagnostic probes.`,
                step: 'STABLE'
            });
        } else {
            const errorBody = await resp.json().catch(() => ({}));
            setToast({
                show: true,
                type: 'error',
                title: `Hub Refused Connection (${resp.status})`,
                message: `The infrastructure is visible but rejected the handshake. Project: ${currentProjectUrl}. Details: ${errorBody.error || errorBody.message || 'No detail provided.'}`,
                step: 'PROBE_FAILED'
            });
        }
    } catch (err: any) {
        setToast({
            show: true,
            type: 'error',
            title: "Network Block Detected",
            message: `Raw fetch failed: ${err.message}. Your local environment or firewall is blocking the provisioning cluster.`,
            step: 'HARD_OFFLINE'
        });
    }
  };

  const handleApproveStaff = async (req: PendingStaff) => {
    setApproving(true);
    setToast(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('approve-staff-request', {
        body: { requestId: req.id }
      });
      
      if (data && data.success === false) {
          setToast({
              show: true,
              type: 'error',
              title: "Staff Authorization Failed",
              message: data.error || data.details?.message || "Logical failure during personnel sync."
          });
          return;
      }

      if (functionError) {
          console.error("Staff Function error details:", functionError);
          
          let detailedMessage = functionError.message;
          try {
            if ((functionError as any).context) {
              const errorBody = await (functionError as any).context.json();
              detailedMessage = errorBody.error || errorBody.message || detailedMessage;
            }
          } catch (e) {
              console.warn("Could not parse staff error context:", e);
          }

          setToast({
              show: true,
              type: 'error',
              title: "Network/Server Error",
              message: detailedMessage || "Failed to reach authorization service."
          });
          return;
      }
      
      setToast({
          show: true,
          type: 'success',
          title: 'Authorization Success',
          message: `${req.full_name} is now synchronized for ${req.role} operations.`
      });
      await fetchRegistrations();
    } catch (err: any) {
      setToast({ show: true, type: 'error', title: "Operation Failure", message: err.message });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (table: 'pending_registrations' | 'team_member_requests', id: string) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    try {
      const { error } = await supabase.from(table).update({ status: 'rejected' }).eq('id', id);
      if (error) throw error;
      setToast({ show: true, type: 'success', title: 'Request Rejected', message: 'Identity has been blacklisted.' });
      await fetchRegistrations();
    } catch (err: any) {
      setToast({ show: true, type: 'error', title: "Rejection Logic Failed", message: err.message });
    }
  };

  const pendingAdminCount = registrations.filter(r => r.status === 'pending').length;
  const pendingStaffCount = staffRequests.filter(s => s.status === 'pending').length;

  const filterAndSearch = (list: any[]) => {
    return list.filter(item => {
      const matchesStatus = filterStatus === 'all' ? true : item.status === filterStatus;
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
          item.full_name?.toLowerCase().includes(term) || 
          item.email?.toLowerCase().includes(term) || 
          item.station_name?.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  };

  const filteredAdmins = filterAndSearch(registrations);
  const filteredStaff = filterAndSearch(staffRequests);

  return (
    <Layout>
      <div className="pending-reg-container animate-in fade-in slide-in-from-bottom-6 duration-1000">
        
        {/* TOAST SYSTEM */}
        {toast?.show && (
            <div className="toast-container">
                <div className={`premium-toast type--${toast.type} shadow-2xl`}>
                    <div className={`toast-icon-wrapper ${toast.type}`}>
                        {toast.type === 'error' ? <FiAlertCircle size={24} /> : <FiCheckCircle size={24} />}
                    </div>
                    <div className="toast-content">
                        <h4 className="toast-title">{toast.title}</h4>
                        <p className="toast-msg">{toast.message}</p>
                        <div className="flex items-center gap-3">
                            {toast.step && <span className="toast-diagnostic-pill">{toast.step}</span>}
                            {toast.step === 'HUB_OFFLINE' && (
                                <button onClick={testConnection} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">
                                    Run Deep Diagnostic
                                </button>
                            )}
                        </div>
                    </div>
                    <button className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors" onClick={() => setToast(null)}>
                        <FiXCircle size={18} />
                    </button>
                    <div className="toast-timer-bar"></div>
                </div>
            </div>
        )}

        <header className="pending-reg-header">
          <div>
            <h1>Registration Hub</h1>
            <p className="header-subtitle">Continuous multi-client provisioning with real-time intelligence enabled.</p>
          </div>
          
          <div className="flex gap-3 items-center mt-4">
             <button className="btn-action-pill group" onClick={() => setShowManualModal(true)}>
                <FiPlus className="group-hover:rotate-90 transition-transform duration-300" size={18} /> 
                <span>Provision Identity</span>
             </button>
             <button className="btn-action-pill bg-slate-100 hover:bg-slate-200" onClick={() => testConnection()}>
                <FiActivity size={16} />
                <span>Diagnostic Ping</span>
             </button>
             <button className={`sync-trigger ${loading ? 'is-loading' : ''}`} onClick={() => fetchRegistrations()} title="Manual Identity Sync">
                <FiRefreshCw size={18} />
                {isRealtimeActive && <div className="realtime-dot"></div>}
             </button>
          </div>
        </header>

        <div className="intelligence-bar shadow-indigo-100/30">
            <div className="tab-navigation">
              <button className={`tab-link ${activeTab === 'admins' ? 'active' : ''}`} onClick={() => setActiveTab('admins')}>
                <FiShield size={16} />
                <span>Executives</span>
                {(pendingAdminCount > 0) && <span className="tab-badge">{pendingAdminCount}</span>}
              </button>
              <button className={`tab-link ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>
                <FiUsers size={16} />
                <span>Staff</span>
                {(pendingStaffCount > 0) && <span className="tab-badge">{pendingStaffCount}</span>}
              </button>
            </div>

            <div className="search-wrapper">
                <FiSearch className="search-icon" size={16} />
                <input 
                  type="text" 
                  className="search-input"
                  placeholder="Seach identities, emails, or stations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="segmented-control-wrapper shadow-inner">
              {['pending', 'approved', 'rejected', 'all'].map(s => (
                  <button key={s} className={`segment-btn ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
                      {s}
                  </button>
              ))}
            </div>
        </div>

        {loading && !registrations.length ? (
            <div className="flex flex-col items-center justify-center py-52 animate-pulse">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-8"></div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Syncing identity clusters...</p>
            </div>
        ) : (
            <div className="reg-grid">
                {activeTab === 'admins' ? (
                    filteredAdmins.length > 0 ? (
                      filteredAdmins.map((reg) => (
                        <div key={reg.id} className="reg-card group shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all">
                            <div className="reg-card-main">
                                <div className="reg-status-section">
                                    <span className={`reg-badge status--${reg.status}`}>{reg.status}</span>
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2 mt-2">
                                        <FiCalendar size={11} /> {new Date(reg.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="reg-identity-section">
                                    <h3 className="group-hover:text-indigo-600 transition-colors">{reg.full_name}</h3>
                                    <div className="reg-org-info font-bold">
                                      <FiMapPin className="text-indigo-400" size={12} /> {reg.station_name} <span className="opacity-20">|</span> <span className="uppercase text-[11px] text-slate-400">{reg.county}</span>
                                    </div>
                                </div>
                                <div className="reg-contact-section border-l border-slate-50 pl-6">
                                    <div className="contact-item"><FiMail size={12} className="text-slate-300" /> {reg.email}</div>
                                    <div className="contact-item"><FiPhone size={12} className="text-slate-300" /> {reg.phone}</div>
                                </div>
                                <div className="reg-actions-section">
                                    {reg.status === 'pending' ? (
                                        <>
                                            <button className="btn-approve-premium" onClick={() => handleApproveAdmin(reg)} disabled={approving}>
                                                {approving ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />} 
                                                <span>Approve Access</span>
                                            </button>
                                            <button className="btn-reject-slim" onClick={() => handleReject('pending_registrations', reg.id)}>
                                                <FiXCircle size={18} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="px-5 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
                                          <FiCheckCircle className="text-emerald-500" size={16} />
                                          <span className="text-emerald-700 font-extrabold text-[10px] uppercase tracking-widest">{reg.status}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {reg.notes && (
                                <div className="reg-notes-footer">
                                    <p className="notes-text !text-slate-400">
                                        <FiInfo className="text-slate-300" size={14} /> 
                                        "{reg.notes}"
                                    </p>
                                </div>
                            )}
                        </div>
                      ))
                    ) : (
                        <div className="empty-state-luxury border-dashed">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                                <FiRefreshCw size={32} />
                            </div>
                            <h3>Intelligence Pool Empty</h3>
                            <p>No registration requests found in the current directive.</p>
                        </div>
                    )
                ) : (
                    filteredStaff.length > 0 ? (
                        filteredStaff.map((req) => (
                          <div key={req.id} className="reg-card group">
                              <div className="reg-card-main">
                                  <div className="reg-status-section">
                                      <span className={`reg-badge status--${req.status}`}>{req.status}</span>
                                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2 mt-2">
                                          <FiCalendar size={11} /> {new Date(req.created_at).toLocaleDateString()}
                                      </span>
                                  </div>
                                  <div className="reg-identity-section">
                                      <h3 className="group-hover:text-indigo-600 transition-colors uppercase text-sm">{req.full_name}</h3>
                                      <div className="reg-org-info">
                                        <FiShield className="text-indigo-400" size={12} /> {req.role} <span className="opacity-20">|</span> <span>{req.station_name}</span>
                                      </div>
                                  </div>
                                  <div className="reg-contact-section border-l border-slate-50 pl-6">
                                      <div className="contact-item"><FiMail size={12} className="text-slate-300" /> {req.email}</div>
                                  </div>
                                  <div className="reg-actions-section">
                                      {req.status === 'pending' ? (
                                          <>
                                              <button className="btn-approve-premium" onClick={() => handleApproveStaff(req)} disabled={approving}>
                                                  {approving ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />} 
                                                  <span>Authorize</span>
                                              </button>
                                              <button className="btn-reject-slim" onClick={() => handleReject('team_member_requests', req.id)}>
                                                  <FiXCircle size={18} />
                                              </button>
                                          </>
                                      ) : (
                                          <div className="px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                                            <FiCheckCircle className="text-emerald-500" size={16} />
                                            <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-widest">{req.status}</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>
                        ))
                    ) : (
                        <div className="empty-state-luxury border-dashed">
                             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                                <FiUsers size={32} />
                            </div>
                            <h3>Operations Nominal</h3>
                            <p>No personnel requests matching current sync targets.</p>
                        </div>
                    )
                )}
            </div>
        )}
      </div>
    </Layout>
  );
};

export default PendingRegistrations;
