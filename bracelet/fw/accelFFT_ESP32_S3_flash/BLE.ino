enum status_t { idle = 0x00, send_data = 0x01, update_rtc = 0x02 } status;

bool configureBLE() {
  if (!BLE.begin()) {
    return false;
  }
  BLE.setLocalName("PDBracelet");
  BLE.setAdvertisedService(braceletService); // add the service UUID
  braceletService.addCharacteristic(rawDataChar);
  braceletService.addCharacteristic(timestampChar);
  braceletService.addCharacteristic(statusChar);
  BLE.addService(braceletService); // Add the battery service
  rawDataChar.writeValue(0);       // set initial value for this characteristic
  timestampChar.writeValue(0);
  statusChar.writeValue(status);

  //BLE.setAdvertisedService(batteryService); // add the service UUID
  batteryService.addCharacteristic(batteryLevelChar); // add the battery level characteristic
  BLE.addService(batteryService); // Add the battery service
  batteryLevelChar.writeValue(oldBatteryLevel); // set initial value for this characteristic

  // start advertising
  BLE.advertise();
  Serial.println("Bluetooth® device active, waiting for connections...");
  updateBatteryLevel();
  xTaskCreatePinnedToCore(loopBLE, "loopBLE", 10000, NULL, 1, &TaskBLE, 0);
  return true;
}

void loopBLE(void *pvParameters) {
  Serial.print("taskBLE running on core ");
  Serial.println(xPortGetCoreID());
  static long previousMillis =
      0; // last time the battery level was checked, in ms
  for (;;) {
    BLEDevice central = BLE.central();
    File file;
    if (central) {
      file = openFile(filename);
      Serial.print("Connected to central: ");
      // print the central's BT address:
      Serial.println(central.address());

      // while the central is connected:
      while (central.connected()) {
        if (statusChar.written()) {
          switch (statusChar.value()) {
          case 0x01:
            status = send_data;
            break;
          case 0x02:
            status = update_rtc;
            break;
          case 0x03:
            timestampChar.writeValue(rtc.now().unixtime());
            statusChar.writeValue(idle);
          default:
            status = idle;
          }
        }
        if ((rawDataChar.subscribed()) && (timestampChar.subscribed()) &&
            (status == send_data)) {
          long currentMillis = millis();
          // if 5ms have passed, read and transmit a new value:
          if (currentMillis - previousMillis >= 5) {
            previousMillis = currentMillis;
            updateReadValue(file);
          } else {
            // This delay avoids a wdt overflow
            delay(1);
          }
        } else if (status == update_rtc) {
          if (timestampChar.written()) {
            byte rd[4];
            timestampChar.readValue(rd, 4);
            // Signed little endian
            long newTs = 0;
            for (uint8_t i = 0; i < 4; i++) {
              newTs *= 256;
              newTs += rd[i];
            };
            Serial.println(newTs);
            rtc.adjust(newTs);
          } else {
            status = idle;
            statusChar.writeValue(status);
            timestampChar.writeValue(0);
          }
        } else {
          // This delay avoids a wdt overflow
          delay(5);
        }

        // if 5m have passed, check the battery level:
        if (millis() - previousMillisBattery >= 300000) {
          previousMillisBattery = millis();
          updateBatteryLevel();
        }
      }
      // when the central disconnects, turn off the LED:
      // digitalWrite(35, HIGH);
      closeFile(file);
      status = idle;
      statusChar.writeValue(status);
      Serial.print("Disconnected from central: ");
      Serial.println(central.address());
    }
    // This delay avoids a wdt overflow
    delay(1);
  }
}

void updateReadValue(File file) {
  uint8_t val[4];
  if (readFileValue(file, val)) {
    if (thisValueIsZero && lastValueIsZero) {
      timestampChar.writeValue(val, 4);
      thisValueIsZero = false;
    } else {
      rawDataChar.writeValue(val, 4);
      lastValueIsZero = thisValueIsZero;
      if ((val[0] == 0) && (val[1] == 0) && (val[2] == 0) && (val[3] == 0)) {
        thisValueIsZero = true;
      } else {
        thisValueIsZero = false;
      }
    }
  } else if (file) {
    // Sending an additional zeroed timestamp after the file
    // finished reading so the last timestamp values get
    // registered on the app memory
    val[0] = 0;
    val[1] = 0;
    val[2] = 0;
    val[3] = 0;
    timestampChar.writeValue(val, 4);
    thisValueIsZero = true;
    lastValueIsZero = thisValueIsZero;
    closeFile(file);
    status = idle;
    statusChar.writeValue(status);
    truncateFile(filename); // truncate the file content
  }
}


void updateBatteryLevel() {
  /* 
     This is used here to simulate the charge level of a battery.
  */
  // int battery = analogRead(A0);
  // int batteryLevel = map(battery, 0, 1023, 0, 100);
  int batteryLevel = 90;

  if (batteryLevel != oldBatteryLevel) {      // if the battery level has changed
    batteryLevelChar.writeValue(batteryLevel);  // update the battery level characteristic
    oldBatteryLevel = batteryLevel;           // save the level for next comparison
  }
}
