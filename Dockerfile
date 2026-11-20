# Đảo Đèn Lồng — game server + headless tools.
#   docker build -t dao-den-long:1.0.0 .
#   docker run --rm -p 5173:5173 dao-den-long:1.0.0                    # play at http://localhost:5173
#   docker run --rm dao-den-long:1.0.0 node scripts/run-tests.js        # tests
#   docker run --rm -v "$PWD/out:/app/out" dao-den-long:1.0.0 node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl
# The benchmark needs a real GPU window, so run `node scripts/bench.js` on the host, not in Docker.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
ENV PORT=5173 DDL_DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 5173
CMD ["node", "server.js"]
