import { http, HttpResponse } from 'msw'

type SupabaseSubscriptionCheckRequest = {
  input_user_id: string
}

export const supabaseHandlers = [
  http.post('https://test-supabase-url.com/rest/v1/rpc/has_active_cloud_subscription', async ({ request }) => {
    const apiKey = request.headers.get('apikey')
    if (apiKey !== 'test-supabase-key') {
      return new HttpResponse('Unauthorized', { status: 401 })
    }
    
    const requestBody = await request.json() as SupabaseSubscriptionCheckRequest
    
    // Valid mock UUID for testing
    if (requestBody.input_user_id === '12345678-1234-1234-1234-123456789012') {
      return HttpResponse.json(true)
    }
    
    return HttpResponse.json(false)
  })
]