// AudioWorklet processor for capturing raw PCM audio
// Runs in a separate audio thread for low-latency capture
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 1600 // 100ms at 16kHz
    this.buffer = new Int16Array(this.bufferSize)
    this.bufferIndex = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const channelData = input[0]
    if (!channelData) return true

    for (let i = 0; i < channelData.length; i++) {
      // Convert Float32 [-1, 1] to Int16
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      this.buffer[this.bufferIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff

      if (this.bufferIndex >= this.bufferSize) {
        // Send the buffer to the main thread
        this.port.postMessage(
          { type: 'audio_data', data: new Int16Array(this.buffer) },
          [this.buffer.buffer],
        )
        // Create a new buffer
        this.buffer = new Int16Array(this.bufferSize)
        this.bufferIndex = 0
      }
    }

    return true // Keep the processor alive
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor)
