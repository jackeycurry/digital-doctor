/**
 * Convert a WAV Blob to PCM Int16 ArrayBuffer.
 * Strips the 44-byte WAV header and returns raw PCM data.
 */
export async function wavBlobToPCM(blob: Blob): Promise<ArrayBuffer> {
  const arrayBuffer = await blob.arrayBuffer()

  // If it has a WAV header, strip it
  if (arrayBuffer.byteLength > 44) {
    const view = new DataView(arrayBuffer)
    const riff = String.fromCharCode(
      view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3),
    )
    if (riff === 'RIFF') {
      return arrayBuffer.slice(44)
    }
  }
  return arrayBuffer
}

/**
 * Convert AudioBuffer to 16kHz mono PCM WAV Blob.
 */
export function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1
  const sampleRate = 16000
  const bitsPerSample = 16
  const data = audioBuffer.getChannelData(0)
  const dataLength = data.length * 2

  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true)
  view.setUint16(32, numChannels * bitsPerSample / 8, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Write PCM data
  let offset = 44
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
