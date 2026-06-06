FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV PORT=4002
EXPOSE 4002

CMD ["npm", "start"]
