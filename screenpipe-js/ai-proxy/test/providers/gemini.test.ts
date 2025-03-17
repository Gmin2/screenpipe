import { describe, it, expect, beforeEach } from 'vitest'
import { GeminiProvider } from '../../src/providers/gemini'
import { server } from '../mocks/node'
import { http, HttpResponse } from 'msw'
import { Message } from '../../src/types'

describe('GeminiProvider', () => {
  const provider = new GeminiProvider('test-gemini-key')

  it('should format messages correctly', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ]

    const formatted = provider.formatMessages(messages)

    expect(formatted[0].role).toBe('user') 
    expect(formatted[0].parts[0].text).toBe('You are a helpful assistant.')
    expect(formatted[1].role).toBe('user')
    expect(formatted[1].parts[0].text).toBe('Hello!')
  })

  it('should format image messages correctly', () => {
    const messages: Message[] = [
      { 
        role: 'user', 
        content: [
          { type: 'text', text: 'What\'s in this image?' },
          { type: 'image', image: { url: 'data:image/jpeg;base64,abc123' } }
        ]
      }
    ]

    const formatted = provider.formatMessages(messages)
    
    expect(formatted[0].role).toBe('user')
    expect(formatted[0].parts[0].text).toBe('What\'s in this image?')
    expect(formatted[0].parts[1].inlineData).toBeDefined()
    expect(formatted[0].parts[1].inlineData.data).toBe('data:image/jpeg;base64,abc123')
  })

  it('should create completions', async () => {
    const response = await provider.createCompletion({
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: false
    })

    interface TestResponse {
      choices: Array<{
        message: {
          content: string;
          role: string;
        }
      }>
    }

    const data = await response.json() as TestResponse
    expect(data.choices[0].message.content).toBe('Hello from Gemini!')
  })

  it('should create streaming completions', async () => {
    const stream = await provider.createStreamingCompletion({
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: true
    })

    const reader = stream.getReader()
    const { value, done } = await reader.read()
    const textContent = new TextDecoder().decode(value)
    
    expect(textContent).toContain('data: {"choices":[{"delta":{"content":"')
  })

  it('should list models', async () => {
    const models = await provider.listModels()
    
    expect(models.length).toBeGreaterThan(0)
    expect(models[0].provider).toBe('google')
  })

  it('should map roles correctly', () => {
    const mapRole = (provider as any).mapRole.bind(provider)
    
    expect(mapRole('user')).toBe('user')
    expect(mapRole('assistant')).toBe('model')
    expect(mapRole('system')).toBe('user')
    expect(mapRole('tool')).toBe('user')
  })

  it('should format response correctly', () => {
    const geminiResponse = {
      text: () => 'Hello from Gemini!'
    }
    
    const formatted = provider.formatResponse(geminiResponse as any)
    
    expect(formatted.choices[0].message.content).toBe('Hello from Gemini!')
    expect(formatted.choices[0].message.role).toBe('assistant')
  })

  it('should handle JSON response format', async () => {
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/*/generateContent*', () => {
        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"result": "success", "data": {"key": "value"}}'
                  }
                ],
                role: 'model'
              }
            }
          ]
        })
      })
    )

    const response = await provider.createCompletion({
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'Return JSON' }],
      stream: false,
      response_format: { type: 'json_object' }
    })

    interface TestResponse {
      choices: Array<{
        message: {
          content: string;
          role: string;
        }
      }>
    }

    const data = await response.json() as TestResponse
    expect(data.choices[0].message.content).toContain('result')
    expect(data.choices[0].message.content).toContain('success')
  })

  it('should handle errors gracefully', async () => {
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/*/generateContent*', () => {
        return new HttpResponse('Rate limit exceeded', { status: 429 })
      })
    )

    await expect(provider.createCompletion({
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: false
    })).rejects.toThrow()
  })
})