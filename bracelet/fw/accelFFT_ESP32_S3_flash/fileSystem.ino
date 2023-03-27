void createFile(fs::FS &fs, const char *path, bool force) {
  // Serial.printf("Creating file: %s\r\n", path);
  if (!fs.exists(path) || force) {
    File file = fs.open(path, FILE_WRITE);
    file.close();
  }
}

void readFile(fs::FS &fs, const char *path) {
  // Serial.printf("Reading file: %s\r\n", path);

  File file = fs.open(path);
  if (!file || file.isDirectory()) {
    Serial.println("- failed to open file for reading");
    return;
  }

  Serial.println("- read from file:");
  while (file.available()) {
    // Serial.print(file.read(), HEX);
    Serial.write(file.read());
  }
  file.close();
}

void listDir(fs::FS &fs, const char *dirname, uint8_t levels) {
  Serial.printf("Listing directory: %s\r\n", dirname);

  File root = fs.open(dirname);
  if (!root) {
    Serial.println("- failed to open directory");
    return;
  }
  if (!root.isDirectory()) {
    Serial.println(" - not a directory");
    return;
  }

  File file = root.openNextFile();
  while (file) {
    if (file.isDirectory()) {
      Serial.print("  DIR : ");
      Serial.println(file.name());
      if (levels) {
        listDir(fs, file.path(), levels - 1);
      }
    } else {
      Serial.print("  FILE: ");
      Serial.print(file.name());
      Serial.print("\tSIZE: ");
      Serial.println(file.size());
    }
    file = root.openNextFile();
  }
}

File openFile(const char *path) {
  Serial.println("File open");
  File f = FFat.open(path);
  if (!f.size()) {
    Serial.println("File is empty");
    closeFile(f);
  }
  return f;
}

void closeFile(File file) {
  Serial.println("File closed");
  if (file) {
    file.close();
  }
}

bool readFileValue(File file, uint8_t *buffer) {
  if (file.available()) {
    file.read(buffer, 4);
    return true;
  }
  return false;
}

void truncateFile(const char *file) {
  createFile(FFat, file, true);
  Serial.println("File truncated");
}
