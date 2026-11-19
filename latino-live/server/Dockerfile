# El servidor corre con Node 22 y TypeScript sin compilar (strip-types).
FROM node:22-alpine
WORKDIR /repo

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY packages/games ./packages/games
COPY server ./server

WORKDIR /repo/server
ENV NODE_ENV=production
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "--experimental-strip-types", "src/index.ts"]
