import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../config/supabase';
import { systemUsersService, SystemUser } from '../services/systemUsersService';
import {
    FiUserPlus, FiShield, FiLoader, FiActivity,
    FiCheck, FiX, FiTrash2, FiToggleRight, FiToggleLeft,
    FiInfo, FiSend, FiUsers, FiLock, FiCalendar, FiClock
} from 'react-icons/fi';
import './SystemUsers.css';

const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin (Level 1)',
    admin_helper: 'Super Admin Helper (Level 2)',
    support_staff: 'Support Staff (Level 3)',
    analyst: 'Analysts (Accountants, Auditors - Level 4)',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
    super_admin: 'Full system access, including billing and user management.',
    admin_helper: 'Administrative support with limited billing access.',
    support_staff: 'Day-to-day operations, support tickets, and monitoring.',
    analyst: 'Read-only access for auditing, reports, and accounting.',
};

const SystemUsers = () => {
    const { systemUser: currentAdmin } = useAuth();
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showBootstrapPanel, setShowBootstrapPanel] = useState(false);
    const [bootstrapping, setBootstrapping] = useState(false);

    // New system user form
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<SystemUser['role']>('support_staff');

    // Bootstrap form
    const [bootstrapEmail, setBootstrapEmail] = useState('');
    const [bootstrapName, setBootstrapName] = useState('');
    const [bootstrapUid, setBootstrapUid] = useState('');
    const [bootstrapAuditTrail, setBootstrapAuditTrail] = useState<Array<{
        timestamp: string;
        actor: string;
        targetEmail: string;
    }>>([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const systemUsers = await systemUsersService.getAllSystemUsers();
            setUsers(systemUsers);
            
            // Recent admin activity logs
            const { data: activityRows } = await supabase
                .from('admin_logs')
                .select('id, description, created_at, action_type')
                .order('created_at', { ascending: false })
                .limit(10);

            setRecentActivity(activityRows || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await systemUsersService.inviteSystemUser({
                email: newEmail,
                full_name: newName,
                role: newRole,
                portal_link: window.location.origin + '/reset-password',
            });
            setIsAdding(false);
            setNewEmail('');
            setNewName('');
            fetchData();
            alert('Invitation sent successfully. The user will receive an email to set their password.');
        } catch (err: any) {
            console.error('Provisioning Error Details:', err);
            alert('Provisioning Error: ' + (err.message || 'Failed to communicate with the invitation service.'));
        } finally {
            setCreating(false);
        }
    };

    const toggleActive = async (user: SystemUser) => {
        if (user.id === currentAdmin?.id) return;
        try {
            await systemUsersService.updateSystemUser(user.id, { is_active: !user.is_active });
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteUser = async (user: SystemUser) => {
        if (user.id === currentAdmin?.id) {
            alert('Security constraint: Cannot remove your own super admin account.');
            return;
        }
        if (!window.confirm(`Permanently remove access for ${user.email}? This cannot be undone.`)) return;
        try {
            await systemUsersService.deleteSystemUser(user.id);
            fetchData();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleBootstrap = async (e: React.FormEvent) => {
        e.preventDefault();
        const email = bootstrapEmail.trim().toLowerCase();
        const name = bootstrapName.trim();
        const uid = bootstrapUid.trim();
        if (!email || !name || !uid) { alert('All fields are required.'); return; }
        if (!/^[0-9a-fA-F-]{36}$/.test(uid)) { alert('UID must be a valid UUID.'); return; }

        setBootstrapping(true);
        try {
            await systemUsersService.bootstrapSuperAdmin({ email, full_name: name, auth_user_id: uid });
            await fetchData();
            const actor = currentAdmin?.full_name || currentAdmin?.email || 'Unknown';
            setBootstrapAuditTrail(prev => ([{ timestamp: new Date().toISOString(), actor, targetEmail: email }, ...prev]).slice(0, 5));
            setShowBootstrapPanel(false);
            setBootstrapEmail(''); setBootstrapName(''); setBootstrapUid('');
            alert('Super admin bootstrap completed successfully.');
        } catch (err: any) {
            alert(`Bootstrap failed: ${err.message}`);
        } finally {
            setBootstrapping(false);
        }
    };

    if (loading) return (
        <Layout>
            <div className="flex flex-col items-center justify-center p-20 text-secondary">
                <FiLoader className="animate-spin text-3xl mb-4" />
                <p>Establishing secure connection to directory...</p>
            </div>
        </Layout>
    );

    return (
        <Layout>
            <div className="p-8">
                {/* Page Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="flex items-center gap-3 text-3xl font-black text-primary tracking-tight">
                            <FiShield className="text-accent-primary" /> User Management
                        </h1>
                        <p className="text-disabled text-sm mt-1">
                            Manage IoTank Super Admin portal team workers and console access
                        </p>
                    </div>
                    {currentAdmin?.role === 'super_admin' && (
                        <div className="flex items-center gap-3">
                            <button
                                className="btn-header-bootstrap"
                                onClick={() => setShowBootstrapPanel(true)}
                            >
                                <FiLock className="header-icon-small" /> Bootstrap Super Admin
                            </button>
                            <button
                                className="btn-header-invite"
                                onClick={() => setIsAdding(true)}
                            >
                                <FiUserPlus /> Invite Staff
                            </button>
                        </div>
                    )}
                </div>

                {/* Bootstrap Modal */}
                {showBootstrapPanel && (
                    <div className="modal-overlay-premium">
                        <div className="modal-content-premium bootstrap-modal">
                            <button 
                                className="modal-close-3d" 
                                onClick={() => setShowBootstrapPanel(false)}
                                title="Close"
                            />
                            
                            <div className="modal-header-section">
                                <div className="modal-header-icon-container">
                                    <FiShield />
                                </div>
                                <div className="modal-title-group">
                                    <h3>Secure Bootstrap Flow</h3>
                                    <p>Initialize or link primary platform administrators</p>
                                </div>
                            </div>

                            <div className="modal-info-banner">
                                <FiInfo className="modal-info-icon" />
                                <span>Calls the <code>bootstrap_super_admin</code> RPC. Use only for platform recovery.</span>
                            </div>

                            <form onSubmit={handleBootstrap} className="grid gap-4 mt-6">
                                <div className="form-group-premium">
                                    <label>Super Admin Email</label>
                                    <input 
                                        type="email" 
                                        className="input-premium-v2" 
                                        placeholder="superadmin@example.com"
                                        value={bootstrapEmail} 
                                        onChange={e => setBootstrapEmail(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div className="form-group-premium">
                                    <label>Full Name</label>
                                    <input 
                                        type="text" 
                                        className="input-premium-v2" 
                                        placeholder="Legal Name"
                                        value={bootstrapName} 
                                        onChange={e => setBootstrapName(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div className="form-group-premium">
                                    <label>Supabase Auth UID (UUID)</label>
                                    <input 
                                        type="text" 
                                        className="input-premium-v2" 
                                        placeholder="00000000-0000-0000-0000-000000000000"
                                        value={bootstrapUid} 
                                        onChange={e => setBootstrapUid(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div className="modal-actions-premium">
                                    <button 
                                        type="button" 
                                        className="btn-premium-cancel" 
                                        onClick={() => setShowBootstrapPanel(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn-premium-primary" 
                                        disabled={bootstrapping}
                                    >
                                        {bootstrapping ? 'Running...' : 'Run Bootstrap'}
                                    </button>
                                </div>
                            </form>

                            {bootstrapAuditTrail.length > 0 && (
                                <div className="mt-8 border-t border-gray-100 pt-6">
                                    <p className="text-xs font-bold text-disabled uppercase mb-3">Audit Trail (Recent)</p>
                                    <div className="overflow-x-auto">
                                        <table className="team-table w-full">
                                            <thead>
                                                <tr>
                                                    <th>Time</th>
                                                    <th>Actor</th>
                                                    <th>Target</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bootstrapAuditTrail.map((entry, idx) => (
                                                    <tr key={`${entry.timestamp}-${idx}`}>
                                                        <td className="date-cell text-xs">{new Date(entry.timestamp).toLocaleString()}</td>
                                                        <td className="text-xs font-semibold">{entry.actor}</td>
                                                        <td className="text-xs">{entry.targetEmail}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Invite Staff Modal */}
                {isAdding && (
                    <div className="modal-overlay-premium">
                        <div className="modal-content-premium invite-modal">
                            <button 
                                className="modal-close-3d" 
                                onClick={() => setIsAdding(false)}
                                title="Close"
                            />
                            
                            <div className="modal-header-section">
                                <div className="modal-header-icon-container">
                                    <FiUserPlus />
                                </div>
                                <div className="modal-title-group">
                                    <h3>Invite Console Staff</h3>
                                    <p>Grant official access to the IoTank admin console</p>
                                </div>
                            </div>

                            <div className="modal-info-banner">
                                <FiInfo className="modal-info-icon" />
                                <span>Staff will receive an email to set their secure password</span>
                            </div>

                            <form onSubmit={handleCreate} className="grid gap-2">
                                <div className="form-group-premium">
                                    <label htmlFor="staff-name">Full Name <span>*</span></label>
                                    <input
                                        id="staff-name"
                                        type="text"
                                        className="input-premium-v2"
                                        placeholder="Enter staff member's full name"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group-premium">
                                    <label htmlFor="staff-email">Email Address <span>*</span></label>
                                    <input
                                        id="staff-email"
                                        type="email"
                                        className="input-premium-v2"
                                        placeholder="staff.email@example.com"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group-premium">
                                    <label htmlFor="staff-role">Access Role <span>*</span></label>
                                    <select
                                        id="staff-role"
                                        className="input-premium-v2"
                                        value={newRole}
                                        onChange={e => setNewRole(e.target.value as SystemUser['role'])}
                                    >
                                        <option value="super_admin">{ROLE_LABELS.super_admin}</option>
                                        <option value="admin_helper">{ROLE_LABELS.admin_helper}</option>
                                        <option value="support_staff">{ROLE_LABELS.support_staff}</option>
                                        <option value="analyst">{ROLE_LABELS.analyst}</option>
                                    </select>
                                    <p className="role-description-text">
                                        {ROLE_DESCRIPTIONS[newRole]}
                                    </p>
                                </div>

                                <div className="modal-actions-premium">
                                    <button 
                                        type="button" 
                                        className="btn-premium-cancel" 
                                        onClick={() => setIsAdding(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn-premium-primary" 
                                        disabled={creating}
                                    >
                                        {creating ? (
                                            <>
                                                <FiLoader className="animate-spin mr-2" /> Creating...
                                            </>
                                        ) : (
                                            <>
                                                <FiSend /> Send Invitation
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}


                {/* Stats Row */}
                <div className="team-stats-grid">
                    <div className="team-stat-card">
                        <p className="stat-label">Total Console Team</p>
                        <h3 className="stat-value">{users.length}</h3>
                    </div>
                    <div className="team-stat-card">
                        <p className="stat-label">Active Users</p>
                        <h3 className="stat-value">{users.filter(u => u.is_active).length}</h3>
                    </div>
                    <div className="team-stat-card role-stats-card">
                        <p className="stat-label">Team Breakdown</p>
                        <div className="role-boxes">
                            <div className="role-box supervisor">
                                <span className="role-count">{users.filter(u => u.role === 'super_admin').length}</span>
                                <span className="role-name">Super</span>
                            </div>
                            <div className="role-box helper">
                                <span className="role-count">{users.filter(u => u.role === 'admin_helper').length}</span>
                                <span className="role-name">Helper</span>
                            </div>
                            <div className="role-box support">
                                <span className="role-count">{users.filter(u => u.role === 'support_staff').length}</span>
                                <span className="role-name">Support</span>
                            </div>
                            <div className="role-box analyst">
                                <span className="role-count">{users.filter(u => u.role === 'analyst').length}</span>
                                <span className="role-name">Analyst</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full-Width Workers Table */}
                <div className="team-main-grid mt-8 full-width">
                    <div className="team-table-card">
                        <div className="team-table-header flex-row justify-between">
                            <div className="flex items-center gap-3">
                                <FiUsers className="header-icon" />
                                <h3>Console Staff Directory</h3>
                            </div>
                            <span className="text-xs text-disabled italic font-bold">Showing {users.length} portal administrators</span>
                        </div>
                        <div className="table-wrapper">
                            <table className="team-table w-full">
                                <thead className="table-premium-header">
                                    <tr>
                                        <th>Worker ID</th>
                                        <th>Full Name</th>
                                        <th>Email Address</th>
                                        <th>Access Role</th>
                                        <th>Joined</th>
                                        <th>Last Login</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td>
                                                <span className="worker-id-badge">
                                                    #{user.id.slice(0, 8).toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="user-info-cell">
                                                    <div className="avatar-circle initials">
                                                        {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="name-bold">{user.full_name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="font-semibold text-secondary">{user.email}</td>
                                            <td className="role-cell">
                                                {ROLE_LABELS[user.role] || user.role}
                                            </td>
                                            <td className="date-cell">
                                                <div className="flex flex-col">
                                                    <span className="date-cell-v2">
                                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                                                    </span>
                                                    <span className="date-subtext">Initialized</span>
                                                </div>
                                            </td>
                                            <td className="date-cell">
                                                <div className="flex items-center gap-2">
                                                    <FiClock className="text-disabled" size={12} />
                                                    <span className="font-bold text-primary">
                                                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`su-status-badge ${user.is_active ? 'su-active' : 'su-suspended'}`}>
                                                    {user.is_active ? 'Active' : 'Suspended'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {user.id !== currentAdmin?.id ? (
                                                        <>
                                                            <button
                                                                className="btn-icon-soft"
                                                                title={user.is_active ? 'Suspend' : 'Reactivate'}
                                                                onClick={() => toggleActive(user)}
                                                            >
                                                                {user.is_active
                                                                    ? <FiToggleRight className="text-success" />
                                                                    : <FiToggleLeft className="text-disabled" />
                                                                }
                                                            </button>
                                                            <button
                                                                className="btn-icon-danger"
                                                                title="Remove"
                                                                onClick={() => handleDeleteUser(user)}
                                                            >
                                                                <FiTrash2 size={13} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-disabled italic font-bold">Self</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="text-center py-20 text-disabled italic font-medium">
                                                The console directory is currently empty.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Secondary: Activity Feed */}
                <div className="team-table-card full-width mt-8">
                    <div className="team-table-header">
                        <FiActivity className="header-icon cyan" />
                        <h3>Recent Portal Actions</h3>
                    </div>
                    <div className="table-wrapper">
                        <table className="team-table w-full">
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Detailed Description</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentActivity.map((event) => (
                                    <tr key={event.id}>
                                        <td className="role-cell uppercase">{event.action_type || 'system'}</td>
                                        <td className="text-primary font-medium">{event.description || 'Activity logged'}</td>
                                        <td className="date-cell">
                                            {event.created_at ? new Date(event.created_at).toLocaleString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                                {recentActivity.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center py-12 text-disabled italic font-medium">
                                            No recent activity detected.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default SystemUsers;
