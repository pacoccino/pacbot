import {Chat} from './chat'
import {MessageHandler} from './messages'
import {Bot} from './bot'

async function main() {
  const bot = new Bot()
  const chat = new Chat(bot)
  const messageHandler = new MessageHandler(chat)
  await bot
    .init(messageHandler.handle.bind(messageHandler))
    .then(() => console.log('Telegram bot started'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
