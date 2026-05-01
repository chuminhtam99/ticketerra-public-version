# Use Node 22 to match your local runtime
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the source code
COPY . .

# Expose the service port (adjust per service)
EXPOSE 3001

# Start the service
CMD ["node", "src/server.js"]
