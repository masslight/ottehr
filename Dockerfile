# Use an official Node base image
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Update package list and install npm
RUN apt-get update && apt-get install -y npm

# Install npm 8.7.6 explicitly
RUN npm install -g npm@8.7.6

# Optionally, if you have an existing Node.js project, copy your files:
COPY . .

# Your command to run the application, for example:
CMD ["node", "your-script.js"]
