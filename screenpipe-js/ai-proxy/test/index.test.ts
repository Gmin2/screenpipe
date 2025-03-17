import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Env } from '../src/types'
import originalHandler from '../src/index'

type SentryWrappedHandler = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
}

const handler = originalHandler as unknown as SentryWrappedHandler

vi.mock('../src/handlers/chat', () => ({
  handleChatCompletions: vi.fn(() => new Response(JSON.stringify({ success: true, type: 'chat' })))
}))

vi.mock('../src/handlers/models', () => ({
  handleModelListing: vi.fn(() => new Response(JSON.stringify({ success: true, type: 'models' })))
}))

vi.mock('../src/handlers/transcription', () => ({
  handleFileTranscription: vi.fn(() => new Response(JSON.stringify({ success: true, type: 'transcription' }))),
  handleWebSocketUpgrade: vi.fn(() => new Response(null, { 
    status: 101,
    webSocket: { client: {}, server: {} } as any
  }))
}))

vi.mock('../src/handlers/voice', () => ({
  handleVoiceTranscription: vi.fn(() => new Response(JSON.stringify({ success: true, type: 'voice-transcription' }))),
  handleVoiceQuery: vi.fn(() => new Response(JSON.stringify({ success: true, type: 'voice-query' }))),
  handleTextToSpeech: vi.fn(() => new Response(new ArrayBuffer(100), { headers: { 'Content-Type': 'audio/wav' } })),
  handleVoiceChat: vi.fn(() => new Response(new ArrayBuffer(100), { headers: { 'Content-Type': 'audio/wav' } }))
}))

vi.mock('../src/utils/auth', () => ({
  validateAuth: vi.fn(() => ({ isValid: true }))
}))

vi.mock('../src/utils/rate-limiter', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true }))
}))

vi.mock('../src/services/analytics', () => ({
  setupAnalytics: vi.fn(() => ({
    trace: vi.fn(() => ({
      update: vi.fn()
    })),
    shutdownAsync: vi.fn(async () => {})
  }))
}))


vi.mock('@sentry/cloudflare', () => {
  return {
    withSentry: (config: any, handlerObj: any) => {
      return handlerObj;
    }
  };
});

describe('Main Worker Handler', () => {
  const env = {
    OPENAI_API_KEY: 'test-key',
    ANTHROPIC_API_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key',
    DEEPGRAM_API_KEY: 'test-key',
    LANGFUSE_PUBLIC_KEY: 'test-key',
    LANGFUSE_SECRET_KEY: 'test-key',
    CLERK_SECRET_KEY: 'test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-key',
    NODE_ENV: 'test',
    RATE_LIMITER: {
      idFromName: vi.fn(name => ({ name })),
      get: vi.fn(() => ({
        fetch: vi.fn(async () => new Response(JSON.stringify({ allowed: true, remaining: 10, reset_in: 60 })))
      }))
    }
  } as unknown as Env;
  
  const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext

  it('should handle OPTIONS requests with CORS', async () => {
    const request = new Request('http://localhost:8787/v1/chat/completions', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
  it('should handle test endpoint without auth', async () => {
    const request = new Request('http://localhost:8787/test', {
      method: 'GET'
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ai proxy is working!')
  })

  it('should handle chat completions endpoint', async () => {
    const request = new Request('http://localhost:8787/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    const data = await response.json() as { success: boolean, type: string }
    expect(data.success).toBe(true)
    expect(data.type).toBe('chat')
  })

  it('should handle models endpoint', async () => {
    const request = new Request('http://localhost:8787/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer token'
      }
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    const data = await response.json() as { success: boolean, type: string }
    expect(data.success).toBe(true)
    expect(data.type).toBe('models')
  })

  it('should handle transcription endpoint', async () => {
    const request = new Request('http://localhost:8787/v1/listen', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'Authorization': 'Bearer token'
      },
      body: new ArrayBuffer(100)
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    const data = await response.json() as { success: boolean, type: string }
    expect(data.success).toBe(true)
    expect(data.type).toBe('transcription')
  })

  it('should handle WebSocket upgrade for live transcription', async () => {
    const request = new Request('http://localhost:8787/v1/listen', {
      method: 'GET',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      }
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(101)
  })

  it('should handle voice transcription endpoint', async () => {
    const request = new Request('http://localhost:8787/v1/voice/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'Authorization': 'Bearer token'
      },
      body: new ArrayBuffer(100)
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    const data = await response.json() as { success: boolean, type: string }
    expect(data.success).toBe(true)
    expect(data.type).toBe('voice-transcription')
  })

  it('should handle voice query endpoint', async () => {
    const request = new Request('http://localhost:8787/v1/voice/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'Authorization': 'Bearer token'
      },
      body: new ArrayBuffer(100)
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    const data = await response.json() as { success: boolean, type: string }
    expect(data.success).toBe(true)
    expect(data.type).toBe('voice-query')
  })

  it('should handle text-to-speech endpoint', async () => {
    const request = new Request('http://localhost:8787/v1/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      },
      body: JSON.stringify({
        text: 'Hello world',
        voice: 'aura-asteria-en'
      })
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/wav')
  })

  it('should handle voice chat endpoint', async () => {
    const request = new Request('http://localhost:8787/v1/voice/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        'Authorization': 'Bearer token'
      },
      body: new ArrayBuffer(100)
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/wav')
  })

  it('should handle authentication failures', async () => {
    vi.mocked(require('../src/utils/auth').validateAuth).mockReturnValueOnce({ isValid: false, error: 'unauthorized' })
    
    const request = new Request('http://localhost:8787/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      },
      body: JSON.stringify({})
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(401)
    const data = await response.json() as { error: string }
    expect(data.error).toBe('unauthorized')
  })

  it('should handle rate limiting', async () => {
    vi.mocked(require('../src/utils/rate-limiter').checkRateLimit).mockReturnValueOnce({ 
      allowed: false, 
      response: new Response(JSON.stringify({ error: 'rate limit exceeded' }), { status: 429 }) 
    })
    
    const request = new Request('http://localhost:8787/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      },
      body: JSON.stringify({})
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(429)
    const data = await response.json() as { error: string }
    expect(data.error).toBe('rate limit exceeded')
  })

  it('should return 404 for unknown routes', async () => {
    const request = new Request('http://localhost:8787/unknown-endpoint', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer token'
      }
    })
    
    const response = await handler.fetch(request, env, ctx)
    
    expect(response.status).toBe(404)
    const data = await response.json() as { error: string }
    expect(data.error).toBe('not found')
  })
    
})