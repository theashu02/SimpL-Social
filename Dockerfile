# Base image for both frontend and backend
FROM node:18-alpine AS base
WORKDIR /app

# =====================
# FRONTEND BUILD STAGE
# =====================
FROM base AS frontend-build
WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm install

COPY frontend ./
RUN npm run build

# =====================
# BACKEND BUILD STAGE
# =====================
FROM base AS backend-build
WORKDIR /app/backend

# Copy backend files
COPY package*.json ./
RUN npm install

# Copy backend source code
COPY backend ./

# Copy built frontend into the backend (if serving via backend)
COPY --from=frontend-build /app/frontend/dist ./public

# =====================
# PRODUCTION STAGE
# =====================
FROM node:18-alpine AS production
WORKDIR /app

# Copy backend build
COPY --from=backend-build /app/backend ./

# Expose the server port
EXPOSE 3000

# Start the backend server
CMD ["npm", "run", "dev"]
