import { describe, it, expect } from 'vitest'
import { AnthropicProvider } from '../../src/providers/anthropic'
import { server } from '../mocks/node'
import { http, HttpResponse } from 'msw'
import { Message } from '../../src/types'
import type { Message as AnthropicMessage, ContentBlock } from '@anthropic-ai/sdk/resources'

describe('AnthropicProvider', () => {
  const provider = new AnthropicProvider('test-anthropic-key')

  it('should format messages correctly', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi there!' }
    ]

    const formatted = provider.formatMessages(messages)

    expect(formatted[0].role).toBe('user')
    const userContent = formatted[0].content as any
    expect(userContent[0].type).toBe('text')
    expect(userContent[0].text).toBe('Hello!')
    
    expect(formatted[1].role).toBe('assistant')
    const assistantContent = formatted[1].content as any
    expect(assistantContent[0].type).toBe('text')
    expect(assistantContent[0].text).toBe('Hi there!')
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
    const content = formatted[0].content as any
    expect(content[0].type).toBe('text')
    expect(content[1].type).toBe('image')
    expect(content[1].source.type).toBe('base64')
  })

  it('should create completions', async () => {
    const response = await provider.createCompletion({
      model: 'claude-3-5-sonnet',
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
    expect(data.choices[0].message.content).toBe('Hello from Claude!')
  })

  it('should create streaming completions', async () => {
    const stream = await provider.createStreamingCompletion({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: true
    })

    const reader = stream.getReader()
    const { value, done } = await reader.read()
    const textContent = new TextDecoder().decode(value)
    
    expect(textContent).toContain('data: {"choices":[{"delta":{"content":"Hello"}}]}')
  })

  it('should list models', async () => {
    const models = await provider.listModels()
    
    expect(models.length).toBeGreaterThan(0)
    expect(models[0].provider).toBe('anthropic')
  })

  it('should format tools correctly', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            },
            required: ['location']
          }
        }
      }
    ]

    const formatted = (provider as any).formatTools(tools)
    
    expect(formatted[0].name).toBe('get_weather')
    expect(formatted[0].description).toBe('Get the weather for a location')
    expect(formatted[0].input_schema.type).toBe('object')
  })

  it('should format response correctly', () => {
    const anthroResponse = {
      id: 'msg_123',
      content: [
        {
          type: 'text',
          text: 'Test response'
        }
      ]
    } as AnthropicMessage
    
    const formatted = provider.formatResponse(anthroResponse)
    
    expect(formatted.choices[0].message.content).toBe('Test response')
    expect(formatted.choices[0].message.role).toBe('assistant')
  })

  it('should handle errors gracefully', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return new HttpResponse('Rate limit exceeded', { status: 429 })
      })
    )

    await expect(provider.createCompletion({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: false
    })).rejects.toThrow()
  })
})