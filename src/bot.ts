import TelegramBot, {Message} from 'node-telegram-bot-api'

import config from './config'
import {MessageHandlerFunction} from './messages'
import {Readable} from 'stream'
import {ReadStream} from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import {openai} from './libs'
import { v4 as uuidv4 } from 'uuid';

export interface UserMessage {
  msgId: number
  chatId: number
  commandName: string
  commandArg: string
  transcribed: boolean
}

export class Bot {
  telegramBot: TelegramBot
  constructor() {
    this.telegramBot = new TelegramBot(config.telegramToken, {
      polling: true,
    })
  }

  async init(handle: MessageHandlerFunction) {
    /*
        this.telegramBot.on('start', async (??) => {
            const userMessage: UserMessage = {
                msgId: msg.id
                chatId: msg.chat.id
                text: msg.text
            }
            await commands['start'].handle(userMessage)
        });
        */

    this.telegramBot.on('message', async (msg: Message) => {
      console.log('bot msg', msg)

      const userMessage = await this.parseMessage(msg)

      await this.telegramBot.sendChatAction(userMessage.chatId, 'typing')

      if (!this.chatAuthorized(userMessage.chatId)) {
        await this.telegramBot.sendMessage(userMessage.chatId, 'GTFO', {
          reply_to_message_id: userMessage.msgId,
        })
        return
      }

      /*
            const thinkMsg = await bot.sendMessage(chatId, '🤔', {
                reply_to_message_id: msg.message_id
            })
            const thinkMsgId = thinkMsg.message_id;
            */

      try {
        await handle(userMessage, this)
      } catch (e) {
        console.error(e)

        try {
          await this.telegramBot.sendMessage(userMessage.chatId, 'error', {
            reply_to_message_id: userMessage.msgId,
          })
        } catch (ee) {
          console.error(ee)
        }
      }
    })
  }

  chatAuthorized(chatId: number) {
    return config.authorized_chat_ids.indexOf(chatId) !== -1
  }

  async parseMessage(message: Message): Promise<UserMessage> {
    const userMessage: UserMessage = {
      msgId: message.message_id,
      chatId: message.chat.id,
      commandName: '',
      commandArg: message.text || '',
      transcribed: false,
    }

    if (message.voice) {
      const voiceStream = this.telegramBot.getFileStream(message.voice.file_id)
      userMessage.commandArg = await Bot.transcriptAudio(voiceStream)
      userMessage.transcribed = true
    }

    const splittedMessage = userMessage.commandArg.split(' ')
    const firstWord = splittedMessage[0]

    if (firstWord.startsWith('/')) {
      userMessage.commandName = firstWord.split('@')[0].replace('/', '')
      userMessage.commandArg = splittedMessage.slice(1).join(' ')
    }

    return userMessage
  }

  static async transcriptAudio(voiceStream: Readable): Promise<string> {
    const outputFile = `./data/voices/${uuidv4()}.mp3`
    const file = await new Promise<ReadStream>((res, rej) => {
      ffmpeg(voiceStream)
        .toFormat('mp3')
        .on('end', function () {
          res(fs.createReadStream(outputFile))
        })
        .on('error', function (err) {
          rej(err)
        })
        .save(outputFile)
    })

    const res = await openai.createTranscription(
      file as any as File,
      'whisper-1'
    )
    await fs.promises.rm(outputFile)

    return res.data.text
  }
}
