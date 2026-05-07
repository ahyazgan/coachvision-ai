import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

export type ClaudeModel = 'claude-sonnet-4-5' | 'claude-opus-4-5' | 'claude-haiku-4-5'

interface AskClaudeArgs {
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  model?: ClaudeModel
  maxTokens?: number
}

export async function askClaude({
  systemPrompt,
  messages,
  model = 'claude-sonnet-4-5',
  maxTokens = 1024,
}: AskClaudeArgs) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')

  return { text, usage: response.usage }
}
