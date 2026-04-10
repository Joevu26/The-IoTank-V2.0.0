/**
 * ============================================================
 *  Tank   : Petrol Storage 1 | 2000L capacity
 *  Org ID : 70508c07-0bfc-4f9c-b47b-4d2572c7aca2
 *  Tank ID: 998bbb8d-6a0b-44e6-b2b7-f5bde17a3f63
 * ============================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <esp_random.h>
#include <math.h>

// ─── WiFi Configuration ──────────────────────────────────────
const char* WIFI_SSID     = "Joe_Net solns™";
const char* WIFI_PASSWORD = "Joe@joe26";

// ─── Supabase Configuration ─────────────────────────────────
const char* SUPABASE_URL              = "https://suifvborodwergtrbjez.supabase.co/rest/v1/sensor_readings";
const char* SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aWZ2Ym9yb2R3ZXJndHJiamV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc2MDc0MCwiZXhwIjoyMDg5MzM2NzQwfQ.96AE-5FQpBvOKKjfNmbqWX05x3ND6ifyO4ITP0c-Gvc";

// ─── ID Configuration ───────────────────────────────────────
const char* STATION_ID = "9a594b8e-15b2-48a8-b17d-7ef7fa5e9b8a"; 
const char* TANK_ID    = "18f70714-35d6-45cd-8019-00c9cff35d65";

/**
 * [SECURITY NOTE]
 * For production, never embed the SUPABASE_SERVICE_ROLE_KEY.
 * Instead, use the IoTank Secure Token workflow:
 * 1. Call Edge Function /issue-device-token (requires Admin auth)
 * 2. Store the returned 'token' (JWT) in ESP32 Flash/EEPROM
 * 3. Use that token in the 'Authorization: Bearer <TOKEN>' header
 */
const char* SECURE_DEVICE_TOKEN = "PASTE_YOUR_HARDWARE_JWT_HERE"; 

// ─── Tank Configuration ──────────────────────────────────────
#define TANK_CAPACITY       2000.0f
#define TANK_START_MIN      50.0f
#define TANK_START_MAX      500.0f
#define LOW_FUEL_THRESHOLD  100.0f

// ─── Pump / Dispense Configuration ──────────────────────────
#define DISPENSE_RATE_LPS    0.8333f   // 50 L/min
#define DB_WRITE_INTERVAL_MS 6000      // Log every 5L (6s)
#define DB_WRITE_CHUNK       5.0f

// ─── Refill Configuration ────────────────────────────────────
#define REFILL_RATE_LPS     2.5f       // 150 L/min
#define REFILL_INTERVAL_MS  4000       // Log every 10L (4s)
#define REFILL_CHUNK        10.0f

// ─── Temperature Simulation ──────────────────────────────────
#define TEMP_BASE_MIN       22.0f
#define TEMP_BASE_MAX       34.0f
#define TEMP_NOISE          0.4f

// ─── State ───────────────────────────────────────────────────
float tankLevel      = 0.0f;
float totalDispensed = 0.0f;
int   dispenseCount  = 0;
float currentTemp    = 28.0f;
unsigned long elapsedSec = 0;

// ─── Vehicle Types ──────────────────────────────────────────
struct VehicleType {
  const char* name;
  int         minLitres;
  int         maxLitres;
  float       probability;
};

const VehicleType VEHICLES[] = {
  { "Motorbike",       5,  15, 0.30f },
  { "Car",            20,  45, 0.55f },
  { "Transit/Matatu", 45,  60, 0.15f }
};
const int VEHICLE_COUNT = 3;

// ─── Supabase Push Function ─────────────────────────────────
void pushToSupabase(float vol, float temp) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("  ⚠ WiFi disconnected. Skipping push."));
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // No certificate validation for simulation purposes

  HTTPClient http;
  http.begin(client, SUPABASE_URL);
  
  // Headers
  http.addHeader("Content-Type", "application/json");

  // Determine which key to use (Use Device Token if available, otherwise fallback to Service Role for testing)
  String activeToken = String(SECURE_DEVICE_TOKEN);
  if (activeToken == "PASTE_YOUR_HARDWARE_JWT_HERE" || activeToken.length() < 10) {
    activeToken = String(SUPABASE_SERVICE_ROLE_KEY);
  }

  // Supabase's API Gateway (Kong) requires the 'apikey' header for ALL requests.
  http.addHeader("apikey", activeToken);
  String authHeader = "Bearer " + activeToken;
  http.addHeader("Authorization", authHeader);
  http.addHeader("Prefer", "return=minimal");

  // Payload (JSON)
  // Matching sensor_readings table exactly
  float fillPct = (vol / TANK_CAPACITY) * 100.0f;
  String jsonPayload = "{\"station_id\": \"" + String(STATION_ID) + "\", \"tank_id\": \"" + String(TANK_ID) + "\", \"volume\": " + String(vol, 2) + ", \"temperature\": " + String(temp, 2) + ", \"rssi\": " + String(WiFi.RSSI()) + "}";

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode >= 200 && httpResponseCode <= 299) {
    Serial.printf("  [Supabase] Success (HTTP %d)\n", httpResponseCode);
  } else if (httpResponseCode == 409) {
    Serial.printf("  [Supabase] Warning: Conflict/Duplicate (HTTP 409)\n");
    String responseBody = http.getString();
    Serial.print("  [Supabase] Debug: ");
    Serial.println(responseBody);
  } else if (httpResponseCode > 0) {
    Serial.printf("  [Supabase] Error: (HTTP %d)\n", httpResponseCode);
    String responseBody = http.getString();
    Serial.print("  [Supabase] Detail: ");
    Serial.println(responseBody);
  } else {
    Serial.printf("  [Supabase] ERROR: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  
  http.end();
}

// ─── Helpers ────────────────────────────────────────────────
float randFloat(float lo, float hi) {
  return lo + ((float)random(0, 10000) / 10000.0f) * (hi - lo);
}

float simulateTemp(unsigned long sec) {
  float hour = fmod((float)sec / 3600.0f, 24.0f);
  float sine = sin((hour - 6.0f) * PI / 12.0f);
  float base = TEMP_BASE_MIN + (TEMP_BASE_MAX - TEMP_BASE_MIN) * ((sine + 1.0f) / 2.0f);
  return base + randFloat(-TEMP_NOISE, TEMP_NOISE);
}

const VehicleType& pickVehicle() {
  float r = randFloat(0.0f, 1.0f);
  float cumulative = 0.0f;
  for (int i = 0; i < VEHICLE_COUNT - 1; i++) {
    cumulative += VEHICLES[i].probability;
    if (r < cumulative) return VEHICLES[i];
  }
  return VEHICLES[VEHICLE_COUNT - 1];
}

// ─── Main Simulation Logic ──────────────────────────────────
void simulateDispense() {
  const VehicleType& v = pickVehicle();
  int volume = (random(v.minLitres / 5, (v.maxLitres / 5) + 1)) * 5;

  if ((float)volume > tankLevel - 20.0f) {
    volume = (int)((tankLevel - 20.0f) / 5.0f) * 5;
    if (volume <= 0) return;
  }

  Serial.printf("\n🚗 DISPENSE START | %s | %dL\n", v.name, volume);
  
  int chunks = volume / (int)DB_WRITE_CHUNK;
  for (int c = 1; c <= chunks; c++) {
    delay(DB_WRITE_INTERVAL_MS);
    elapsedSec += 6;
    tankLevel -= DB_WRITE_CHUNK;
    currentTemp = simulateTemp(elapsedSec);
    
    Serial.printf("   Progress: %d/%dL | Tank: %.1fL | RSSI: %d\n", 
                  c * 5, volume, tankLevel, WiFi.RSSI());
    
    pushToSupabase(tankLevel, currentTemp);
  }
  dispenseCount++;
}

void simulateRefill() {
  float needed = TANK_CAPACITY - tankLevel;
  int chunks = (int)(needed / REFILL_CHUNK);
  
  Serial.printf("\n⛽ REFILL START | Adding %.0fL\n", needed);

  for (int c = 1; c <= chunks; c++) {
    delay(REFILL_INTERVAL_MS);
    elapsedSec += 4;
    tankLevel += REFILL_CHUNK;
    currentTemp = simulateTemp(elapsedSec);
    
    Serial.printf("   Refilling: +%.0fL | Tank: %.1fL\n", 
                  (float)c * REFILL_CHUNK, tankLevel);
    
    pushToSupabase(tankLevel, currentTemp);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // WiFi Connection
  Serial.printf("\nConnecting to %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nCONNECTED!");

  randomSeed(esp_random());
  tankLevel = round(randFloat(TANK_START_MIN, TANK_START_MAX) / 5.0f) * 5.0f;
  
  Serial.println("IoTank Simulator Online.");
  pushToSupabase(tankLevel, simulateTemp(0));
}

void loop() {
  if (tankLevel <= LOW_FUEL_THRESHOLD) {
    simulateRefill();
  }

  // Idle (1-2 mins for simulation speed)
  unsigned long idleSec = random(60, 120);
  Serial.printf("\n💤 Idle for %lu seconds...\n", idleSec);
  
  for (int i = 0; i < idleSec / 10; i++) {
    delay(10000); // 10s heartbeat
    elapsedSec += 10;
    currentTemp = simulateTemp(elapsedSec);
    Serial.printf("   [Heartbeat] Tank: %.1fL | Temp: %.1fC | RSSI: %d\n", 
                  tankLevel, currentTemp, WiFi.RSSI());
    pushToSupabase(tankLevel, currentTemp);
  }

  simulateDispense();
}
