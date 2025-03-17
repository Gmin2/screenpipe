import { http, HttpResponse } from 'msw'

type GeminiGenerateContentRequest = {
  contents: Array<{
    role?: string
    parts: Array<{
      text?: string
      inlineData?: {
        mimeType: string
        data: string
      }
    }>
  }>
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
  }
}

export const geminiHandlers = [
  // Generate content handler
  http.post('https://generativelanguage.googleapis.com/v1beta/models/*/generateContent*', async ({ request }) => {
    const url = new URL(request.url)
    const apiKey = url.searchParams.get('key')
    
    if (apiKey !== 'test-gemini-key' && apiKey !== null) {
      return new HttpResponse('Invalid API key', { status: 401 })
    }
    
    return HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Hello from Gemini!'
              }
            ],
            role: 'model'
          },
          finishReason: 'STOP',
          safetyRatings: []
        }
      ]
    })
  }),
  
  // Models handler
  http.get('https://generativelanguage.googleapis.com/v1beta/models*', ({ request }) => {
    const url = new URL(request.url)
    const apiKey = url.searchParams.get('key')
    
    if (apiKey !== 'test-gemini-key' && apiKey !== null) {
      return new HttpResponse('Invalid API key', { status: 401 })
    }
    
    return HttpResponse.json({
      models: [
        {
          name: 'models/gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro',
          supportedGenerationMethods: ['generateContent']
        },
        {
          name: 'models/gemini-1.5-flash',
          displayName: 'Gemini 1.5 Flash',
          supportedGenerationMethods: ['generateContent']
        }
      ]
    })
  })
]