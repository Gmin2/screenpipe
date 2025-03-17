import { http, HttpResponse } from 'msw'

type ChatCompletionRequest = {
  model: string
  messages: Array<{
    role: string
    content: string | Array<any>
  }>
  stream?: boolean
  temperature?: number
}

export const openaiHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const requestBody = await request.json() as ChatCompletionRequest
    const isStreaming = requestBody.stream === true
    
    if (isStreaming) {
      // For streaming responses, return text/event-stream
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          // Send few chunks for testing
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      })
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
        }
      })
    }
    
    // For regular completion responses
    return HttpResponse.json({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677858242,
      model: requestBody.model || 'gpt-4',
      usage: { prompt_tokens: 13, completion_tokens: 7, total_tokens: 20 },
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop',
          index: 0
        }
      ]
    })
  }),
  
  http.get('https://api.openai.com/v1/models', () => {
    return HttpResponse.json({
      object: 'list',
      data: [
        {
          id: 'gpt-4',
          object: 'model',
          created: Date.now() / 1000,
          owned_by: 'openai'
        },
        {
          id: 'gpt-4o',
          object: 'model',
          created: Date.now() / 1000,
          owned_by: 'openai'
        }
      ]
    })
  })
]