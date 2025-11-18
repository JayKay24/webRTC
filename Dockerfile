# Use an official Node.js runtime as a parent image for the build stage
FROM node:22-slim

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the application source code
COPY . .

# Install openssl, create certs directory, and generate self-signed certificates
# RUN apt-get update && apt-get install -y openssl
# RUN mkdir certs
# RUN npm run ssl-keys --keydir="certs" --numdays=365

# Expose port 3000
EXPOSE 3000

# # Set environment variables for the runtime
# ENV LOCALHOST_SSL_KEY="certs/localhost.key"
# ENV LOCALHOST_SSL_CERT="certs/localhost.crt"
ENV PUBLIC=www
ENV DEBUG="signaling-server"

# Use node directly to start the app to handle signals correctly
ENTRYPOINT [ "npm", "start" ]
