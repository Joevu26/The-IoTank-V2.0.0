import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../config/supabase';
import { 
    MdPerson, MdEmail, MdPhone, MdSave, 
    MdPhotoCamera, MdSecurity, MdHistory, 
    MdFingerprint 
} from 'react-icons/md';
import { FiShield, FiUser, FiActivity, FiLock } from 'react-icons/fi';
import Layout from '../components/Layout';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
    const { systemUser } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [fullName, setFullName] = useState(systemUser?.full_name || '');
    const [phone, setPhone] = useState('');
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'activity'>('profile');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('system_users')
                .update({ full_name: fullName })
                .eq('id', systemUser?.id);
            
            if (error) throw error;
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const breadcrumbs: Record<string, string> = {
        profile: 'User Identity',
        security: 'Access & Security',
        activity: 'System Activity'
    };

    return (
        <Layout>
            <div className="settings-container">
                <div className="settings-layout">
                    {/* Unified Sidebar Navigation */}
                    <aside className="settings-nav">
                        <div className="nav-cluster">
                            <div className="cluster-header">Personal</div>
                            <button 
                                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                                onClick={() => setActiveTab('profile')}
                            >
                                <FiUser /> Profile Identity
                            </button>
                        </div>

                        <div className="nav-cluster">
                            <div className="cluster-header">Protection</div>
                            <button 
                                className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                                onClick={() => setActiveTab('security')}
                            >
                                <FiShield /> Access Security
                            </button>
                        </div>

                        <div className="nav-cluster">
                            <div className="cluster-header">Monitoring</div>
                            <button 
                                className={`nav-item ${activeTab === 'activity' ? 'active' : ''}`}
                                onClick={() => setActiveTab('activity')}
                            >
                                <FiActivity /> Recent Activity
                            </button>
                        </div>
                    </aside>

                    {/* Content Area */}
                    <main className="settings-content">
                        <div className="settings-content-topbar">
                            <nav className="settings-breadcrumb">
                                <span className="opacity-50">Settings</span>
                                <span className="opacity-30">›</span>
                                <span className="crumb-current">{breadcrumbs[activeTab]}</span>
                            </nav>
                            <div className="settings-content-actions">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-accent opacity-70">
                                    {systemUser?.role?.replace('_', ' ')}
                                </span>
                            </div>
                        </div>

                        <div className="settings-content-body">
                            {activeTab === 'profile' && (
                                <div className="settings-section">
                                    <div className="section-header mb-8">
                                        <h2 className="section-title">Profile Identity</h2>
                                        <p className="section-desc">Manage your professional credentials and identity on the platform.</p>
                                    </div>

                                    <div className="photo-edit-container">
                                        <div className="settings-avatar-wrapper">
                                            <div className="settings-avatar">
                                                <MdPerson size={48} className="text-slate-300" />
                                            </div>
                                            <label className="upload-button-pill">
                                                <MdPhotoCamera size={16} />
                                            </label>
                                        </div>
                                        <div className="photo-info">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">System Identity Avatar</h4>
                                            <p className="text-xs text-slate-500 mt-1">Recommended size 400x400px. PNG or JPG.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSave} className="settings-card space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Legal Full Name</label>
                                                <input 
                                                    type="text" 
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20"
                                                    placeholder="Enter full name"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Global System Email</label>
                                                <input 
                                                    type="email" 
                                                    value={systemUser?.email || ''}
                                                    disabled
                                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 opacity-60 cursor-not-allowed"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mobile Contact</label>
                                                <input 
                                                    type="text" 
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20"
                                                    placeholder="+254 XXX XXX XXX"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end mt-8 border-t pt-6 border-slate-100 dark:border-slate-800">
                                            <button 
                                                type="submit" 
                                                disabled={isSaving}
                                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isSaving ? 'Updating...' : 'Commit Changes'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeTab === 'security' && (
                                <div className="settings-section space-y-6">
                                    <div className="section-header">
                                        <h2 className="section-title">Access Security</h2>
                                        <p className="section-desc">Manage your credentials and secure your administrative session.</p>
                                    </div>

                                    <div className="settings-card flex items-center justify-between p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-600/10 text-indigo-600 rounded-xl">
                                                <MdFingerprint size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold">Two-Factor Authentication</h4>
                                                <p className="text-xs text-slate-500">Add an extra layer of security to your account.</p>
                                            </div>
                                        </div>
                                        <button className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold opacity-50">Configure</button>
                                    </div>

                                    <div className="settings-card flex items-center justify-between p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-yellow-500/10 text-yellow-600 rounded-xl">
                                                <FiLock size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold">Password Management</h4>
                                                <p className="text-xs text-slate-500">Last changed recently.</p>
                                            </div>
                                        </div>
                                        <button className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold">Update</button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'activity' && (
                                <div className="settings-section">
                                    <div className="section-header mb-8">
                                        <h2 className="section-title">System Activity</h2>
                                        <p className="section-desc">Review your recent administrative actions and login history.</p>
                                    </div>
                                    <div className="settings-card text-center py-12">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                            <MdHistory size={32} className="text-slate-300" />
                                        </div>
                                        <p className="text-sm text-slate-500">No recent activity logs available.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </Layout>
    );
};

export default SettingsPage;
