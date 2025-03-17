import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RateLimiter, checkRateLimit } from '../../src/utils/rate-limiter'
import { Env } from '../../src/types'

describe('Rate Limiter', () => {
  describe('RateLimiter class', () => {
    let rateLimiter: RateLimiter
    let state: any

    beforeEach(() => {
      state = {
        storage: new Map(),
        blockConcurrencyWhile: vi.fn((callback) => callback())
      }
      rateLimiter = new RateLimiter(state as any)
    })

    it('should track requests by IP', async () => {
      // First request from IP
      const request1 = new Request('http://localhost:8787/v1/chat/completions')
      request1.headers.set('cf-connecting-ip', '192.168.1.1')
      
      const response1 = await rateLimiter.fetch(request1)
      const data1 = await response1.json() as { allowed: boolean, remaining: number, reset_in: number }
      
      expect(data1.allowed).toBe(true)
      expect(data1.remaining).toBeGreaterThan(0)
      
      // Different IP should have full quota
      const request3 = new Request('http://localhost:8787/v1/chat/completions')
      request3.headers.set('cf-connecting-ip', '192.168.1.2')
      
      const response3 = await rateLimiter.fetch(request3)
      const data3 = await response3.json() as { allowed: boolean, remaining: number, reset_in: number }
      
      expect(data3.allowed).toBe(true)
      expect(data3.remaining).toBeGreaterThan(0)
    })

    it('should apply different limits to different endpoints', async () => {
      const chatRequest = new Request('http://localhost:8787/v1/chat/completions')
      chatRequest.headers.set('cf-connecting-ip', '192.168.1.1')
      
      const ttsRequest = new Request('http://localhost:8787/v1/text-to-speech')
      ttsRequest.headers.set('cf-connecting-ip', '192.168.1.1')
      
      await rateLimiter.fetch(chatRequest)
      await rateLimiter.fetch(ttsRequest)
      
      // Each endpoint has its own limit
      const chatResponse = await rateLimiter.fetch(chatRequest)
      const ttsResponse = await rateLimiter.fetch(ttsRequest)
      
      const chatData = await chatResponse.json() as { allowed: boolean }
      const ttsData = await ttsResponse.json() as { allowed: boolean }
      
      // Both should still be allowed
      expect(chatData.allowed).toBe(true)
      expect(ttsData.allowed).toBe(true)
    })
  })

  describe('checkRateLimit', () => {
    const mockRateLimiterResponse = (allowed: boolean) => {
      return {
        fetch: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ 
          allowed, 
          remaining: allowed ? 10 : 0, 
          reset_in: 60 
        }))))
      }
    }

    const env = {
      RATE_LIMITER: {
        idFromName: vi.fn((name: string) => ({ name })),
        get: vi.fn((id: any) => mockRateLimiterResponse(true))
      }
    } as unknown as Env

    it('should allow requests under limit', async () => {
      const request = new Request('http://localhost:8787/v1/chat/completions')
      request.headers.set('cf-connecting-ip', '192.168.1.1')
      
      const result = await checkRateLimit(request, env)
      
      expect(result.allowed).toBe(true)
      expect(result.response).toBeUndefined()
    })

    it('should block requests over limit', async () => {
      // Override behavior for this test
      (env.RATE_LIMITER.get as any).mockReturnValueOnce(mockRateLimiterResponse(false))
      
      const request = new Request('http://localhost:8787/v1/chat/completions')
      request.headers.set('cf-connecting-ip', '192.168.1.1')
      
      const result = await checkRateLimit(request, env)
      
      expect(result.allowed).toBe(false)
      expect(result.response).toBeDefined()
      expect(result.response?.status).toBe(429)
      
      if (result.response) {
        const data = await result.response.json() as { error: string }
        expect(data.error).toBe('rate limit exceeded')
      }
    })
  })
})