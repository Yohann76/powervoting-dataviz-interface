#!/bin/sh

# Fonction pour nettoyer les processus à la sortie
cleanup() {
    echo "🛑 Arrêt des services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    exit 0
}

# Capturer les signaux de terminaison
trap cleanup SIGTERM SIGINT

# Vérifier et installer les dépendances si nécessaire
if [ ! -d "node_modules" ] || [ ! -d "node_modules/express" ]; then
    echo "📦 Installation des dépendances npm (express, cors, etc.)..."
    npm install
    echo "✅ Dépendances installées"
fi

# Démarrer le serveur backend en arrière-plan
BACKEND_PORT=${PORT:-3001}
echo "🚀 Démarrage du serveur backend sur le port $BACKEND_PORT..."
node server/index.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Attendre que le backend démarre et réponde
echo "⏳ Attente du démarrage du backend..."
MAX_WAIT=30
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if kill -0 $BACKEND_PID 2>/dev/null; then
        # Le processus est actif, vérifier s'il répond
        if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
            echo "✅ Serveur backend démarré et répond sur le port $BACKEND_PORT (PID: $BACKEND_PID)"
            break
        fi
    else
        # Le processus s'est arrêté
        echo "❌ Erreur: Le serveur backend n'a pas pu démarrer"
        echo "📋 Logs du backend:"
        cat /tmp/backend.log
        exit 1
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo "   Attente... ($WAIT_COUNT/$MAX_WAIT)"
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
    echo "⚠️  Le backend ne répond pas après $MAX_WAIT secondes"
    echo "📋 Logs du backend:"
    tail -30 /tmp/backend.log
    echo "⚠️  Continuons quand même..."
fi

# Démarrer le serveur frontend
echo "🚀 Démarrage du serveur frontend sur le port 5173..."
npm run dev -- --host

# Si le frontend s'arrête, arrêter aussi le backend
cleanup

