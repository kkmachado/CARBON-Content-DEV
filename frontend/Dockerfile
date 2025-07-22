FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

# Instale o servidor estático
RUN npm install -g serve

# Use o serve para rodar o app em produção
CMD ["serve", "-s", "build", "-l", "3000"]