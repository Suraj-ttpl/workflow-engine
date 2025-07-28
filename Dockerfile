#Setting up ARG for node version
ARG NODE_VERSION=22

#Node alpine base image
FROM node:${NODE_VERSION}-alpine

#openssl
RUN set -ex; \
    apk update; \
    apk add --no-cache \
      openssl

# Create app directory
RUN mkdir -p /opt/api
WORKDIR /opt/api

COPY package*.json /opt/api
RUN npm install
# Copy app directory files and directory in container
COPY . /opt/api

# Verify app directory in container
RUN ls /opt/api
RUN npx prisma generate
RUN npm run build

# Upgrade npm modules
RUN npm install -g pm2

# Clean npm cache
RUN npm cache clean --force

# Start using pm2 process manager and run prisma migration
CMD ["sh", "-c", "npx prisma migrate && pm2-runtime start npm --name sozen-api -- run start:dev"]
