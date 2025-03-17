import { describe, it, expect, vi } from 'vitest'
import { validateAuth, verifyClerkToken } from '../../src/utils/auth'
import { Env } from '../../src/types'


vi.mock('../../src/utils/subscription', () => ({
  validateSubscription: vi.fn(async (env: Env, token: string) => {
    if (token === '12345678-1234-1234-1234-123456789012') {
      return true
    }
    return false
  })
}))

// Mock clerk
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string, options: any) => {
    if (token === 'valid-clerk-token') {
      return { sub: 'user_123' }
    }
    throw new Error('Invalid token')
  })
}))

describe('Auth Utils', () => {
  const env = { CLERK_SECRET_KEY: 'test-key' } as Env

  describe('verifyClerkToken', () => {
    it('should verify valid clerk token', async () => {
      const result = await verifyClerkToken(env, 'valid-clerk-token')
      expect(result).toBe(true)
    })

    it('should reject invalid clerk token', async () => {
      const result = await verifyClerkToken(env, 'invalid-token')
      expect(result).toBe(false)
    })
  })

  describe('validateAuth', () => {
    it('should reject requests without auth header', async () => {
      const request = new Request('http://localhost:8787/v1/chat/completions')
      const result = await validateAuth(request, env)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('unauthorized')
    })

    it('should accept requests with valid subscription token', async () => {
      const request = new Request('http://localhost:8787/v1/chat/completions', {
        headers: {
          'Authorization': 'Bearer 12345678-1234-1234-1234-123456789012'
        }
      })
      
      const result = await validateAuth(request, env)
      expect(result.isValid).toBe(true)
    })

    it('should accept requests with valid clerk token', async () => {
      const request = new Request('http://localhost:8787/v1/chat/completions', {
        headers: {
          'Authorization': 'Bearer valid-clerk-token'
        }
      })
      
      const result = await validateAuth(request, env)
      expect(result.isValid).toBe(true)
    })

    it('should reject requests with invalid token', async () => {
      const request = new Request('http://localhost:8787/v1/chat/completions', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })
      
      const result = await validateAuth(request, env)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('invalid subscription')
    })
  })
})