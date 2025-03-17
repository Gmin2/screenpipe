import { http, HttpResponse } from 'msw'

type ClerkVerifyTokenRequest = {
  token: string
  secretKey?: string
}

export const clerkHandlers = [
  // Mock Clerk token verification
  http.post('https://api.clerk.com/v1/tokens/verify', async ({ request }) => {
    const requestBody = await request.json() as ClerkVerifyTokenRequest
    
    if (requestBody.token === 'valid-clerk-token') {
      return HttpResponse.json({
        sub: 'user_123',
        status: 'verified'
      })
    }
    
    return new HttpResponse('Invalid token', { status: 401 })
  })
]