FROM node:18

RUN apt update
RUN apt install -y ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm install pm2 -g

COPY . .

RUN npm run build

#EXPOSE 3000

CMD ["npm", "run", "start"]

#CMD ["pm2-runtime", "npm", "--", "run", "serve"]