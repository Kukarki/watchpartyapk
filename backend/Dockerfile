FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source (--chown ensures the node user can read these regardless of
# host-side permission bits, e.g. if the source dir was cloned as 700)
COPY --chown=node:node server.js ./
COPY --chown=node:node src/ ./src/

# Run as non-root user
USER node

EXPOSE 4000

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
