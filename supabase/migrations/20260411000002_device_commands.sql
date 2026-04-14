-- supabase/migrations/20260411000002_device_commands.sql
-- ============================================================================
-- DEVICE COMMAND & CONTROL (C2) INFRASTRUCTURE
-- ============================================================================

-- 1. Create the commands table
CREATE TABLE IF NOT EXISTS public.device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.fuel_stations(station_id) ON DELETE CASCADE,
    device_id TEXT NOT NULL, -- Logical ID of the hardware (e.g. MAC address)
    command TEXT NOT NULL,   -- e.g. 'SET_WIFI', 'REBOOT', 'PING'
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'processed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- 2. Enable RLS
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- 3. Policies for Administrative Users
-- Users can see commands for their own station
DROP POLICY IF EXISTS "Users can view their station commands" ON public.device_commands;
CREATE POLICY "Users can view their station commands" ON public.device_commands
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.auth_user_id = auth.uid()
        AND profiles.station_id = device_commands.station_id
    )
);

-- Users can insert commands for their own station
DROP POLICY IF EXISTS "Users can insert station commands" ON public.device_commands;
CREATE POLICY "Users can insert station commands" ON public.device_commands
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.auth_user_id = auth.uid()
        AND profiles.station_id = station_id
    )
);

-- 4. Policies for Hardware Devices (via device-role JWT)
-- Devices can view pending commands for themselves
DROP POLICY IF EXISTS "Devices can view their own commands" ON public.device_commands;
CREATE POLICY "Devices can view their own commands" ON public.device_commands
FOR SELECT USING (
    (auth.jwt() ->> 'role' = 'device') AND
    (auth.jwt() ->> 'station_id')::uuid = station_id
);

-- Devices can update the status of their commands
DROP POLICY IF EXISTS "Devices can update their command status" ON public.device_commands;
CREATE POLICY "Devices can update their command status" ON public.device_commands
FOR UPDATE USING (
    (auth.jwt() ->> 'role' = 'device') AND
    (auth.jwt() ->> 'station_id')::uuid = station_id
) WITH CHECK (
    (auth.jwt() ->> 'role' = 'device') AND
    (auth.jwt() ->> 'station_id')::uuid = station_id
);

-- 5. Enable Supabase Realtime (Publication)
-- This allows the ESP32 to listen for NEW inserts to this table.
-- Note: 'ALTER PUBLICATION ... ADD TABLE' might fail if already added.
-- We use a DO block to make it idempotent.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'device_commands'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE device_commands;
    END IF;
END $$;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_commands_station ON public.device_commands(station_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_status ON public.device_commands(status) WHERE status = 'pending';
