## Multi-stage Dockerfile for Vite React frontend
## Stage 1: build with Node
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (only frontend files are copied)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the frontend source and build
COPY . .
RUN npm run build

## Stage 2: serve with Nginx
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# Clean default Nginx content and copy compiled assets
RUN rm -rf ./*
COPY --from=build /app/dist ./

# SPA routing: always serve index.html
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  include /etc/nginx/mime.types;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location /assets/ {\n\
    try_files $uri =404;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]