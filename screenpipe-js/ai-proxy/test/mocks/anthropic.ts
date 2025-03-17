import { http, HttpResponse } from 'msw'

type AnthropicMessagesRequest = {
  model: string
  messages: Array<{
    role: string
    content: string | Array<any>
  }>
  stream?: boolean
  max_tokens?: number
  temperature?: number
}

export const anthropicHandlers = [
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const requestBody = await request.json() as AnthropicMessagesRequest
    const isStreaming = requestBody.stream === true
    
    if (isStreaming) {
      // For streaming responses, return text/event-stream
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          // Send a few chunks for testing
          controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n'))
          controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" from Claude"}}\n\n'))
          controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'))
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
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello from Claude!'
        }
      ],
      model: requestBody.model || 'claude-3-5-sonnet',
      stop_reason: 'end_turn'
    })
  }),
  
  http.get('https://api.anthropic.com/v1/models', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'claude-3-5-sonnet-20240620',
          name: 'claude-3-5-sonnet',
          display_name: 'Claude 3.5 Sonnet',
          max_tokens: 200000
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'claude-3-haiku',
          display_name: 'Claude 3 Haiku',
          max_tokens: 200000
        }
      ]
    })
  })
]