# --- Base image Node 22 ---
FROM node:22-bullseye

# --- Cài hệ thống dependencies ---
RUN apt update && apt install -y \
    git curl wget build-essential python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# --- Cài pnpm thủ công để tránh Corepack tự tải ---
RUN npm install -g pnpm@10.16.1
# Tăng timeout & retry để tránh fail khi mạng yếu
RUN pnpm config set fetch-timeout 600000
RUN pnpm config set fetch-retries 5

# --- Copy toàn bộ source code n8n custom của bạn ---
WORKDIR /app
COPY . .

# --- Cài dependencies và build ---
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# --- Expose port n8n ---
EXPOSE 5678

# --- Command mặc định để chạy n8n ---
CMD ["pnpm", "start"]
