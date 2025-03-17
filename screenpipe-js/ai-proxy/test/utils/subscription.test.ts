import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateSubscription, subscriptionCache } from '../../src/utils/subscription'
import { Env } from '../../src/types'
import { server } from '../mocks/node'
import { http, HttpResponse } from 'msw'

describe('Subscription Utils', () => {
  const env = {
    SUPABASE_URL: 'https://test-supabase-url.com',
    SUPABASE_ANON_KEY: 'test-anon-key'
  } as Env

  beforeEach(() => {
    // Clear subscription cache before each test
    vi.resetAllMocks()
    
    // Reset cache
    // @ts-ignore - accessing private property for testing
    for (const key of subscriptionCache.cache.keys()) {
      // @ts-ignore - accessing private property for testing
      subscriptionCache.cache.delete(key)
    }
  })

  it('should validate valid UUID subscription', async () => {
    server.use(
      http.post('https://test-supabase-url.com/rest/v1/rpc/has_active_cloud_subscription', () => {
        return HttpResponse.json(true)
      })
    )

    const isValid = await validateSubscription(env, '12345678-1234-1234-1234-123456789012')
    expect(isValid).toBe(true)
  })

  it('should reject invalid UUID subscription', async () => {
    server.use(
      http.post('https://test-supabase-url.com/rest/v1/rpc/has_active_cloud_subscription', () => {
        return HttpResponse.json(false)
      })
    )

    const isValid = await validateSubscription(env, '12345678-1234-1234-1234-000000000000')
    expect(isValid).toBe(false)
  })

  it('should reject non-UUID tokens', async () => {
    const isValid = await validateSubscription(env, 'not-a-uuid')
    expect(isValid).toBe(false)
  })

  it('should cache valid subscriptions', async () => {
    let apiCallCount = 0
    
    server.use(
      http.post('https://test-supabase-url.com/rest/v1/rpc/has_active_cloud_subscription', () => {
        apiCallCount++
        return HttpResponse.json(true)
      })
    )

    // First call should hit the API
    const isValid1 = await validateSubscription(env, '12345678-1234-1234-1234-123456789012')
    expect(isValid1).toBe(true)
    expect(apiCallCount).toBe(1)

    // Second call should use cache and not hit API
    const isValid2 = await validateSubscription(env, '12345678-1234-1234-1234-123456789012')
    expect(isValid2).toBe(true)
    expect(apiCallCount).toBe(1) // Still 1, not 2
  })

  it('should handle API errors', async () => {
    server.use(
      http.post('https://test-supabase-url.com/rest/v1/rpc/has_active_cloud_subscription', () => {
        return new HttpResponse('Internal server error', { status: 500 })
      })
    )

    const isValid = await validateSubscription(env, '12345678-1234-1234-1234-123456789012')
    expect(isValid).toBe(false)
  })
})