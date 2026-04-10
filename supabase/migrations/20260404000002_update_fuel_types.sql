-- supabase/migrations/20260404000002_update_fuel_types.sql
-- ============================================================================
-- FIX: Update fuel types to industry standards (Diesel, Petrol, Kerosene, Jet Fuel)
-- ============================================================================

-- 1. Migrate any existing data (REQUIRED to avoid constraint violation)
-- ============================================================================
UPDATE public.tanks SET fuel_type = 'Diesel' WHERE LOWER(fuel_type) = 'diesel';
UPDATE public.tanks SET fuel_type = 'Petrol' WHERE LOWER(fuel_type) = 'petrol' OR LOWER(fuel_type) = 'gasoline';
UPDATE public.tanks SET fuel_type = 'Kerosene' WHERE LOWER(fuel_type) = 'kerosene';
UPDATE public.tanks SET fuel_type = 'Jet Fuel' WHERE LOWER(fuel_type) = 'jet fuel' OR LOWER(fuel_type) = 'jet-fuel';
UPDATE public.tanks SET fuel_type = 'LPG' WHERE LOWER(fuel_type) = 'lpg';

-- 2. Update the Tanks Table Constraint
-- ============================================================================
ALTER TABLE public.tanks DROP CONSTRAINT IF EXISTS tanks_fuel_type_check;
ALTER TABLE public.tanks ADD CONSTRAINT tanks_fuel_type_check 
  CHECK (fuel_type IN ('Diesel', 'Petrol', 'Kerosene', 'Jet Fuel', 'LPG'));

-- 3. Update Thermal Correction Calculation Logic
-- ============================================================================
-- This is used for volume correction during delivery events
CREATE OR REPLACE FUNCTION public.calculate_standard_volume(
  ambient_volume DECIMAL,
  current_temp DECIMAL,
  fuel_type TEXT
) RETURNS DECIMAL AS $$
DECLARE
  thermal_expansion_coef DECIMAL;
  standard_temp DECIMAL := 15.5; -- Standard reference temperature
  standard_volume DECIMAL;
BEGIN
  -- Select expansion coefficient based on product (Case-Insensitive)
  thermal_expansion_coef := CASE LOWER(fuel_type)
    WHEN 'diesel' THEN 0.00085
    WHEN 'petrol' THEN 0.00120
    WHEN 'kerosene' THEN 0.00095
    WHEN 'jet fuel' THEN 0.00095 -- Typical for Jet A-1
    ELSE 0.00100
  END;

  -- Correction Formula: V_std = V_amb / (1 + beta * (T - T_ref))
  standard_volume := ambient_volume / (1 + thermal_expansion_coef * (current_temp - standard_temp));
  
  RETURN ROUND(standard_volume, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;
