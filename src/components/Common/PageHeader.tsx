import React from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => {
    return (
        <header style={{
            marginBottom: '2rem',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid #E8E9F5',
        }}>
            <div>
                <h1 style={{
                    fontSize: '1.875rem',
                    fontWeight: 700,
                    color: '#323264',
                    letterSpacing: '-0.03em',
                    margin: 0,
                    lineHeight: 1.2,
                }}>
                    {title}
                </h1>
                {description && (
                    <p style={{
                        fontSize: '0.9375rem',
                        color: '#7A7A95',
                        marginTop: '0.375rem',
                        marginBottom: 0,
                        fontWeight: 400,
                        lineHeight: 1.5,
                    }}>
                        {description}
                    </p>
                )}
            </div>
            {action && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
                    {action}
                </div>
            )}
        </header>
    );
};
