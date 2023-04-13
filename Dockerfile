FROM node:18-alpine

RUN apk update
RUN apk add
RUN apk add ffmpeg

WORKDIR /app

RUN mkdir -p ./data/voices

COPY package*.json ./

RUN npm install

RUN npm install pm2 -g

COPY . .

RUN npm run build

#EXPOSE 3000

CMD ["npm", "run", "start"]

#CMD ["pm2-runtime", "npm", "--", "run", "serve"]