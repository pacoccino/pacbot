import {Configuration, OpenAIApi} from 'openai'
import config from './config'

const openai = new OpenAIApi(
  new Configuration({
    apiKey: config.openAIToken,
  })
)

export {openai}
