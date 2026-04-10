# IoTank Supabase Secret Synchronization Script
# This script ensures your local .env matches your Supabase Edge Function environment variables.

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found at $envFile"
    exit 1
}

$envVars = Get-Content $envFile | Where-Object { $_ -match "^[^#].+=.+" } | ForEach-Object {
    $parts = $_ -split "=", 2
    [PSCustomObject]@{
        Key = $parts[0].Trim()
        Value = $parts[1].Trim()
    }
}

$supabaseUrl = ($envVars | Where-Object { $_.Key -eq "VITE_SUPABASE_URL" }).Value
$supabaseAnonKey = ($envVars | Where-Object { $_.Key -eq "VITE_SUPABASE_ANON_KEY" }).Value
$serviceRoleKey = ($envVars | Where-Object { $_.Key -eq "SUPABASE_SERVICE_ROLE_KEY" }).Value

if (-not $supabaseUrl) {
    Write-Error "VITE_SUPABASE_URL not found in .env"
    exit 1
}

Write-Host "Syncing secrets for $supabaseUrl..."

# Extract project reference from URL (e.g., https://xyz.supabase.co -> xyz)
$projectRef = ($supabaseUrl -replace "https://", "" -replace "\.supabase\.co", "").Trim()

if (-not $projectRef) {
    Write-Error "Could not determine Supabase project reference from URL: $supabaseUrl"
    exit 1
}

# If SERVICE ROLE KEY is in .env, sync it (Supabase often needs it as an env var in the function)
if ($serviceRoleKey) {
    Write-Host "Setting SERVICE_ROLE_KEY..."
    supabase secrets set --project-ref $projectRef "SERVICE_ROLE_KEY=$serviceRoleKey"
} else {
    Write-Warning "SUPABASE_SERVICE_ROLE_KEY not found in .env. Please add it from your Supabase Dashboard (Settings -> API)."
}

Write-Host "`nSyncing other common environment variables..."
supabase secrets set --project-ref $projectRef "SUPABASE_URL=$supabaseUrl"
supabase secrets set --project-ref $projectRef "SUPABASE_ANON_KEY=$supabaseAnonKey"

Write-Host "`nSecret synchronization complete. Please refresh your Super Admin dashboard and try again."
