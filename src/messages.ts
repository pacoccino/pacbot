import {Chat} from './chat'
import {Bot, UserMessage} from './bot'

export type MessageHandlerFunction = (
  userMessage: UserMessage,
  bot: Bot
) => Promise<void>
export class MessageHandler {
  chat: Chat
  constructor(chat: Chat) {
    this.chat = chat
  }

  async handle(userMessage: UserMessage, bot: Bot) {
    switch (userMessage.commandName) {
      case 'start':
        const text =
          'Hello, This bot gives you AI-powered answers using ChatGPT. \nAvailable commands are:\n\n/newchat - Start a new chat'
        await bot.telegramBot.sendMessage(userMessage.chatId, text, {
          reply_to_message_id: userMessage.msgId,
        })
        break
      case '':
      case 'chat':
        if (userMessage.commandArg === '') {
          const text = 'Empty or not supported type of message.'
          await bot.telegramBot.sendMessage(userMessage.chatId, text, {
            reply_to_message_id: userMessage.msgId,
          })
        } else {
          await this.chat.chat(userMessage)
        }
        break
      case 'reset':
        await this.chat.reset(userMessage)
        break

      case 'info':
        await this.chat.info(userMessage)
        break

      case 'system':
        await this.chat.setSystem(userMessage)
        break

      case 'dump':
        await this.chat.dump(userMessage)
        break

      case 'model':
        await this.chat.setModel(userMessage)
        break

      default:
        await bot.telegramBot.sendMessage(
          userMessage.chatId,
          'Unknown command.',
          {
            reply_to_message_id: userMessage.msgId,
          }
        )
    }
  }
}
