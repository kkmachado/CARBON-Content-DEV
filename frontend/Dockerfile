FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

# (Opcional: servir build com um servidor estático, ex: serve)
# RUN npm install -g serve
# CMD ["serve", "-s", "build"]

# ...adicione CMD conforme seu ambiente de produção...