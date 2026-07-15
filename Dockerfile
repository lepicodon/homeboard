FROM node:22-alpine

# Set production environment
ENV NODE_ENV=production
ENV DB_PATH=/data/todo.db
ENV PORT=3000

# Create application directory
WORKDIR /usr/src/app

# Install build tools temporarily in case better-sqlite3 native build is triggered
# and clean them up in the same layer to minimize image size.
COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps

# Copy application files
COPY server.js ./
COPY src/ ./src/
COPY public/ ./public/

# Setup persistent storage volume
RUN mkdir -p /data && chown -R node:node /data
VOLUME /data

# Expose port 3000
EXPOSE 3000

# Use non-root container user for security
USER node

# Start the application
CMD ["node", "server.js"]
