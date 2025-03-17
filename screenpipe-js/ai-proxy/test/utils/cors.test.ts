import { describe, it, expect } from 'vitest'
import { 
  addCorsHeaders, 
  handleOptions, 
  createSuccessResponse, 
  createErrorResponse 
} from '../../src/utils/cors'

describe('CORS Utils', () => {
  describe('addCorsHeaders', () => {
    it('should add CORS headers to a response', () => {
      const response = new Response('test')
      const corsResponse = addCorsHeaders(response)
      
      expect(corsResponse.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(corsResponse.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, POST, OPTIONS')
      expect(corsResponse.headers.get('Access-Control-Allow-Headers')).toBe('*')
      expect(corsResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true')
      expect(corsResponse.headers.get('Access-Control-Max-Age')).toBe('86400')
      expect(corsResponse.headers.get('Vary')).toBe('Origin')
    })
  })

  describe('handleOptions', () => {
    it('should handle CORS preflight requests', () => {
      const request = new Request('http://localhost:8787/v1/chat/completions', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      })
      
      const response = handleOptions(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    })

    it('should handle simple OPTIONS requests', () => {
      const request = new Request('http://localhost:8787/v1/chat/completions', {
        method: 'OPTIONS'
      })
      
      const response = handleOptions(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Allow')).toBe('GET, HEAD, POST, OPTIONS')
    })
  })

  describe('createSuccessResponse', () => {
    it('should create response with string body', async () => {
      const response = createSuccessResponse('Success message')
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/plain')
      const text = await response.text()
      expect(text).toBe('Success message')
    })

    it('should create response with JSON body', async () => {
      const response = createSuccessResponse({ success: true, data: 'test' })
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data).toBe('test')
    })

    it('should accept custom status code', () => {
      const response = createSuccessResponse('Created', 201)
      
      expect(response.status).toBe(201)
    })
  })

  describe('createErrorResponse', () => {
    it('should create error response', async () => {
      const response = createErrorResponse(400, 'Bad request')
      
      expect(response.status).toBe(400)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      
      const data = await response.json() as any
      expect(data.error).toBe('Bad request')
    })
  })
})