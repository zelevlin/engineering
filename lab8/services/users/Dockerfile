FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV PORT=4001
EXPOSE 4001

CMD ["npm", "start"]
