import { describe, it, expect } from 'vitest'
import { OpenAIProvider } from '../../src/providers/openai'
import { server } from '../mocks/node'
import { http, HttpResponse } from 'msw'
import { Message, OpenAIResponse } from '../../src/types'

describe('OpenAIProvider', () => {
  const provider = new OpenAIProvider('test-openai-key')

  it('should format messages correctly', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ]

    const formatted = provider.formatMessages(messages)

    expect(formatted[0].role).toBe('system')
    expect(formatted[0].content).toBe('You are a helpful assistant.')
    expect(formatted[1].role).toBe('user')
    expect(formatted[1].content).toBe('Hello!')
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
    if (Array.isArray(formatted[0].content)) {
      expect(formatted[0].content[0].type).toBe('text')
      expect(formatted[0].content[1].type).toBe('image_url')
    }
  })

  it('should create completions', async () => {
    const response = await provider.createCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: false
    })

    const data = await response.json() as OpenAIResponse
    expect(data.choices[0].message.content).toBe('Hello! How can I help you today?')
  })

  it('should create streaming completions', async () => {
    const stream = await provider.createStreamingCompletion({
      model: 'gpt-4',
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
    
    expect(models).toHaveLength(2)
    expect(models[0].id).toBe('gpt-4')
    expect(models[0].provider).toBe('openai')
  })

  it('should handle JSON response format', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          choices: [
            {
              message: {
                content: '{"result": "success", "data": {"key": "value"}}',
                role: 'assistant'
              }
            }
          ]
        })
      })
    )

    const response = await provider.createCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Return JSON' }],
      stream: false,
      response_format: { type: 'json_object' }
    })

    const data = await response.json() as OpenAIResponse
    expect(data.choices[0].message.content).toContain('result')
    expect(data.choices[0].message.content).toContain('success')
  })

  it('should handle tools correctly', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          choices: [
            {
              message: {
                content: null,
                role: 'assistant',
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{"location":"San Francisco"}'
                    }
                  }
                ]
              }
            }
          ]
        })
      })
    )

    const response = await provider.createCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'What\'s the weather in San Francisco?' }],
      stream: false,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather in a location',
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
    })

    interface ToolCallResponse extends OpenAIResponse {
      choices: Array<{
        message: {
          content: string;
          role: string;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: {
              name: string;
              arguments: string;
            }
          }>;
        };
      }>;
    }

    const data = await response.json() as ToolCallResponse
    expect(data.choices[0].message.tool_calls).toBeDefined()
    expect(data.choices[0].message.tool_calls?.[0].function.name).toBe('get_weather')
  })

  it('should handle errors gracefully', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return new HttpResponse('Rate limit exceeded', { status: 429 })
      })
    )

    await expect(provider.createCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: false
    })).rejects.toThrow()
  })
})