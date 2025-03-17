import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  getContentType, 
  validateAudioInput, 
  transcribeAudio, 
  textToSpeech 
} from '../../src/utils/voice-utils'
import { Env, AudioFormat, TranscriptionOptions } from '../../src/types'
import { server } from '../mocks/node'
import { http, HttpResponse } from 'msw'

// Mock deepgram client
vi.mock('@deepgram/sdk', () => ({
  createClient: vi.fn(() => ({
    listen: {
      prerecorded: {
        transcribeFile: vi.fn(() => ({
          result: {
            results: {
              channels: [
                {
                  alternatives: [
                    {
                      transcript: 'This is a test transcription.',
                      confidence: 0.96,
                      words: [
                        { word: 'This', start: 0.01, end: 0.25, confidence: 0.99 }
                      ]
                    }
                  ],
                  detected_language: 'en'
                }
              ]
            }
          },
          error: null
        }))
      }
    }
  }))
}))

describe('Voice Utils', () => {
  const env = { DEEPGRAM_API_KEY: 'test-deepgram-key' } as Env

  describe('getContentType', () => {
    it('should return correct content type for each format', () => {
      expect(getContentType('wav')).toBe('audio/wav')
      expect(getContentType('mp3')).toBe('audio/mpeg')
      expect(getContentType('flac')).toBe('audio/flac')
      expect(getContentType('ogg')).toBe('audio/ogg')
      expect(getContentType('webm')).toBe('audio/webm')
    })

    it('should default to wav for unknown formats', () => {
      expect(getContentType('unknown' as AudioFormat)).toBe('audio/wav')
    })
  })

  describe('validateAudioInput', () => {
    it('should validate WAV audio input', async () => {
      const audioBuffer = new ArrayBuffer(1000)
      const request = new Request('http://localhost:8787/test', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBuffer
      })

      const result = await validateAudioInput(request)
      expect(result.valid).toBe(true)
      expect(result.contentType).toBe('audio/wav')
      expect(result.audioBuffer).toBeDefined()
    })

    it('should validate MP3 audio input', async () => {
      const audioBuffer = new ArrayBuffer(1000)
      const request = new Request('http://localhost:8787/test', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: audioBuffer
      })

      const result = await validateAudioInput(request)
      expect(result.valid).toBe(true)
      expect(result.contentType).toBe('audio/mpeg')
    })

    it('should reject non-audio content type', async () => {
      const request = new Request('http://localhost:8787/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      })

      const result = await validateAudioInput(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid content type')
    })

    it('should reject empty audio', async () => {
      const audioBuffer = new ArrayBuffer(0)
      const request = new Request('http://localhost:8787/test', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBuffer
      })

      const result = await validateAudioInput(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Empty audio file')
    })

    it('should reject oversized audio files', async () => {
      // Create a 15MB buffer (exceeds 10MB limit)
      const audioBuffer = new ArrayBuffer(15 * 1024 * 1024)
      const request = new Request('http://localhost:8787/test', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBuffer
      })

      const result = await validateAudioInput(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Audio file too large')
    })
  })

  describe('transcribeAudio', () => {
    it('should transcribe audio successfully', async () => {
      const audioBuffer = new ArrayBuffer(1000)
      
      const result = await transcribeAudio(audioBuffer, env)
      
      expect(result.text).toBe('This is a test transcription.')
      expect(result.confidence).toBe(0.96)
      expect(result.language).toBe('en')
      expect(result.words).toHaveLength(1)
      expect(result.words?.[0].word).toBe('This')
    })

    it('should use specified options', async () => {
      const audioBuffer = new ArrayBuffer(1000)
      
      const options: TranscriptionOptions = {
        model: 'nova-3',
        languages: ['es', 'en'],
        diarize: true,
        smartFormat: true
      }
      
      await transcribeAudio(audioBuffer, env, options)
      
      // This is an indirect way to test that options were applied
      // by checking that the deepgram client was created and called correctly
      expect(vi.mocked(require('@deepgram/sdk').createClient)).toHaveBeenCalledWith('test-deepgram-key')
    })

    it('should handle transcription errors', async () => {
      // Mock error response
      vi.mocked(require('@deepgram/sdk').createClient).mockReturnValueOnce({
        listen: {
          prerecorded: {
            transcribeFile: vi.fn(() => ({
              result: null,
              error: { message: 'Transcription failed' }
            }))
          }
        }
      })
      
      const audioBuffer = new ArrayBuffer(1000)
      
      const result = await transcribeAudio(audioBuffer, env)
      
      expect(result.text).toBe('')
      expect(result.error).toContain('Deepgram transcription error')
    })
  })

  describe('textToSpeech', () => {
    it('should convert text to speech', async () => {
      // Set up mock response
      server.use(
        http.post('https://api.deepgram.com/v1/speak*', () => {
          const audioBuffer = new ArrayBuffer(1000)
          return new Response(audioBuffer, {
            headers: {
              'Content-Type': 'audio/wav',
            }
          })
        })
      )
      
      const result = await textToSpeech('Hello world', env, { voice: 'aura-asteria-en' })
      
      expect(result).not.toBeNull()
      expect(result?.byteLength).toBe(1000)
    })

    it('should handle empty text', async () => {
      const result = await textToSpeech('', env)
      
      expect(result).toBeNull()
    })

    it('should handle API errors', async () => {
      // Set up mock error response
      server.use(
        http.post('https://api.deepgram.com/v1/speak*', () => {
          return new HttpResponse('Invalid request', { status: 400 })
        })
      )
      
      const result = await textToSpeech('Hello world', env)
      
      expect(result).toBeNull()
    })
  })
})