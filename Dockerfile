# Base image - choose a slim OS for efficient containers
FROM alpine:latest

# Install essential packages
RUN apk add --no-cache ca-certificates openssl shadowsocks-libev

# Create a non-root user to run the server (security best practice)
RUN adduser -D outline

# Set up working directory for the Outline components
WORKDIR /opt/outline

# Fetch the necessary Outline Server code and Switch to the working directory
RUN git clone https://github.com/Jigsaw-Code/outline-server.git .

# Install dependencies 
RUN cd src/shadowbox && npm install --production

# Build the management server (note: modify metrics_server if needed)
RUN cd src/shadowbox && npm run build
RUN cd ../metrics_server && npm install --production && npm run build

# Specify exposed port 
EXPOSE 8080 

# Set non-root user 
USER outline

# Start the Outline Server
CMD ["node", "src/shadowbox/server.js"]
