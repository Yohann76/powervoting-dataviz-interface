# 📊 Power Voting REG - Data Visualization Interface

Interface moderne de visualisation et d'analyse des données de balances REG et de pouvoir de vote pour RealT.

## 🚀 Fonctionnalités

- **Upload de fichiers** : Support des formats CSV et JSON
- **Analyse statistique** : Calcul automatique de moyennes, médianes, écarts-types
- **Visualisations interactives** : Graphiques de distribution avec Chart.js
- **Top holders** : Liste des 10 plus grandes balances et pouvoir de vote
- **Données d'exemple** : Chargement rapide avec fichiers mock
- **Design moderne** : Interface sombre avec glassmorphism et gradients

## 📁 Structure des données

### Balances REG

```json
{
  "result": {
    "balances": [
      {
        "walletAddress": "0x...",
        "type": "wallet",
        "totalBalanceREG": "100",
        "totalBalanceEquivalentREG": "0",
        ...
      }
    ]
  }
}
```

### Power Voting REG

```json
{
  "result": {
    "powerVoting": [
      {
        "address": "0x...",
        "powerVoting": "100"
      }
    ]
  }
}
```

## 🛠️ Technologies

- **Vue 3** - Framework JavaScript progressif
- **TypeScript** - Typage statique
- **Vite** - Build tool rapide
- **Pinia** - State management
- **Vue Router** - Routing
- **Chart.js** - Graphiques
- **PapaParse** - Parsing CSV

## 📦 Installation

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Build pour production
npm run build

# Prévisualisation du build
npm run preview

# test
npm run test
```

## 🎯 Utilisation

1. **Page d'accueil** - Upload de vos fichiers ou utilisation des données d'exemple
2. **Page d'analyse** - Visualisation automatique des statistiques et graphiques

### Upload de fichiers

- Sélectionnez un fichier balancesREG (CSV ou JSON)
- Sélectionnez un fichier powerVotingREG (CSV ou JSON)
- Cliquez sur "Analyser les données"

### Données d'exemple

Cliquez sur "Utiliser les données exemples" pour charger automatiquement les fichiers mock situés dans `/mock/`.

## 📊 Statistiques calculées

- **Total** : Somme de toutes les valeurs
- **Moyenne** : Moyenne arithmétique
- **Médiane** : Valeur médiane
- **Min/Max** : Valeurs minimale et maximale
- **Écart-type** : Mesure de dispersion
- **Distribution** : Répartition par tranches

## 🎨 Design

L'interface utilise une palette de couleurs modernes avec :
- Fond sombre (dark mode)
- Gradients de couleur (primary, secondary, accent)
- Effets de glassmorphism
- Animations fluides
- Design responsive

## 📝 Scripts disponibles

- `npm run dev` - Serveur de développement
- `npm run build` - Build de production
- `npm run preview` - Prévisualisation du build
- `npm run type-check` - Vérification TypeScript
- `npm run format` - Formatage du code avec Prettier

## 🔧 Configuration

Le projet est configuré avec :
- ESLint pour la qualité du code
- Prettier pour le formatage
- TypeScript pour le typage
- Vite pour le bundling

## 📂 Structure du projet

```
src/
├── views/
│   ├── UploadView.vue      # Page d'upload
│   └── AnalysisView.vue    # Page d'analyse
├── stores/
│   └── dataStore.ts        # Store Pinia
├── router/
│   └── index.ts            # Configuration routes
├── App.vue                 # Composant principal
└── main.ts                 # Point d'entrée

mock/
├── balancesREG_*.json      # Données exemple balances
└── powerVotingREG_*.json   # Données exemple power voting
```

## 🌐 Déploiement

Pour déployer en production :

```bash
npm run build
```

Les fichiers optimisés seront générés dans le dossier `dist/`.

## 📄 Licence

Projet RealT - 2025

## 👥 Contribution

Pour contribuer au projet :
1. Fork le projet
2. Créez une branche (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add amazing feature'`)
4. Pushez vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request
