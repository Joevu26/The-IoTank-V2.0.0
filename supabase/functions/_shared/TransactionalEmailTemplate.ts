/**
 * TransactionalEmailTemplate — Branded templates for Welcome & Invitations
 */
export const renderTransactionalEmail = (params: {
    type: 'WELCOME' | 'INVITATION';
    recipientName: string;
    stationName?: string;
    loginUrl: string;
    senderName?: string;
}) => {
    const isInvite = params.type === 'INVITATION';
    const title = isInvite ? 'Team Invitation: IoTank Fuel Intelligence' : 'Welcome to the IoTank AI Grid';
    const actionLabel = isInvite ? 'ACCEPT INVITATION' : 'ACCESS DASHBOARD';

    return `
    <div style="font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; border-radius: 16px; border: 1px solid #334155; max-width: 600px; margin: 0 auto;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: white; padding: 12px 20px; border-radius: 8px; font-weight: 800; text-transform: uppercase; text-align: center; letter-spacing: 1px;">
            🛡️ IoTank Fuel Intelligence
        </div>

        <!-- Title -->
        <h1 style="font-size: 24px; margin: 32px 0 12px; text-align: center; color: white;">${title}</h1>
        <p style="color: #94a3b8; margin: 0 0 32px; text-align: center; font-size: 16px;">
            Hello, ${params.recipientName}
        </p>

        <!-- Message Body -->
        <div style="background: #1e293b; padding: 24px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 32px;">
            <p style="margin-top: 0; line-height: 1.6; color: #cbd5e1;">
                ${isInvite 
                    ? `<b>${params.senderName || 'An administrator'}</b> has invited you to join the team at <b>${params.stationName}</b>. You will have access to real-time telemetry, forensic monitoring, and automated fuel logistics.`
                    : `Your registration for <b>${params.stationName}</b> has been approved. You now have full access to the most advanced fuel monitoring grid in the region.`}
            </p>
            <p style="line-height: 1.6; color: #cbd5e1;">
                Click the button below to complete your setup and access your dashboard.
            </p>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center;">
            <a href="${params.loginUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(99,102,241,0.3);">
                ${actionLabel}
            </a>
        </div>

        <!-- Support Note -->
        <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 40px;">
            If you didn't expect this email, you can safely ignore it.<br/>
            Need help? Contact <a href="mailto:support@iotank.com" style="color: #6366f1; text-decoration: none;">support@iotank.com</a>
        </p>

        <!-- Footer -->
        <hr style="border: 0; border-top: 1px solid #334155; margin: 40px 0 20px;"/>
        <p style="font-size: 11px; color: #64748b; text-align: center; line-height: 1.6;">
            © 2026 IoTank Fuel Intelligence Hub. All rights reserved.<br/>
            Forensic monitoring active • Data sovereignty enabled
        </p>
    </div>
    `;
};
