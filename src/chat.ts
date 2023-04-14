import {OpenAIApi, ChatCompletionRequestMessageRoleEnum} from 'openai'
import JSONdb from 'simple-json-db'

import {Bot, UserMessage} from './bot'
import config from './config'
import TelegramBot from 'node-telegram-bot-api'
import {openai} from './libs'

const AVAILABLE_MODELS = ['gpt-4', 'gpt-3.5-turbo']

interface ChatDbModel {
  total_tokens: number
  systemMessage: string
  model: string
  temperature: number
  max_tokens: number
  history: Array<{
    role: ChatCompletionRequestMessageRoleEnum
    content: string
  }>
}

export class Chat {
  bot: Bot
  tbot: TelegramBot
  db: JSONdb
  openai: OpenAIApi

  constructor(bot: Bot) {
    this.bot = bot
    this.tbot = this.bot.telegramBot

    this.db = new JSONdb('./data/storage.json') // todo

    this.openai = openai
  }

  protected async getChat(chatId: number): Promise<ChatDbModel> {
    return this.db.has(`${chatId}`)
      ? this.db.get(`${chatId}`)
      : {
          total_tokens: 0,
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          systemMessage: config.defaultSystemMessage,
          history: [],
        }
  }

  protected async updateChat(chatId: number, val: ChatDbModel): Promise<void> {
    this.db.set(`${chatId}`, val)
  }

  protected getSystemMessage(systemMessage: string): string {
    if (systemMessage === '') systemMessage = config.defaultSystemMessage

    systemMessage += ` Current date and time is ${new Date().toString()}`

    return systemMessage
  }

  async chat(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId)

    let questionMessage = userMessage.commandArg

    let newHistory: ChatDbModel['history'] = [
      ...chat.history,
      {
        role: ChatCompletionRequestMessageRoleEnum.User,
        content: questionMessage,
      },
    ]

    const completionRequest = {
      model: chat.model,
      temperature: chat.temperature,
      max_tokens: chat.max_tokens,
      messages: [
        {
          role: ChatCompletionRequestMessageRoleEnum.System,
          content: this.getSystemMessage(chat.systemMessage),
        },
        ...newHistory,
      ],
    }

    const {data} = await this.openai.createChatCompletion(completionRequest)
    // TODO handle finish_reason
    console.log('openai data', data)

    const chatResponse = data.choices[0].message
    newHistory.push(chatResponse)

    await this.updateChat(userMessage.chatId, {
      ...chat,
      total_tokens: data.usage.total_tokens,
      history: newHistory,
    })

    let messageContent = ''
    if (userMessage.transcribed) {
      messageContent += `🗣️ ${questionMessage}`
      messageContent += `\n\n`
    }
    messageContent += `🤖 ${chatResponse.content}`

    await this.tbot.sendMessage(userMessage.chatId, messageContent, {
      reply_to_message_id: userMessage.msgId,
      //parse_mode: 'Markdown',
    })
    /*
            await this.tbot.editMessageText(response.choices[0].message.content, {
                chat_id: chatId,
                message_id: answerMsgId,
                parse_mode: 'Markdown'
            })
            */
  }

  async info(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId)

    let response = `
            Informations

            Configuration

            - Temperature: ${chat.temperature}
            - Max tokens: ${chat.max_tokens}
            - Model: ${chat.model}

            Chat stats

            - History length: ${chat.history.length}
            - Total tokens: ${chat.total_tokens}
            - System Message: ${this.getSystemMessage(chat.systemMessage)}
            `

    await this.tbot.sendMessage(userMessage.chatId, response, {
      reply_to_message_id: userMessage.msgId,
      //parse_mode: 'MarkdownV2',
    })
  }
  async dump(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId)

    const buffer = Buffer.from(JSON.stringify(chat))

    await this.tbot.sendDocument(
      userMessage.chatId,
      buffer,
      {
        reply_to_message_id: userMessage.msgId,
      },
      {
        contentType: 'application/json',
        filename: 'conversation.json',
      }
    )
  }

  async reset(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId)
    await this.updateChat(userMessage.chatId, {
      ...chat,
      history: [],
    })

    await this.tbot.sendMessage(
      userMessage.chatId,
      'Conversation have been reset.',
      {
        reply_to_message_id: userMessage.msgId,
      }
    )
  }

  async setSystem(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId)

    await this.updateChat(userMessage.chatId, {
      ...chat,
      systemMessage: userMessage.commandArg,
    })

    const res =
      userMessage.commandArg === ''
        ? 'System message have been reset to default.'
        : 'System message have been changed.'

    await this.tbot.sendMessage(
      userMessage.chatId,
      `${res}\nPlease reset conversation if you want to make it effective.`,
      {
        reply_to_message_id: userMessage.msgId,
      }
    )
  }
  async setModel(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId)

    const availables = `Available: [ ${AVAILABLE_MODELS.join(', ')} ]`
    const newModel = userMessage.commandArg

    if(newModel === '') {
      await this.tbot.sendMessage(
        userMessage.chatId,
        `Current model in use is ${chat.model}.\nUse this command with a model name to change.\n${availables}`,
        {
          reply_to_message_id: userMessage.msgId,
        }
      )
      return
    }

    if (AVAILABLE_MODELS.indexOf(newModel) === -1) {
      await this.tbot.sendMessage(
        userMessage.chatId,
        `Unknown model.\n${availables}`,
        {
          reply_to_message_id: userMessage.msgId,
        }
      )
      return
    }

    await this.updateChat(userMessage.chatId, {
      ...chat,
      model: newModel,
    })

    await this.tbot.sendMessage(
      userMessage.chatId,
      `Updated model to ${newModel}`,
      {
        reply_to_message_id: userMessage.msgId,
      }
    )
  }
}
