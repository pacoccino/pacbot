import * as dotenv from 'dotenv'
dotenv.config()

const authorized_chat_ids: number[] = [274824045]

const config = {
  authorized_chat_ids,
  temperature: 0.5,
  max_tokens: 1024,
  defaultSystemMessage: 'You are a helpful assistant.',
  model: 'gpt-3.5-turbo',

  telegramToken: process.env.TELEGRAM_TOKEN,
  openAIToken: process.env.OPENAI_API_KEY,
}

export default config
