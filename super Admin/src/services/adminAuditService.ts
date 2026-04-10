import { supabase } from '../config/supabase';

export interface AuditEntry {
    id: string;
    timestamp: string;
    user_name: string;
    user_email: string;
    user_role: string;
    action_category: 'System' | 'User' | 'Financial' | 'Support' | 'Security' | 'Hardware' | 'Data';
    action_type: string;
    description: string;
    resource_id?: string;
    ip_address: string;
    user_agent: string;
    result: 'success' | 'failed';
    changes?: { before: any; after: any };
}

export interface FinancialTrail {
    id: string;
    timestamp: string;
    type: 'Payment' | 'Refund' | 'Adjustment' | 'Charge' | 'Credit';
    client_name: string;
    amount: number;
    prev_balance: number;
    new_balance: number;
    initiated_by: string;
    reference: string;
    status: 'completed' | 'reversed' | 'pending';
}

export interface ComplianceStatus {
    id: string;
    name: string;
    category: 'EPRA' | 'NEMA' | 'KRA' | 'Data Protection';
    status: 'compliant' | 'warning' | 'expired';
    expiry_date?: string;
    last_audit: string;
}

export interface SecurityIncident {
    id: string;
    timestamp: string;
    type: 'Brute Force' | 'Unauthorized Access' | 'Suspicious Export' | 'SQL Injection Attempt';
    severity: 'low' | 'medium' | 'high' | 'critical';
    source_ip: string;
    status: 'blocked' | 'flagged' | 'resolved';
}

export const adminAuditService = {
    async getAuditLogs(filters?: any): Promise<AuditEntry[]> {
        return [
            {
                id: '1',
                timestamp: new Date().toISOString(),
                user_name: 'Joseph O.',
                user_email: 'joseph@iotank.co.ke',
                user_role: 'Super Admin',
                action_category: 'Financial',
                action_type: 'Debt Adjustment',
                description: 'Adjusted debt for Pearl Station by KES 5,000',
                resource_id: 'TX-99812',
                ip_address: '192.168.1.42',
                user_agent: 'Mozilla/5.0...',
                result: 'success',
                changes: { before: { balance: 12000 }, after: { balance: 7000 } }
            },
            {
                id: '2',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                user_name: 'System Bot',
                user_email: 'service@iotank.co.ke',
                user_role: 'System',
                action_category: 'Security',
                action_type: 'Brute Force Blocked',
                description: 'Blocked IP 185.22.11.4 after 10 failed login attempts',
                ip_address: '185.22.11.4',
                user_agent: 'Unknown',
                result: 'success'
            }
        ];
    },

    async getFinancialTrail(): Promise<FinancialTrail[]> {
        return [
            {
                id: 'FT-1001',
                timestamp: '2026-03-22 10:45:12',
                type: 'Payment',
                client_name: 'Nairobi West Station',
                amount: 45000,
                prev_balance: 62000,
                new_balance: 17000,
                initiated_by: 'M-Pesa Gateway',
                reference: 'RKG79Y2X9S',
                status: 'completed'
            }
        ];
    },

    async getComplianceOverview(): Promise<ComplianceStatus[]> {
        return [
            { id: '1', name: 'EPRA Operating License', category: 'EPRA', status: 'compliant', expiry_date: '2026-12-31', last_audit: '2026-01-15' },
            { id: '2', name: 'NEMA Effluent Discharge', category: 'NEMA', status: 'warning', expiry_date: '2026-04-10', last_audit: '2025-10-20' },
            { id: '3', name: 'VAT Remittance Q1', category: 'KRA', status: 'compliant', last_audit: '2026-03-20' }
        ];
    },

    async getSecurityIncidents(): Promise<SecurityIncident[]> {
        return [
            { id: '1', timestamp: '2026-03-22 08:30:00', type: 'Brute Force', severity: 'high', source_ip: '185.22.11.4', status: 'blocked' }
        ];
    },

    async getAdminRiskMetrics() {
        return {
            highRiskActions: 12,
            suspiciousLogins: 4,
            unauthorizedAttempt: 2,
            avgResolutionTime: '1.2h'
        };
    }
};
