#ifndef WAV_WRITER_H
#define WAV_WRITER_H

#include <Arduino.h>

// Open a new WAV file for writing. Returns true on success.
// Filename auto-generated: /RG/recordings/RG_XXXXXXXX.wav (millis timestamp)
bool wavWriterOpen();

// Write a buffer of 16-bit mono samples to the open WAV file.
// Call this repeatedly with audio data. Handles double-buffering internally.
void wavWriterWriteSamples(const int16_t* samples, int count);

// Finalize the WAV header (update data size) and close the file.
void wavWriterClose();

// Returns true if a file is currently open for writing.
bool wavWriterIsRecording();

#endif // WAV_WRITER_H
