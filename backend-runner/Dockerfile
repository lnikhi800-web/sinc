FROM node:20-alpine

# Install git, sh, cmd tools, and other dependencies needed by Vite/NPM/PNPM builders
RUN apk add --no-cache git bash openssh

WORKDIR /app

# Copy dependency definition
COPY package.json ./

# Install packages
RUN npm install

# Copy application files
COPY server.js ./

# Set environment defaults
ENV PORT=5173
ENV PROJECTS_DIR=/app/projects
ENV NODE_ENV=production

# Expose server port
EXPOSE 5173

CMD ["npm", "start"]
