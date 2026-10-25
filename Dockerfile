# Optional native CadQuery host; build context is the monorepo root.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libgl1 libglib2.0-0 libxrender1 libsm6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/cad/requirements.txt ./services/cad/requirements.txt
RUN python3 -m venv /opt/cad && /opt/cad/bin/pip install --no-cache-dir -r services/cad/requirements.txt
COPY . .
RUN npm ci && npm run build && npm run check:private-build && mkdir -p /var/lib/patentradar && chown -R node:node /var/lib/patentradar
ENV NODE_ENV=production CAD_PYTHON=/opt/cad/bin/python PATENTRADAR_DATA_DIR=/var/lib/patentradar
USER node
VOLUME /var/lib/patentradar
EXPOSE 3000
CMD ["npm", "start"]
