import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';
import JSONdb from 'simple-json-db';

import {Bot, UserMessage} from './bot';
import config from './config';
import TelegramBot from 'node-telegram-bot-api';

const AVAILABLE_MODELS = ['gpt-4', 'gpt-3.5-turbo'];

interface ChatDbModel {
  total_tokens: number;
  systemMessage: string;
  model: string;
  temperature: number;
  max_tokens: number;
  history: Array<{
    role: ChatCompletionRequestMessageRoleEnum;
    content: string;
  }>;
}

export class Chat {
  bot: Bot;
  tbot: TelegramBot;
  db: JSONdb;
  openai: OpenAIApi;

  constructor(bot: Bot) {
    this.bot = bot;
    this.tbot = this.bot.telegramBot;

    this.db = new JSONdb('./storage.json'); // todo

    this.openai = new OpenAIApi(
      new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
      })
    );
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
        };
  }

  protected async updateChat(chatId: number, val: ChatDbModel): Promise<void> {
    this.db.set(`${chatId}`, val);
  }

  protected getSystemMessage(systemMessage: string): string {
    if (systemMessage === '') systemMessage = config.defaultSystemMessage;

    systemMessage += ` Current date and time is ${new Date().toString()}`;

    return systemMessage;
  }

  async chat(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId);

    let message = userMessage.parsedMessage.hasCommand
      ? userMessage.parsedMessage.arg
      : userMessage.text;

    let newHistory: ChatDbModel['history'] = [
      ...chat.history,
      {role: ChatCompletionRequestMessageRoleEnum.User, content: message},
    ];

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
    };

    const {data} = await this.openai.createChatCompletion(completionRequest);
    // TODO handle finish_reason
    console.log('openai data', data);

    const cc = data.choices[0];
    newHistory.push(cc.message);

    await this.updateChat(userMessage.chatId, {
      ...chat,
      total_tokens: data.usage.total_tokens,
      history: newHistory,
    });

    await this.tbot.sendMessage(userMessage.chatId, cc.message.content, {
      reply_to_message_id: userMessage.msgId,
      //parse_mode: 'Markdown',
    });
    /*
            await this.tbot.editMessageText(response.choices[0].message.content, {
                chat_id: chatId,
                message_id: answerMsgId,
                parse_mode: 'Markdown'
            })
            */
  }

  async info(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId);

    let response = `
            Informations

            Configuration

            - Temperature: ${chat.temperature}
            - Max tokens: ${chat.max_tokens}

            Chat stats

            - History length: ${chat.history.length}
            - Total tokens: ${chat.total_tokens}
            - System Message: ${this.getSystemMessage(chat.systemMessage)}
            `;

    await this.tbot.sendMessage(userMessage.chatId, response, {
      reply_to_message_id: userMessage.msgId,
      //parse_mode: 'MarkdownV2',
    });
  }
  async dump(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId);

    const buffer = Buffer.from(JSON.stringify(chat));

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
    );
  }

  async reset(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId);
    await this.updateChat(userMessage.chatId, {
      ...chat,
      history: [],
    });

    await this.tbot.sendMessage(
      userMessage.chatId,
      'Conversation have been reset.',
      {
        reply_to_message_id: userMessage.msgId,
      }
    );
  }

  async setSystem(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId);

    await this.updateChat(userMessage.chatId, {
      ...chat,
      systemMessage: userMessage.parsedMessage.arg,
    });

    const res =
      userMessage.parsedMessage.arg === ''
        ? 'System message have been reset to default.'
        : 'System message have been changed.';

    await this.tbot.sendMessage(
      userMessage.chatId,
      `${res}\nPlease reset conversation to make it effective.`,
      {
        reply_to_message_id: userMessage.msgId,
      }
    );
  }
  async setModel(userMessage: UserMessage) {
    const chat = await this.getChat(userMessage.chatId);

    const newModel = userMessage.parsedMessage.arg;

    if (AVAILABLE_MODELS.indexOf(newModel) === -1) {
      await this.tbot.sendMessage(
        userMessage.chatId,
        `Unknown model.\nAvailable: [ ${AVAILABLE_MODELS.join(', ')} ]`,
        {
          reply_to_message_id: userMessage.msgId,
        }
      );
      return;
    }
    await this.updateChat(userMessage.chatId, {
      ...chat,
      model: newModel,
    });

    await this.tbot.sendMessage(
      userMessage.chatId,
      `Updated model to ${newModel}`,
      {
        reply_to_message_id: userMessage.msgId,
      }
    );
  }
}
