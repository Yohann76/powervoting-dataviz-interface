FROM node:20-alpine

WORKDIR /app

# Installer git et curl pour cloner le repository et vérifier la santé
RUN apk add --no-cache git curl

# Cloner balance-calculator depuis GitHub
ARG BALANCE_CALCULATOR_REPO=https://github.com/RealT-Community/balance-calculator.git
ARG BALANCE_CALCULATOR_BRANCH=main
# Convertir l'URL SSH en HTTPS si nécessaire (git@github.com:user/repo.git -> https://github.com/user/repo.git)
RUN REPO_URL=$(echo "${BALANCE_CALCULATOR_REPO}" | sed 's|git@github.com:|https://github.com/|') && \
    git clone --depth 1 --branch ${BALANCE_CALCULATOR_BRANCH} ${REPO_URL} balance-calculator || \
    (echo "Branch ${BALANCE_CALCULATOR_BRANCH} not found, trying default branch..." && git clone --depth 1 ${REPO_URL} balance-calculator) || \
    (echo "Failed to clone repository ${REPO_URL}" && exit 1)

# Installer les dépendances de balance-calculator
WORKDIR /app/balance-calculator
RUN npm install || yarn install

# Revenir au répertoire principal
WORKDIR /app

# Copier et installer les dépendances de l'interface
COPY package*.json ./
RUN npm install

# Copier le reste des fichiers
COPY . .

EXPOSE 5173 3001

# Créer les répertoires nécessaires pour balance-calculator
RUN mkdir -p /app/balance-calculator/outDatas && \
    mkdir -p /app/balance-calculator/src/configs

# Rendre exécutable le script de démarrage
RUN chmod +x /app/scripts/start.sh

# Démarrer à la fois le serveur backend et le serveur de dev frontend
CMD ["sh", "/app/scripts/start.sh"]
