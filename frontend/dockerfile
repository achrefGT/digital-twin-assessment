FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files first (this is important for Docker layer caching)
COPY frontend/package*.json ./

# Install dependencies INSIDE the container
RUN npm install

# Then copy the rest of your frontend code
COPY frontend/ .

# Start the dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]