FROM node:20-alpine

RUN apk add --no-cache ffmpeg py3-pip \
  && pip install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app
COPY services/videobox/package.json ./package.json
COPY services/videobox/server.mjs ./server.mjs

ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm", "start"]
