import { setupServer } from 'msw/node'
import { openaiHandlers } from './openai'
import { anthropicHandlers } from './anthropic'
import { geminiHandlers } from './gemini'
import { deepgramHandlers } from './deepgram'
import { clerkHandlers } from './clerk'
import { supabaseHandlers } from './supabase'

export const server = setupServer(
  ...openaiHandlers,
  ...anthropicHandlers,
  ...geminiHandlers,
  ...deepgramHandlers,
  ...clerkHandlers,
  ...supabaseHandlers
)