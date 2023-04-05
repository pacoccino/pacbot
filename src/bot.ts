import TelegramBot from 'node-telegram-bot-api';

import config from './config';
import {MessageHandlerFunction} from './messages';
export interface UserMessage {
  msgId: number;
  chatId: number;
  text: string | undefined;
  parsedMessage: {
    hasCommand: boolean;
    commandName: string;
    arg: string;
  };
}

export class Bot {
  telegramBot: TelegramBot;
  constructor() {
    this.telegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN || '', {
      polling: true,
    });
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

    this.telegramBot.on('message', async (msg) => {
      console.log('bot msg', msg);
      const userMessage: UserMessage = {
        msgId: msg.message_id,
        chatId: msg.chat.id,
        text: msg.text,
        parsedMessage: Bot.parseMessage(msg.text),
      };

      await this.telegramBot.sendChatAction(userMessage.chatId, 'typing');

      if (!this.chatAuthorized(userMessage.chatId)) {
        await this.telegramBot.sendMessage(userMessage.chatId, 'GTFO', {
          reply_to_message_id: userMessage.msgId,
        });
        return;
      }

      /*
            const thinkMsg = await bot.sendMessage(chatId, '🤔', {
                reply_to_message_id: msg.message_id
            })
            const thinkMsgId = thinkMsg.message_id;
            */

      try {
        await handle(userMessage, this);
      } catch (e) {
        console.error(e);

        try {
          await this.telegramBot.sendMessage(userMessage.chatId, 'error', {
            reply_to_message_id: userMessage.msgId,
          });
        } catch (ee) {
          console.error(ee);
        }
      }
    });
  }

  chatAuthorized(chatId: number) {
    return config.authorized_chat_ids.indexOf(chatId) !== -1;
  }

  static parseMessage(message: string | undefined) {
    const parsedMessage = {
      hasCommand: false,
      commandName: '',
      arg: '',
    };
    if (!message) return parsedMessage;

    const splittedMessage = message.split(' ');
    const firstWord = splittedMessage[0];

    if (firstWord.startsWith('/')) {
      parsedMessage.hasCommand = true;
      parsedMessage.commandName = firstWord.split('@')[0].replace('/', '');
      parsedMessage.arg = splittedMessage.slice(1).join(' ');
    }
    return parsedMessage;
  }
}
