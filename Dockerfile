FROM node:10.16.0

WORKDIR /usr/src/sct-binance-bot

COPY package*.json ./

RUN npm i
