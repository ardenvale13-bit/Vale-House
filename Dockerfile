FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY scripts ./scripts
COPY server.js CLAUDE.md ./

ENV NODE_ENV=production
ENV PORT=3333
ENV VALE_DATA_DIR=/data

RUN mkdir -p /data/chats /data/uploads \
    && chown -R node:node /app /data

USER node

EXPOSE 3333

CMD ["npm", "start"]
