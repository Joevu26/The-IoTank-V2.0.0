/*
 * The IoTank V2.0.0 - ESP32 Firmware Template
 * 
 * Hardware: ESP32 + A02YYUW Ultrasonic Sensor + DS18B20 Temp Sensor
 * Libraries: 
 *   - Firebase-ESP-Client (by Mobizt)
 *   - OneWire & DallasTemperature
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- CONFIGURATION ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define API_KEY "AIzaSyBD2rpCklOeU5Q_zZw1Fwe-s5ugKKWw5k8"
#define DATABASE_URL "the-iotank-project.firebaseio.com"

#define ORG_ID "YOUR_ORG_ID"
#define TANK_ID "YOUR_TANK_ID"

// Pin Definitions
#define SENSOR_TX 17 // Ultrasonic TX -> ESP32 RX2
#define SENSOR_RX 16 // Ultrasonic RX -> ESP32 TX2
#define ONE_WIRE_BUS 4 // DS18B20 Data Pin

// --- GLOBALS ---
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

unsigned char data[4] = {0};
float distance = 0;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, SENSOR_TX, SENSOR_RX);
  sensors.begin();

  // WiFi Connection
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");

  // Firebase Setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

float readUltrasonic() {
  if (Serial2.available()) {
    if (Serial2.read() == 0xff) {
      data[0] = 0xff;
      for (int i = 1; i < 4; i++) {
        data[i] = Serial2.read();
      }
      int sum = (data[0] + data[1] + data[2]) & 0x00FF;
      if (sum == data[3]) {
        distance = (data[1] << 8) + data[2];
        return distance / 10.0; // Return in cm
      }
    }
  }
  return -1;
}

void loop() {
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  float distCm = readUltrasonic();

  if (distCm > 0) {
    FirebaseJson json;
    json.set("rawDistance", distCm);
    json.set("temperature", tempC);
    json.set("timestamp", (double)millis()); // In production, use Firebase cloud timestamp
    json.set("deviceId", WiFi.macAddress());
    json.set("processingLocation", "edge");

    // Path must match: organizations/{orgId}/tanks/{tankId}/raw_readings
    String path = "organizations/" + String(ORG_ID) + "/tanks/" + String(TANK_ID) + "/raw_readings";
    
    if (Firebase.RTDB.pushJSON(&fbdo, path, &json)) {
      Serial.println("Data sent successfully!");
    } else {
      Serial.println(fbdo.errorReason());
    }
  }

  delay(60000); // Wait 1 minute
}
