/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { 
    FiRefreshCw, 
    FiShield, 
    FiEye, 
    FiEyeOff, 
    FiCamera, 
    FiSave, 
    FiPlus, 
    FiZap, 
    FiLock,
    FiUser,
    FiBriefcase
} from 'react-icons/fi';
import { convertToWebP } from '@/utils/performance';
import { useTanks, updateTank as syncTankToDb } from '@/hooks/useSupabase';
import { AddTankModal } from '../Inventory/AddTankModal';
import { AuditService } from '@/services/AuditService';
import { supabase } from '@/config/supabase';
import { Toast } from '../Common/Toast';
import { ImageCropperModal } from '../Common/ImageCropperModal';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
    const { currentUser, verifySettingsPassword, updateUser } = useAuth();
    const { t } = useTranslation();
    
    // Section Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const profilePhotoInputRef = useRef<HTMLInputElement>(null);

    const [isLocked, setIsLocked] = useState(true);
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showLockPassword, setShowLockPassword] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    // Tank Selection & Modal State
    const [showAddTankModal, setShowAddTankModal] = useState(false);

    // Secure Factory Reset State
    const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
    const [showResetAuthModal, setShowResetAuthModal] = useState(false);
    const [resetAuthPassword, setResetAuthPassword] = useState('');

    // Image Cropping State
    const [cropperState, setCropperState] = useState<{
        isOpen: boolean;
        imageSrc: string;
        mode: 'profile' | 'logo';
    }>({
        isOpen: false,
        imageSrc: '',
        mode: 'profile'
    });


    const handlePriceUpdate = async (tankId: string, retailPrice: number) => {
        try {
            const tankToUpdate = tanks.find(t => t.id === tankId);
            if (!tankToUpdate) return;
            const currentMetadata = (tankToUpdate as any).metadata || {};
            await syncTankToDb(tankId, { metadata: { ...currentMetadata, retailPrice } } as any);
            setToast({ message: 'Retail Price updated successfully.', type: 'success' });
        } catch (err) {
            setToast({ message: 'Update failed.', type: 'error' });
        }
    };

    // Tank Info for Config
    const stationId = currentUser?.stationId || 'default-station-id';
    const { tanks } = useTanks(stationId);

    const [profileForm, setProfileForm] = useState({
        displayName: currentUser?.displayName || '',
        address: (currentUser?.address as any)?.street || '',
        photo_url: currentUser?.photoURL || ''
    });

    const [orgForm, setOrgForm] = useState({
        name: currentUser?.companyName || '',
        tax_id: '', 
        address: '',
        logo_url: (currentUser as any)?.logo_url || ''
    });

    // Fetch extra org data on mount
    React.useEffect(() => {
        const fetchOrgData = async () => {
            if (!currentUser?.stationId) return;
            const { data } = await supabase
                .from('fuel_stations')
                .select('*')
                .eq('station_id', currentUser.stationId)
                .maybeSingle();
            
            if (data) {
                setOrgForm(prev => ({
                    ...prev,
                    name: data.station_name || currentUser.companyName || '',
                    tax_id: data.tax_id || '',
                    address: data.billing_address || ''
                }));
            }
        };
        fetchOrgData();
    }, [currentUser?.stationId]);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfileForm(prev => ({ ...prev, [name]: value }));
    };

    const handleOrgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setOrgForm(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser?.stationId) return;
        
        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            setToast({ message: 'Only image files are accepted.', type: 'error' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setToast({ message: 'Image size must be less than 5MB.', type: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setCropperState({
                isOpen: true,
                imageSrc: reader.result as string,
                mode: 'logo'
            });
        };
        reader.readAsDataURL(file);
    };

    const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser?.authUserId) return;

        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            setToast({ message: 'Only image files are accepted.', type: 'error' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setToast({ message: 'Image size must be less than 5MB.', type: 'error' });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setCropperState({
                isOpen: true,
                imageSrc: reader.result as string,
                mode: 'profile'
            });
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        const mode = cropperState.mode;
        setCropperState(prev => ({ ...prev, isOpen: false }));

        if (mode === 'logo') {
            await finalizeLogoUpload(croppedBlob);
        } else {
            await finalizeProfileUpload(croppedBlob);
        }
    };

    const finalizeLogoUpload = async (blob: Blob) => {
        if (!currentUser?.stationId) return;
        setIsUploadingLogo(true);
        try {
            const webpBlob = await convertToWebP(blob);
            const filePath = `stations/${currentUser.stationId}/logo.webp`;
            
            const file = new File([webpBlob], "logo.webp", { type: "image/webp" });

            const { error: uploadError } = await supabase.storage
                .from('profile-photos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('profile-photos')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from('fuel_stations')
                .update({ logo_url: publicUrl })
                .eq('station_id', currentUser.stationId);

            if (dbError) throw dbError;

            await updateUser({ logoUrl: publicUrl } as any);
            setOrgForm(prev => ({ ...prev, logo_url: publicUrl }));
            await AuditService.log('UPLOAD_LOGO', currentUser.stationId, `Uploaded station logo: ${filePath}`);
            setToast({ message: 'Station branding updated.', type: 'success' });
        } catch (err: any) {
            console.error('Logo upload error:', err);
            setToast({ message: `Upload failed: ${err.message}`, type: 'error' });
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const finalizeProfileUpload = async (blob: Blob) => {
        if (!currentUser?.authUserId) return;
        setIsUploadingPhoto(true);
        try {
            const webpBlob = await convertToWebP(blob);
            const filePath = `users/${currentUser.authUserId}/avatar.webp`;
            const file = new File([webpBlob], "avatar.webp", { type: "image/webp" });

            const { error: uploadError } = await supabase.storage
                .from('profile-photos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('profile-photos')
                .getPublicUrl(filePath);

            const { error: dbError } = await supabase
                .from('profiles')
                .update({ photo_url: publicUrl })
                .eq('auth_user_id', currentUser.authUserId);

            if (dbError) throw dbError;

            await updateUser({ photoURL: publicUrl } as any);
            setProfileForm(prev => ({ ...prev, photo_url: publicUrl }));
            await AuditService.log('UPLOAD_AVATAR', currentUser.stationId || 'SYSTEM', `Uploaded profile photo: ${filePath}`);
            setToast({ message: 'Profile photo updated.', type: 'success' });
        } catch (err: any) {
            console.error('Profile photo upload error:', err);
            setToast({ message: `Upload failed: ${err.message}`, type: 'error' });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleOrgSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.stationId) return;
        setIsSaving(true);
        try {
            const { error: syncError } = await supabase
                .from('fuel_stations')
                .update({
                    station_name: orgForm.name,
                    billing_address: orgForm.address,
                    tax_id: orgForm.tax_id
                })
                .eq('station_id', currentUser.stationId);

            if (syncError) throw syncError;

            await AuditService.log('UPDATE_COMPANY', currentUser.stationId, `Updated station profile: ${orgForm.name}`);
            setToast({ message: 'Station information saved.', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: 'Failed to save station information.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleProfileSubmit =  async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateUser({
                displayName: profileForm.displayName,
                address: { ...currentUser?.address, street: profileForm.address } as any
            });
            await AuditService.log('UPDATE_PROFILE', currentUser?.stationId || 'SYSTEM', `Updated user profile: ${profileForm.displayName}`);
            setToast({ message: 'Profile information updated.', type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ message: 'Failed to update profile.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsVerifying(true);

        try {
            await verifySettingsPassword(password);
            setIsLocked(false);
        } catch (err: any) {
            setError(err.message || 'Incorrect password');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleDismissLock = () => {
        setError(null);
        setPassword('');
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/dashboard';
        }
    };

    const handleSecureReset = () => {
        setShowResetConfirmModal(true);
    };

    const confirmSecureResetInitial = () => {
        setShowResetConfirmModal(false);
        setResetAuthPassword('');
        setShowResetAuthModal(true);
    };

    const confirmSecureResetFinal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await verifySettingsPassword(resetAuthPassword);
            alert("Factory reset completed successfully.");
            setShowResetAuthModal(false);
            window.location.reload();
        } catch (err: any) {
            alert(err.message || 'Verification failed.');
        }
    };

    if (isLocked) {
        return (
            <div className="security-lock-overlay">
                <div className="security-card">
                    <div className="security-icon-box">
                        <FiLock size={32} />
                    </div>
                    
                    <h2 className="security-title">Security Access</h2>
                    <p className="security-desc">
                        Master password verification is required to access system configuration and critical parameters.
                    </p>

                    <form onSubmit={handleUnlock} className="security-form">
                        <div className="input-group">
                            <div className="password-input-wrapper">
                                <input
                                    className="settings-input"
                                    type={showLockPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter Master Password"
                                    autoFocus
                                    disabled={isVerifying}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle"
                                    onClick={() => setShowLockPassword(!showLockPassword)}
                                    disabled={isVerifying}
                                >
                                    {showLockPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                </button>
                            </div>
                            {error && <div className="text-red-500 text-xs mt-2 font-bold">{error}</div>}
                        </div>

                        <div className="flex gap-4 mt-4">
                            <button 
                                type="button"
                                className="btn btn-outline flex-1 py-3"
                                onClick={handleDismissLock}
                            >
                                Cancel
                            </button>

                            <button 
                                type="submit" 
                                className="btn btn-primary flex-1 py-3"
                                disabled={isVerifying || !password}
                            >
                                {isVerifying ? (
                                    <FiRefreshCw className="animate-spin" />
                                ) : (
                                    "Unlock Access"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-container">
            {showResetConfirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="ds-card-panel max-w-md w-full p-8">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Secure Factory Reset</h2>
                        <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                            This action will reset all station specific configuration. Are you sure you want to proceed?
                        </p>
                        <div className="form-actions">
                            <button className="btn btn-outline" onClick={() => setShowResetConfirmModal(false)}>No, Cancel</button>
                            <button className="btn btn-primary !bg-red-600 !border-red-600" onClick={confirmSecureResetInitial}>Confirm reset</button>
                        </div>
                    </div>
                </div>
            )}

            {showResetAuthModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="ds-card-panel max-w-md w-full p-8 border-red-500/30">
                        <h1 className="text-2xl font-black text-center mb-6 text-slate-800">Final Verification</h1>
                        <form onSubmit={confirmSecureResetFinal} className="settings-form">
                            <div className="input-group">
                                <label>Verify Identity</label>
                                <input 
                                    type="password" 
                                    className="settings-input" 
                                    value={resetAuthPassword} 
                                    onChange={e => setResetAuthPassword(e.target.value)} 
                                    placeholder="Enter master password"
                                    required 
                                />
                            </div>
                            <button type="submit" className="btn btn-primary !bg-red-600 !border-red-600 w-full py-4 mt-4">
                                Authorize Global Reset
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="settings-layout">
                <header className="settings-header">
                    <div>
                        <h1>{t('settings') || 'System Settings'}</h1>
                        <p className="settings-subtitle">Configure station parameters and user profile settings.</p>
                        
                        <div className="diagnostic-readout">
                            <div className="readout-item">
                                <FiShield />
                                <span>Secured</span>
                            </div>
                            <div className="readout-item">
                                <FiZap />
                                <span>Station ID: {currentUser?.stationId?.slice(0, 8).toUpperCase() || 'OFFLINE'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <button className="btn btn-outline !text-red-600 !border-red-200" onClick={handleSecureReset}>
                        <FiRefreshCw className="mr-2" /> 
                        Factory Reset
                    </button>
                </header>

                <div className="settings-grid">
                    {/* Organization Identity */}
                    <section className="ds-card-panel">
                        <div className="settings-section-title">
                            <FiBriefcase className="text-blue-600" />
                            Station Profile
                        </div>
                        <p className="settings-section-desc">Manage operational profile and company branding.</p>

                        <form onSubmit={handleOrgSubmit} className="settings-form">
                            <div className="avatar-upload-container">
                                <div className="avatar-preview" onClick={() => fileInputRef.current?.click()}>
                                    <img src={orgForm.logo_url || '/placeholder-company.png'} alt="Logo" />
                                    <div className="avatar-overlay">
                                        {isUploadingLogo ? <FiRefreshCw className="animate-spin" /> : <FiCamera size={20} />}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Station Branding</span>
                                    <p className="text-xs text-slate-500 mt-1">Accepts PNG, JPG, WebP. Max 5MB.</p>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                            </div>

                            <div className="input-group">
                                <label>Station Name</label>
                                <input className="settings-input" name="name" value={orgForm.name} onChange={handleOrgChange} placeholder="Enter fuel station name" />
                            </div>

                            <div className="form-row">
                                <div className="input-group">
                                    <label>Tax ID / PIN</label>
                                    <input className="settings-input" name="tax_id" value={orgForm.tax_id} onChange={handleOrgChange} placeholder="VAT identifier" />
                                </div>
                                <div className="input-group">
                                    <label>Region</label>
                                    <input className="settings-input" value="East Africa" disabled />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Billing Address</label>
                                <input className="settings-input" name="address" value={orgForm.address} onChange={handleOrgChange} placeholder="Physical street address" />
                            </div>

                            <div className="form-actions border-t pt-6 mt-2">
                                <button type="submit" disabled={isSaving} className="btn btn-primary px-8">
                                    <FiSave className="mr-2" /> {isSaving ? 'Saving...' : 'Save Station Profile'}
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Personal Identity */}
                    <section className="ds-card-panel">
                        <div className="settings-section-title">
                            <FiUser className="text-blue-600" />
                            User Settings
                        </div>
                        <p className="settings-section-desc">Manage personal information and profile visibility.</p>

                        <form onSubmit={handleProfileSubmit} className="settings-form">
                            <div className="avatar-upload-container">
                                <div className="avatar-preview rounded-full" onClick={() => profilePhotoInputRef.current?.click()}>
                                    <img src={profileForm.photo_url || '/placeholder-avatar.png'} alt="Avatar" />
                                    <div className="avatar-overlay">
                                        {isUploadingPhoto ? <FiRefreshCw className="animate-spin" /> : <FiCamera size={20} />}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profile Identity</span>
                                    <p className="text-xs text-slate-500 mt-1">Used for shift recording and audit logs.</p>
                                </div>
                                <input type="file" ref={profilePhotoInputRef} onChange={handleProfilePhotoUpload} className="hidden" accept="image/*" />
                            </div>

                            <div className="input-group">
                                <label>Display Name</label>
                                <input className="settings-input" name="displayName" value={profileForm.displayName} onChange={handleProfileChange} />
                            </div>

                            <div className="form-row">
                                <div className="input-group">
                                    <label>Access Role</label>
                                    <input className="settings-input capitalize" value={currentUser?.role || 'User'} disabled />
                                </div>
                                <div className="input-group">
                                    <label>Status</label>
                                    <input className="settings-input" value="Active" disabled />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Email Address</label>
                                <input className="settings-input" value={currentUser?.email || ''} disabled />
                            </div>

                            <div className="form-actions border-t pt-6 mt-2">
                                <button type="submit" disabled={isSaving} className="btn btn-primary px-8">
                                    <FiSave className="mr-2" /> {isSaving ? 'Updating...' : 'Update Account'}
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* Fleet Management */}
                    <section className="ds-card-panel fleet-card mt-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <div className="settings-section-title">
                                    <FiZap className="text-orange-500" />
                                    Fleet Inventory
                                </div>
                                <p className="settings-section-desc mb-0">Manage volumetric assets and pricing parameters.</p>
                            </div>
                            <button 
                                className="btn btn-primary"
                                onClick={() => setShowAddTankModal(true)}
                            >
                                <FiPlus className="mr-2" /> Add New Tank
                            </button>
                        </div>

                        <div className="fleet-table-container">
                            <table className="fleet-table">
                                <thead>
                                    <tr>
                                        <th>Tank ID</th>
                                        <th>Ref Name</th>
                                        <th>Capacity (L)</th>
                                        <th>Fuel Grade</th>
                                        <th>Delivery Price</th>
                                        <th>Retail Price</th>
                                        <th className="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tanks.length > 0 ? tanks.map((tank) => (
                                        <tr key={tank.id}>
                                            <td className="tank-id-tag">#{tank.id.slice(0, 8).toUpperCase()}</td>
                                            <td className="font-bold">{tank.name}</td>
                                            <td>{tank.capacity?.toLocaleString()} L</td>
                                            <td>
                                                <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600 uppercase">
                                                    {tank.fuelType}
                                                </span>
                                            </td>
                                            <td className="font-semibold text-slate-500">
                                               {(tank as any).metadata?.deliveryPrice || '0.00'}
                                            </td>
                                            <td>
                                                <input 
                                                    type="number" 
                                                    className="retail-input"
                                                    defaultValue={(tank as any).metadata?.retailPrice || 0}
                                                    onBlur={(e) => handlePriceUpdate(tank.id, Number(e.target.value))}
                                                />
                                            </td>
                                            <td className="text-right">
                                                <button className="text-blue-600 font-bold text-xs hover:underline">Config</button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                                                No tanks provisioned for this station.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>

            {showAddTankModal && (
                <AddTankModal 
                    stationId={stationId}
                    onClose={() => setShowAddTankModal(false)}
                    onSuccess={() => setShowAddTankModal(false)} 
                />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {cropperState.isOpen && (
                <ImageCropperModal
                    image={cropperState.imageSrc}
                    cropShape={cropperState.mode === 'profile' ? 'round' : 'rect'}
                    aspect={1}
                    title={cropperState.mode === 'profile' ? 'Edit Profile Photo' : 'Edit Station Logo'}
                    subtitle="Select the focal area for system display."
                    onCropComplete={handleCropComplete}
                    onCancel={() => setCropperState(prev => ({ ...prev, isOpen: false }))}
                />
            )}
        </div>
    );
};
