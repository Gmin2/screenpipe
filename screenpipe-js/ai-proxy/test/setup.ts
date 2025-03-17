// test/setup.ts
import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { server } from './mocks/node'

// Start/stop MSW server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Since @cloudflare/workers-types already provides these definitions,
// we don't need to redeclare them

// Mock WebSocket implementation
class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  send = vi.fn()
  close = vi.fn()
  accept = vi.fn()
  readyState = 1
}

// Assign mocks to existing global declarations
(global as any).WebSocket = MockWebSocket;

// Create a WebSocketPair mock that returns our mock objects
(global as any).WebSocketPair = function() {
  const client = new MockWebSocket()
  const server = new MockWebSocket()
  return { 0: client, 1: server }
};

// Override crypto with our testing version
vi.spyOn(crypto, 'randomUUID').mockImplementation(() => '00000000-0000-0000-0000-000000000000');

// Set environment variables for tests
(global as any).ENV = {
  OPENAI_API_KEY: 'test-openai-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  GEMINI_API_KEY: 'test-gemini-key',
  DEEPGRAM_API_KEY: 'test-deepgram-key',
  LANGFUSE_PUBLIC_KEY: 'test-langfuse-public-key',
  LANGFUSE_SECRET_KEY: 'test-langfuse-secret-key',
  CLERK_SECRET_KEY: 'test-clerk-key',
  SUPABASE_URL: 'https://test-supabase-url.com',
  SUPABASE_ANON_KEY: 'test-supabase-key',
  NODE_ENV: 'test',
  RATE_LIMITER: {
    idFromName: vi.fn((name: string) => ({ name })),
    get: vi.fn(() => ({
      fetch: vi.fn(async () => new Response(JSON.stringify({ allowed: true, remaining: 10, reset_in: 60 })))
    }))
  }
};