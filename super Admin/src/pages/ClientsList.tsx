import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { clientsService } from '../services/clientsService';
import { 
    FiSearch, FiFilter, FiActivity, FiMapPin, FiDatabase, 
    FiCodesandbox, FiChevronDown, FiChevronUp, FiExternalLink,
    FiPlus, FiRefreshCcw, FiCopy, FiCheck, FiInfo
} from 'react-icons/fi';
import './ClientsList.css';

const ClientsList: React.FC = () => {
    const navigate = useNavigate();
    const [stations, setStations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStation, setSelectedStation] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        fetchStations();
    }, []);

    const fetchStations = async () => {
        setLoading(true);
        try {
            const data = await clientsService.getRegisteredStations();
            setStations(data || []);
        } catch (error) {
            console.error('Error fetching stations:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleOpenDetails = (station: any) => {
        setSelectedStation(station);
        setIsModalOpen(true);
    };

    const filteredStations = stations.filter(station => 
        station.station_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        station.station_id.includes(searchTerm) ||
        station.county?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Layout>
            <div className="stations-page animate-fade-in">
                <div className="logistics-style-card">
                    <div className="logistics-header">
                        <div className="header-top-row">
                            <div className="logistics-title">
                                <div className="grid-icon-box">
                                    <FiCodesandbox />
                                </div>
                                <h2>Registered Stations: Management</h2>
                            </div>
                            <div className="stat-pill-top">
                                <FiDatabase size={14} /> <span>{stations.length} Total</span>
                            </div>
                        </div>
                        
                        <div className="header-controls-row">
                             <div className="search-wrapper-top">
                                <FiSearch className="search-icon" />
                                <input 
                                    type="text" 
                                    placeholder="Find Station by Name, ID or Location..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="premium-search-input-top"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="table-container-minimal">
                        <table className="logistics-table">
                            <thead>
                                <tr>
                                    <th>Station ID</th>
                                    <th>Station Name</th>
                                    <th>Contact</th>
                                    <th>Tanks Count</th>
                                    <th>County</th>
                                    <th>Status</th>
                                    <th>Created On</th>
                                    <th className="text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="py-20 text-center">
                                            <div className="flex flex-col items-center opacity-40">
                                                <div className="animate-spin mb-4"><FiRefreshCcw size={32} /></div>
                                                <p className="font-bold tracking-widest uppercase text-xs">Accessing Organization Registry...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredStations.map((station) => (
                                    <tr key={station.station_id} className={station.account_status === 'suspended' ? 'row-accent' : ''}>
                                        <td className="font-mono text-[10px] opacity-80" style={{ maxWidth: '140px' }}>
                                            <div className="flex items-center justify-between bg-gray-50/50 p-1 rounded">
                                                <span className="truncate mr-2" title={station.station_id}>{station.station_id}</span>
                                                <button 
                                                    onClick={() => copyToClipboard(station.station_id, `row-${station.station_id}`)}
                                                    className="text-primary hover:text-blue-700 transition"
                                                    title="Copy full System ID"
                                                >
                                                    {copiedId === `row-${station.station_id}` ? <FiCheck size={12} className="text-success" /> : <FiCopy size={12} />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="font-bold text-dark">
                                            {station.station_name}
                                        </td>
                                        <td className="text-muted text-sm">
                                            {station.phone || station.email?.split('@')[0]}
                                        </td>
                                        <td className="font-bold">
                                            {station.tanks?.length || 0}
                                        </td>
                                        <td className="text-muted">
                                            {station.county || 'N/A'}
                                        </td>
                                        <td>
                                            <span className={`status-text ${station.account_status}`}>
                                                {station.account_status}
                                            </span>
                                        </td>
                                        <td className="text-muted">
                                            {new Date(station.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="text-right">
                                            <button 
                                                onClick={() => handleOpenDetails(station)}
                                                className="details-link"
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Standard Details Modal */}
            {isModalOpen && selectedStation && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="standard-modal animate-modal-entry" onClick={e => e.stopPropagation()}>
                        <div className="standard-modal-header">
                            <div className="header-content-left">
                                <div className="title-group">
                                    <h1>Station Details Archive</h1>
                                    <p>Comprehensive metadata and hardware inventory overview.</p>
                                </div>
                                <div className="tag-flex">
                                    <span className="standard-tag">STATION ENTITY</span>
                                    <span className="standard-tag">SYSTEM ID: {selectedStation.station_id.slice(0, 8).toUpperCase()}</span>
                                </div>
                            </div>
                            <button className="standard-close-btn" onClick={() => setIsModalOpen(false)}>
                                <div className="close-glow">
                                    <span>&times;</span>
                                </div>
                            </button>
                        </div>

                        <div className="standard-modal-body">
                            {/* Section 1: Logistics & Identity */}
                            <div className="standard-section-card">
                                <div className="section-header">
                                    <div className="section-icon-box">
                                        <FiInfo className="section-icon" />
                                    </div>
                                    <label>STATION IDENTITY</label>
                                </div>
                                <div className="section-content">
                                    <div className="standard-grid-1">
                                        <div className="standard-field-box">
                                            <label>STATION NAME</label>
                                            <div className="field-box-value font-black text-dark">
                                                {selectedStation.station_name}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="standard-grid-2">
                                        <div className="standard-field-box">
                                            <label>PRIMARY CONTACT</label>
                                            <div className="field-box-value">{selectedStation.phone || 'N/A'}</div>
                                        </div>
                                        <div className="standard-field-box">
                                            <label>ACCOUNT STATUS</label>
                                            <div className={`field-box-value status-text ${selectedStation.account_status}`}>
                                                {selectedStation.account_status}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="standard-grid-2">
                                        <div className="standard-field-box">
                                            <label>REGISTERED COUNTY</label>
                                            <div className="field-box-value">{selectedStation.county || 'N/A'}</div>
                                        </div>
                                        <div className="standard-field-box">
                                            <label>REGISTRATION DATE</label>
                                            <div className="field-box-value">
                                                {new Date(selectedStation.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="standard-grid-1">
                                        <div className="standard-field-box">
                                            <label>FUEL STATION ID (SYSTEM CORE)</label>
                                            <div className="field-box-value flex justify-between items-center bg-gray-50/50">
                                                <code className="text-secondary select-all">{selectedStation.station_id}</code>
                                                <button 
                                                    className="copy-mini-btn"
                                                    onClick={() => copyToClipboard(selectedStation.station_id, 'org-id')}
                                                >
                                                    {copiedId === 'org-id' ? <FiCheck className="text-success" /> : <FiCopy />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Hardware & Inventory */}
                            <div className="standard-section-card">
                                <div className="section-header pink-accent">
                                    <div className="section-icon-box pink">
                                        <FiCodesandbox className="section-icon" />
                                    </div>
                                    <label>HARDWARE & TANKS INVENTORY</label>
                                </div>
                                <div className="section-content">
                                    {selectedStation.tanks && selectedStation.tanks.length > 0 ? (
                                        selectedStation.tanks.map((tank: any) => (
                                            <div key={tank.id} className="tank-inventory-row">
                                                <div className="standard-grid-2">
                                                    <div className="standard-field-box">
                                                        <label>TANK NAME</label>
                                                        <div className="field-box-value font-bold">{tank.tank_name}</div>
                                                    </div>
                                                    <div className="standard-field-box">
                                                        <label>FUEL TYPE</label>
                                                        <div className="field-box-value">{tank.fuel_type}</div>
                                                    </div>
                                                </div>
                                                <div className="standard-grid-2 mt-4">
                                                     <div className="standard-field-box">
                                                        <label>METERED CAPACITY (LITERS)</label>
                                                        <div className="field-box-value font-black text-primary">
                                                            {Number(tank.tank_capacity).toLocaleString()} L
                                                        </div>
                                                    </div>
                                                    <div className="standard-field-box">
                                                        <label>HARDWARE SYSTEM ID</label>
                                                        <div className="field-box-value flex justify-between items-center">
                                                            <code className="text-[10px] opacity-60 font-mono truncate mr-2">
                                                                {tank.id.toUpperCase()}
                                                            </code>
                                                            <button 
                                                                className="copy-mini-btn"
                                                                onClick={() => copyToClipboard(tank.id, tank.id)}
                                                            >
                                                                {copiedId === tank.id ? <FiCheck size={12}/> : <FiCopy size={12}/>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-hardware-state">
                                            <FiCodesandbox size={40} className="mb-2 opacity-20" />
                                            <p>No active hardware telemetry detected for this station.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="standard-modal-footer">
                            <button className="footer-btn secondary" onClick={() => setIsModalOpen(false)}>CLOSE ARCHIVE</button>
                            <button className="footer-btn primary" onClick={() => navigate(`/clients/${selectedStation.station_id}`)}>
                                ADVANCED CONFIGURATION <FiExternalLink className="ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ClientsList;
