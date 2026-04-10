import { useEffect, useState } from 'react';
import { systemUsersService } from '../services/systemUsersService';
import Layout from '../components/Layout';
import { FiUser, FiInfo, FiTag, FiDatabase, FiSettings, FiActivity, FiKey, FiLoader } from 'react-icons/fi';
import './AdminLogs.css';

const AdminLogs = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const data = await systemUsersService.getAdminLogs();
                setLogs(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getLogIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('auth') || t.includes('login')) return <FiKey />;
        if (t.includes('create') || t.includes('delete')) return <FiDatabase />;
        if (t.includes('update') || t.includes('config')) return <FiSettings />;
        return <FiActivity />;
    };

    if (loading) return (
        <Layout>
            <div className="flex flex-col items-center justify-center p-20 text-secondary">
                <FiLoader className="animate-spin text-3xl mb-4" />
                <p>Retrieving platform audit logs...</p>
            </div>
        </Layout>
    );

    return (
        <Layout>
            <div className="logs-container">
                <header className="logs-header">
                    <h1>System Audit Trail</h1>
                    <p>Complete immutable record of all administrative activities.</p>
                </header>

                <div className="logs-list">
                    {logs.map(log => (
                        <div key={log.id} className="log-premium-card">
                            <div className="log-icon-wrapper">
                                {getLogIcon(log.action_type)}
                            </div>
                            
                            <div className="log-content">
                                <div className="log-header-row">
                                    <span className="log-type-tag">
                                        {log.action_type.replace('_', ' ')}
                                    </span>
                                    <span className="log-time">
                                        {new Date(log.created_at).toLocaleString()}
                                    </span>
                                </div>
                                
                                <p className="log-description">{log.description}</p>
                                
                                <div className="log-meta-footer">
                                    <div className="meta-pill">
                                        <FiUser className="meta-icon" /> 
                                        <span>Authority: <b>{log.system_users?.full_name}</b></span>
                                        <span className="text-[10px] opacity-60 uppercase font-black">({log.system_users?.role})</span>
                                    </div>
                                    
                                    {log.fuel_stations && (
                                        <div className="meta-pill">
                                            <FiTag className="meta-icon" /> 
                                            <span>Subject: <b>{log.fuel_stations.station_name}</b></span>
                                        </div>
                                    )}
                                </div>

                                {log.changes_made && (
                                    <div className="log-changes-box">
                                        <div className="changes-label">Payload Delta</div>
                                        <pre className="changes-pre">
                                            {typeof log.changes_made === 'string' 
                                                ? log.changes_made 
                                                : JSON.stringify(log.changes_made, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {logs.length === 0 && (
                        <div className="card text-center p-20 bg-bg-primary">
                            <FiInfo className="mx-auto text-4xl mb-4 opacity-20" />
                            <p className="text-secondary font-bold">The audit log is currently empty.</p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default AdminLogs;
