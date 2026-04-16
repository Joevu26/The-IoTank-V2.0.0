-- supabase/migrations/20260415110000_tankiq_rpc_tools.sql

-- 1. Function to get a station summary (safe info)
CREATE OR REPLACE FUNCTION get_tankiq_station_summary(p_station_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'station_id', p_station_id,
        'timestamp', now(),
        'tanks', (
            SELECT jsonb_agg(jsonb_build_object(
                'label', tank_name,
                'fuel_type', fuel_type,
                'capacity', tank_capacity,
                'current_volume', current_volume,
                'fill_percent', ROUND((current_volume / NULLIF(tank_capacity, 0)) * 100, 1)
            ))
            FROM tanks
            WHERE station_id = p_station_id AND status = 'active'
        ),
        'recent_alerts', (
            SELECT jsonb_agg(jsonb_build_object(
                'type', alert_type,
                'severity', severity,
                'message', message,
                'time', timestamp
            ))
            FROM alerts
            WHERE station_id = p_station_id AND is_resolved = false
            ORDER BY timestamp DESC
            LIMIT 5
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- 2. Function to get consumption stats over X days
CREATE OR REPLACE FUNCTION get_tankiq_consumption_stats(p_station_id UUID, p_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'period_days', p_days,
        'summary', (
            -- This is a simplified calculation for the AI to reason about
            -- Real production would use a more complex aggregate
            SELECT jsonb_agg(jsonb_build_object(
                'tank_name', t.tank_name,
                'total_burn', SUM(s.volume_sold_liters),
                'avg_daily_burn', SUM(s.volume_sold_liters) / p_days
            ))
            FROM tanks t
            JOIN shift_closures s ON t.id = s.tank_id
            WHERE t.station_id = p_station_id 
              AND s.closed_at > (now() - (p_days || ' days')::INTERVAL)
            GROUP BY t.id, t.tank_name
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- 3. Function to get recent delivery logs
CREATE OR REPLACE FUNCTION get_tankiq_delivery_logs(p_station_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'tank_name', t.tank_name,
        'volume', d.volume_liters,
        'date', d.delivery_date,
        'supplier', d.supplier_name
    ))
    FROM deliveries d
    JOIN tanks t ON d.tank_id = t.id
    WHERE d.station_id = p_station_id
    ORDER BY d.delivery_date DESC
    LIMIT p_limit
    INTO result;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- 4. Function to get EPRA market context
CREATE OR REPLACE FUNCTION get_tankiq_market_context()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'latest_prices', (
            SELECT jsonb_agg(jsonb_build_object(
                'fuel_type', fuel_type,
                'price', price_per_liter,
                'source', source,
                'date', created_at
            ))
            FROM raw_market_data
            WHERE source = 'epra'
            ORDER BY created_at DESC
            LIMIT 3
        ),
        'regulatory_notices', (
            SELECT jsonb_agg(jsonb_build_object(
                'title', title,
                'summary', summary,
                'effective_date', effective_date
            ))
            FROM regulatory_notices
            ORDER BY created_at DESC
            LIMIT 2
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_tankiq_station_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_tankiq_consumption_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_tankiq_delivery_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_tankiq_market_context TO authenticated;
