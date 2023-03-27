#include "FFat.h"
#include "MMA8452Q.h"
#include "RTClib.h" // Date and time functions using a DS3231 RTC connected via I2C and Wire lib
#include "arduinoFFT.h"
#include <ArduinoBLE.h>
#include <Wire.h> // Must include Wire library for I2C

#define SDA 4
#define SCL 6
#define LED 35
#define ACCEL_INTERRUPT_PIN 17

#define SERVICE_UUID "6c904b4f-f3d1-45b4-8086-398f356d9a77"
#define DATA_UUID "989fb3df-4365-4e08-a180-7f4295e2cd8d"
#define TIMESTAMP_UUID "2a11"
#define STATUS_UUID "2431c2b0-6531-4c11-8700-6bbe52b887cd"

/************** Constants *************/
const char filename[] = "/data.bin\0";
const uint16_t samples = 256;         // This value MUST ALWAYS be a power of 2
const double samplingFrequency = 100; // Hz, must be less than 10000 due to ADC

/*************** Global variables ************/
/*
  These are the input and output vectors
  Input vectors receive computed results from FFT
*/
double vReal[samples];
double vImag[samples];
float storageBuffer[samples];
uint8_t accelHead = 0;
uint8_t bufferReadHead = 0;
uint8_t bufferWriteHead = 0;

int oldBatteryLevel = 0;  // last battery level reading from analog input
long previousMillisBattery = 0;  // last time the battery level was checked, in ms

uint8_t *b; // Pointer for casting values into their bytes form

bool inter = false;        // Flag indicating an accelerometer interruption
bool shouldRecord = false; // Flag signaling if the log process should run
bool newDataAvailable =
    false; // Flag signaling the existence of new data for logging
bool getTimestamp =
    false; // Flag signaling that the timestamp should be updated

long ts; // Stores the timestamp value

const uint8_t separator[] = {0, 0, 0, 0, 0, 0, 0, 0};

// Boolean variables used for switching between
// endpoint during BLE tranmission
bool thisValueIsZero = true;
bool lastValueIsZero = true;

TaskHandle_t TaskBLE;

/*********** Object instances *********/
MMA8452Q accel;                // create instance of the MMA8452 class
arduinoFFT FFT = arduinoFFT(); /* Create FFT object */
RTC_DS3231 rtc;

/**** BLE services and characteristics ********/

BLEService braceletService(SERVICE_UUID);
// Bluetooth® Low Energy Battery Service
BLEService batteryService("180f");
BLECharacteristic rawDataChar(DATA_UUID, BLERead | BLENotify, 4);
BLECharacteristic timestampChar(TIMESTAMP_UUID, BLERead | BLEWrite | BLENotify, 4);
BLEUnsignedCharCharacteristic statusChar(STATUS_UUID, BLERead | BLEWrite);

// Bluetooth® Low Energy Battery Level Characteristic
BLEUnsignedCharCharacteristic batteryLevelChar("2a19",  // standard 16-bit characteristic UUID
    BLERead | BLENotify); // remote clients will be able to get notifications if this characteristic changes

/************* Function prototypes *****************/
void IRAM_ATTR accelWokeUp();

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  // if (FORMAT_FFAT)
  // FFat.format();
  if (!FFat.begin(true)) {
    Serial.println("FFat Mount Failed");
    return;
  } else {
    Serial.println("FFat Mounted");
    // There seems to be a bug on the FS code
    // By creating this null file, I can open other files for
    // appending. Otherwise, the system crashes and reboots.
    createFile(FFat, "/null", true);
  }
  if (FFat.exists(filename) == false) {
    createFile(FFat, filename, true);
  }
  Wire.begin(SDA, SCL);
  configAccelerometer();
  startRTC();
  if (!configureBLE()) {
    Serial.println("starting BLE failed!");
    while (1)
      ;
  }
  Serial.println("Ready");
}

void loop() {
  static File file;
  if (getTimestamp) {
    // Get the current timestamp
    getTimestamp = false;
    ts = rtc.now().unixtime();
  }
  if (inter) {
    detachInterrupt(ACCEL_INTERRUPT_PIN); // noInterrupts();
    if (shouldRecord) {
      if (newDataAvailable) {
        b = (uint8_t *)&storageBuffer[bufferReadHead++];
        file.write(b, 4);
      }
      sampleData();
    } else {
      sampleData();
      if (accelHead == 0 && detectFreqInRange()) {
        shouldRecord = true;
        file = FFat.open(filename, FILE_APPEND);
        // Store timestamp
        b = (uint8_t *)&ts;
        file.write(b, 4);
      } else {
        ts = rtc.now().unixtime();
        shouldRecord = false;
        file.close();
      }
    }
    if (digitalRead(ACCEL_INTERRUPT_PIN) == HIGH) {
      inter = false;
      if (shouldRecord) {
        dumpRAM(file);
      }
      bufferReadHead = 0;
      shouldRecord = false;
      accelHead = 0;
      bufferWriteHead = 0;
      // The following line is the substitute of interrupts();
      attachInterrupt(ACCEL_INTERRUPT_PIN, accelWokeUp, FALLING);
    }
  }
}

void IRAM_ATTR accelWokeUp() {
  getTimestamp = true;
  inter = true;
}

void sampleData(void) {
  if (accel.availableX()) {
    float accelX = accel.getCalculatedX();
    vReal[accelHead] = accelX;
    storageBuffer[bufferWriteHead % samples] = accelX;
    vImag[accelHead] = 0;
    accelHead++;
    bufferWriteHead++;
    newDataAvailable = true;
  } else {
    newDataAvailable = false;
    delay(1);
  }
}

bool detectFreqInRange() {
  FFT.Windowing(vReal, samples, FFT_WIN_TYP_HAMMING, FFT_FORWARD); // Weigh data
  FFT.Compute(vReal, vImag, samples, FFT_FORWARD); // Compute FFT
  FFT.ComplexToMagnitude(vReal, vImag, samples);   // Compute magnitudes
  double freq = FFT.MajorPeak(vReal, samples, samplingFrequency);
  return (freq > 3.9);
}

void dumpRAM(File file) {
  uint8_t i = 0;
  do {
    b = (uint8_t *)&storageBuffer[(bufferReadHead + i) % samples];
    file.write(b, 4);
    if (i % 10 == 0) {
      file.close();
      file = FFat.open(filename, FILE_APPEND);
    }
    i++;
  } while (i < 255);
  // Add separator
  file.write(separator, 8);
  file.close();
}

void configAccelerometer() {
  if (accel.begin(Wire) == false) {
    Serial.println(
        "Not Connected. Please check connections and read the hookup guide.");
    while (1)
      ;
  }
  accel.setScale(SCALE_8G);
  accel.setDataRate(ODR_100);
  accel.startMotionDetection();
  attachInterrupt(ACCEL_INTERRUPT_PIN, accelWokeUp, FALLING);
}

void startRTC() {
  if (!rtc.begin(&Wire)) {
    Serial.println("Couldn't find RTC");
    Serial.flush();
    while (1) {
      delay(10);
    }
  }
}
