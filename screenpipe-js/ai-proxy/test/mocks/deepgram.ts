import { http, HttpResponse } from 'msw'

type DeepgramSpeakRequest = {
  text: string
}

export const deepgramHandlers = [
  // Transcription endpoint
  http.post('https://api.deepgram.com/v1/listen*', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Token ')) {
      return new HttpResponse('Unauthorized', { status: 401 })
    }
    
    const apiKey = authHeader.replace('Token ', '')
    if (apiKey !== 'test-deepgram-key') {
      return new HttpResponse('Invalid API key', { status: 401 })
    }
    
    const url = new URL(request.url)
    const model = url.searchParams.get('model') || 'nova-3'
    const smartFormat = url.searchParams.get('smart_format') === 'true'
    
    return HttpResponse.json({
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: 'This is a test transcription.',
                confidence: 0.98,
                words: [
                  { word: 'This', start: 0.01, end: 0.25, confidence: 0.99 },
                  { word: 'is', start: 0.26, end: 0.38, confidence: 0.99 },
                  { word: 'a', start: 0.39, end: 0.45, confidence: 0.99 },
                  { word: 'test', start: 0.46, end: 0.75, confidence: 0.98 },
                  { word: 'transcription', start: 0.76, end: 1.5, confidence: 0.97 }
                ]
              }
            ],
            detected_language: 'en'
          }
        ]
      }
    })
  }),
  
  // Text-to-speech endpoint
  http.post('https://api.deepgram.com/v1/speak*', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Token ')) {
      return new HttpResponse('Unauthorized', { status: 401 })
    }
    
    const apiKey = authHeader.replace('Token ', '')
    if (apiKey !== 'test-deepgram-key') {
      return new HttpResponse('Invalid API key', { status: 401 })
    }
    
    const url = new URL(request.url)
    const model = url.searchParams.get('model') || 'aura-asteria-en'
    
    const requestBody = await request.json() as DeepgramSpeakRequest
    if (!requestBody.text) {
      return new HttpResponse('Missing text parameter', { status: 400 })
    }
    
    // mock audio buffer
    const audioBuffer = new ArrayBuffer(1000)
    const view = new Uint8Array(audioBuffer)
    // Filling buffer with sample data
    for (let i = 0; i < 1000; i++) {
      view[i] = i % 256
    }
    
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
      }
    })
  })
]