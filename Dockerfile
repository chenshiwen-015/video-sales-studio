FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY dist ./dist
COPY server ./server
COPY tests ./tests
RUN npm test
USER node
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server/index.mjs"]
