#include "wav_writer.h"
#include "config.h"
#include <SD.h>

// ============================================
// WAV Header (44 bytes, PCM 16-bit mono 16kHz)
// ============================================
// Offsets that need patching on close:
//   4: RIFF chunk size  = file size - 8
//  40: data chunk size  = total audio bytes written
static const int WAV_HEADER_SIZE = 44;

// ============================================
// Double-buffer configuration
// ============================================
// Each buffer holds one audio window (1600 samples = 3200 bytes at 16kHz/100ms).
// Buffer A fills from caller while Buffer B flushes to SD card.
static const int BUFFER_SAMPLES = AUDIO_SAMPLES_PER_WINDOW;  // 1600
static const int BUFFER_BYTES   = BUFFER_SAMPLES * sizeof(int16_t);  // 3200

static int16_t bufferA[BUFFER_SAMPLES];
static int16_t bufferB[BUFFER_SAMPLES];

static int16_t* fillBuffer  = bufferA;   // buffer currently being filled
static int16_t* flushBuffer = bufferB;   // buffer ready to flush to SD
static int fillPos = 0;                  // sample index in fillBuffer

// ============================================
// File state
// ============================================
static File wavFile;
static bool recording = false;
static uint32_t totalDataBytes = 0;  // audio bytes written (for header patch)

// ============================================
// Internal helpers
// ============================================

// Write a 44-byte placeholder WAV header (data size = 0).
// We patch the real sizes on close.
static void writeWavHeader() {
  uint8_t header[WAV_HEADER_SIZE];
  memset(header, 0, WAV_HEADER_SIZE);

  uint32_t sampleRate = AUDIO_SAMPLE_RATE;  // 16000
  uint16_t numChannels = 1;
  uint16_t bitsPerSample = 16;
  uint32_t byteRate = sampleRate * numChannels * (bitsPerSample / 8);  // 32000
  uint16_t blockAlign = numChannels * (bitsPerSample / 8);             // 2

  // RIFF header
  header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
  // Bytes 4-7: file size - 8 (placeholder 0, patched on close)

  header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';

  // fmt subchunk
  header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
  header[16] = 16;  // PCM format chunk size (little-endian)
  header[20] = 1;   // PCM format tag

  // Number of channels
  header[22] = numChannels & 0xFF;
  header[23] = (numChannels >> 8) & 0xFF;

  // Sample rate
  header[24] = sampleRate & 0xFF;
  header[25] = (sampleRate >> 8) & 0xFF;
  header[26] = (sampleRate >> 16) & 0xFF;
  header[27] = (sampleRate >> 24) & 0xFF;

  // Byte rate
  header[28] = byteRate & 0xFF;
  header[29] = (byteRate >> 8) & 0xFF;
  header[30] = (byteRate >> 16) & 0xFF;
  header[31] = (byteRate >> 24) & 0xFF;

  // Block align
  header[32] = blockAlign & 0xFF;
  header[33] = (blockAlign >> 8) & 0xFF;

  // Bits per sample
  header[34] = bitsPerSample & 0xFF;
  header[35] = (bitsPerSample >> 8) & 0xFF;

  // data subchunk
  header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
  // Bytes 40-43: data size (placeholder 0, patched on close)

  wavFile.write(header, WAV_HEADER_SIZE);
}

// Patch the WAV header with actual file/data sizes.
static void patchWavHeader() {
  // Data chunk size at offset 40
  wavFile.seek(40);
  uint8_t sizeBytes[4];
  sizeBytes[0] = totalDataBytes & 0xFF;
  sizeBytes[1] = (totalDataBytes >> 8) & 0xFF;
  sizeBytes[2] = (totalDataBytes >> 16) & 0xFF;
  sizeBytes[3] = (totalDataBytes >> 24) & 0xFF;
  wavFile.write(sizeBytes, 4);

  // RIFF chunk size at offset 4 = file size - 8 = (header + data) - 8
  uint32_t riffSize = WAV_HEADER_SIZE + totalDataBytes - 8;
  wavFile.seek(4);
  sizeBytes[0] = riffSize & 0xFF;
  sizeBytes[1] = (riffSize >> 8) & 0xFF;
  sizeBytes[2] = (riffSize >> 16) & 0xFF;
  sizeBytes[3] = (riffSize >> 24) & 0xFF;
  wavFile.write(sizeBytes, 4);
}

// Swap fill/flush buffers and write the full flush buffer to SD.
static void swapAndFlush() {
  // Swap pointers
  int16_t* temp = fillBuffer;
  fillBuffer = flushBuffer;
  flushBuffer = temp;

  int samplesToFlush = fillPos;
  fillPos = 0;

  if (samplesToFlush > 0 && wavFile) {
    size_t bytes = samplesToFlush * sizeof(int16_t);
    wavFile.write((const uint8_t*)flushBuffer, bytes);
    totalDataBytes += bytes;
  }
}

// ============================================
// Public API
// ============================================

bool wavWriterOpen() {
  if (recording) {
    Serial.println("[WAV] Already recording — close first");
    return false;
  }

  // Generate filename: /RG/recordings/RG_XXXXXXXX.wav (millis zero-padded to 10 digits)
  char filename[48];
  unsigned long ms = millis();
  snprintf(filename, sizeof(filename), "/RG/recordings/RG_%010lu.wav", ms);

  wavFile = SD.open(filename, FILE_WRITE);
  if (!wavFile) {
    Serial.print("[WAV] ERROR: Failed to create ");
    Serial.println(filename);
    return false;
  }

  // Reset state
  fillBuffer = bufferA;
  flushBuffer = bufferB;
  fillPos = 0;
  totalDataBytes = 0;

  writeWavHeader();

  recording = true;
  Serial.print("[WAV] Recording to ");
  Serial.println(filename);
  return true;
}

void wavWriterWriteSamples(const int16_t* samples, int count) {
  if (!recording || !wavFile) return;

  int offset = 0;
  while (offset < count) {
    // How many samples can we still fit in the fill buffer?
    int space = BUFFER_SAMPLES - fillPos;
    int toCopy = min(count - offset, space);

    memcpy(&fillBuffer[fillPos], &samples[offset], toCopy * sizeof(int16_t));
    fillPos += toCopy;
    offset += toCopy;

    // If fill buffer is full, swap and flush
    if (fillPos >= BUFFER_SAMPLES) {
      swapAndFlush();
    }
  }
}

void wavWriterClose() {
  if (!recording || !wavFile) return;

  // Flush any remaining samples in the fill buffer
  if (fillPos > 0) {
    size_t bytes = fillPos * sizeof(int16_t);
    wavFile.write((const uint8_t*)fillBuffer, bytes);
    totalDataBytes += bytes;
    fillPos = 0;
  }

  // Patch the WAV header with actual sizes
  patchWavHeader();

  wavFile.close();
  recording = false;

  Serial.print("[WAV] Closed — ");
  Serial.print(totalDataBytes);
  Serial.println(" bytes of audio data");
}

bool wavWriterIsRecording() {
  return recording;
}
