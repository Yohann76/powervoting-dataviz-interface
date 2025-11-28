import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Utiliser PORT de l'environnement, avec 3001 comme défaut pour compatibilité Docker
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Configuration CORS permissive pour le développement
app.use(cors({
  origin: '*', // Permettre toutes les origines en développement
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json({ limit: '50mb' }));
// Servir les fichiers statiques en production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}
app.use('/generated', express.static(join(__dirname, '../balance-calculator/outDatas')));

const BALANCE_CALCULATOR_PATH = join(__dirname, '../balance-calculator');

// Route pour obtenir la configuration par défaut
app.get('/api/config/default', async (req, res) => {
  try {
    const configPath = join(BALANCE_CALCULATOR_PATH, 'src/configs/optionsModifiers.ts');
    
    // Vérifier si le fichier existe
    try {
      await fs.access(configPath);
    } catch (accessError) {
      console.error(`Config file not found at: ${configPath}`);
      console.error(`Balance calculator path: ${BALANCE_CALCULATOR_PATH}`);
      
      // Lister les fichiers dans le répertoire pour debug
      try {
        const configDir = join(BALANCE_CALCULATOR_PATH, 'src/configs');
        const files = await fs.readdir(configDir);
        console.error(`Files in configs directory:`, files);
      } catch (dirError) {
        console.error(`Configs directory doesn't exist: ${configDir}`);
      }
      
      // Retourner une configuration par défaut si le fichier n'existe pas
      // Essayer de lire depuis le balance-calculator local si disponible
      const localBalanceCalculator = join(__dirname, '../../balance-calculator/src/configs/optionsModifiers.ts');
      try {
        const localConfig = await fs.readFile(localBalanceCalculator, 'utf-8');
        return res.json({ config: localConfig });
      } catch {
        // Configuration par défaut de secours
        const defaultConfig = `import { NormalizeOptions } from "../types/inputModles.types.js";
import dexConfig from "./dex.json" assert { type: "json" };

const getDexPoolAddresses = () => {
  const addresses: string[] = [];
  Object.values(dexConfig.network).forEach((networks) => {
    Object.values(networks).forEach((dex) => {
      addresses.push(...dex.pool_id.map((address: string) => address.toLowerCase()));
    });
  });
  return addresses;
};

const excludeAddressREG = [
  ...getDexPoolAddresses(),
];

export const optionsModifiers: NormalizeOptions = {
  excludeAddresses: excludeAddressREG,
  boostBalancesDexs: {
    sushiswap: {
      default: {
        REG: 4,
        "*": 2,
      },
      v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "step",
        boostMode: "proximity",
        steps: [
          [0.2, 5],
          [0.5, 3],
          [0.7, 2],
          [1.0, 1],
        ],
        maxBoost: 5,
        minBoost: 1,
        inactiveBoost: 1,
        sliceWidth: 0.1,
        decaySlicesDown: 10,
        decaySlicesUp: 10,
        outOfRangeEnabled: false,
      },
    },
    balancer: [
      ["REG", "*"],
      [4, 2],
    ],
    honeyswap: [
      ["REG", "*"],
      [4, 2],
    ],
    swaprhq: {
      default: {
        REG: 4,
        "*": 2,
      },
      v3: {
        sourceValue: "tick",
        priceRangeMode: "none",
      },
    },
  },
  boostBalancesIncentivesVault: 1,
  boostBalancesWallet: 1,
  balanceKey: "totalBalance",
  zeroforced: 1,
};`;
        
        return res.json({ config: defaultConfig });
      }
    }
    
    const configContent = await fs.readFile(configPath, 'utf-8');
    res.json({ config: configContent });
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read config file', details: error.message });
  }
});

// Route pour lister les fichiers générés
app.get('/api/generated-files', async (req, res) => {
  try {
    const outDir = join(BALANCE_CALCULATOR_PATH, 'outDatas');
    await fs.mkdir(outDir, { recursive: true });
    const files = await fs.readdir(outDir);
    const fileStats = await Promise.all(
      files
        .filter(f => f.endsWith('.json') || f.endsWith('.csv'))
        .map(async (file) => {
          const filePath = join(outDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            type: file.endsWith('.json') ? 'json' : 'csv',
          };
        })
    );
    res.json({ files: fileStats.sort((a, b) => b.modified.localeCompare(a.modified)) });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list generated files' });
  }
});

// Route pour télécharger un fichier généré
app.get('/api/generated-files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = join(BALANCE_CALCULATOR_PATH, 'outDatas', filename);
    
    // Vérifier que le fichier existe et est dans le bon répertoire
    const resolvedPath = path.resolve(filePath);
    const outDir = path.resolve(join(BALANCE_CALCULATOR_PATH, 'outDatas'));
    
    if (!resolvedPath.startsWith(outDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await fs.stat(filePath);
    res.setHeader('Content-Type', filename.endsWith('.json') ? 'application/json' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    const fileContent = await fs.readFile(filePath);
    res.send(fileContent);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Route pour exécuter une tâche du balance-calculator
app.post('/api/generate', async (req, res) => {
  try {
    const { task, config, options } = req.body;
    
    // Écrire la configuration modifiée
    if (config) {
      const configPath = join(BALANCE_CALCULATOR_PATH, 'src/configs/optionsModifiers.ts');
      
      // S'assurer que le répertoire existe
      const configDir = join(BALANCE_CALCULATOR_PATH, 'src/configs');
      await fs.mkdir(configDir, { recursive: true });
      
      // Vérifier si le fichier existe, sinon le créer
      try {
        await fs.access(configPath);
      } catch {
        console.log(`Creating config file at: ${configPath}`);
      }
      
      await fs.writeFile(configPath, config, 'utf-8');
      console.log(`✅ Configuration saved to: ${configPath}`);
    }

    // Créer un tsconfig spécifique pour l'exécution qui désactive les vérifications strictes
    const tsconfigRuntimePath = join(BALANCE_CALCULATOR_PATH, 'tsconfig.runtime.json');
    const tsconfigRuntime = {
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "noImplicitAny": false,
        "strict": false,
        "skipLibCheck": true
      }
    };
    await fs.writeFile(tsconfigRuntimePath, JSON.stringify(tsconfigRuntime, null, 2), 'utf-8');

    // Sauvegarder l'original inquirer.ts et créer une version mockée
    const originalInquirerPath = join(BALANCE_CALCULATOR_PATH, 'src/utils/inquirer.ts');
    const backupInquirerPath = join(BALANCE_CALCULATOR_PATH, 'src/utils/inquirer.ts.backup');
    
    // Lire l'original et créer une version mockée
    let originalInquirerContent = '';
    try {
      originalInquirerContent = await fs.readFile(originalInquirerPath, 'utf-8');
      // Sauvegarder l'original
      await fs.writeFile(backupInquirerPath, originalInquirerContent, 'utf-8');
    } catch (e) {
      // Si le backup existe déjà, le lire
      try {
        originalInquirerContent = await fs.readFile(backupInquirerPath, 'utf-8');
      } catch (e2) {
        console.error('Could not read original inquirer.ts');
      }
    }

    // Créer une version mockée qui utilise les options
    const mockedInquirerContent = `
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { setTimeout } from "timers/promises";
import { i18n } from "../i18n/index.js";
import path from "path";

// Lire les options depuis les variables d'environnement
const getOptions = () => {
  try {
    return JSON.parse(process.env.TASK_OPTIONS || '{}');
  } catch {
    return {};
  }
};

const getTaskName = () => process.env.TASK_NAME || '';

// Mock des fonctions pour utilisation non-interactive
export async function askInput(message: string, config?: any, defaultValue?: string): Promise<string> {
  const options = getOptions();
  const taskName = getTaskName();
  
  // Pour GetBalancesREG
  if (taskName === 'GetBalancesREG') {
    if (message.includes('targetAddress') || message.includes('adresse') || message.includes('address')) {
      return options.targetAddress || defaultValue || 'all';
    }
    return defaultValue || '';
  }
  
  // Pour CalculatePowerVotingREG
  if (taskName === 'CalculatePowerVotingREG') {
    if (message.includes('batchSize') || message.includes('Batch') || message.includes('batch')) {
      return options.batchSize || defaultValue || '1000';
    }
    return defaultValue || '';
  }
  
  // Pour les autres tâches, ne JAMAIS utiliser les prompts réels
  return defaultValue || '';
}

export async function askChoiseCheckbox(
  message: string,
  list: { value: string[]; name: string[] },
  defaultChecked?: boolean
): Promise<string[]> {
  const options = getOptions();
  const taskName = getTaskName();
  
  if (taskName === 'GetBalancesREG') {
    // Détecter le type de prompt
    const msgLower = message.toLowerCase();
    
    // Pour les réseaux
    if (msgLower.includes('network') || msgLower.includes('réseau') || msgLower.includes('reseau')) {
      // Retourner les réseaux fournis ou tous par défaut
      return options.networks || list.value || [];
    }
    
    // Pour les DEX (peut être appelé plusieurs fois pour différents réseaux)
    if (msgLower.includes('dex') || msgLower.includes('dexs') || msgLower.includes('exchange')) {
      // Retourner tous les DEX disponibles par défaut
      return list.value || [];
    }
    
    // Pour les tokens
    if (msgLower.includes('token') || msgLower.includes('address')) {
      return options.tokenAddresses || list.value || [];
    }
  }
  
  // Pour GetBalancesREG, ne JAMAIS utiliser les prompts réels
  if (taskName === 'GetBalancesREG') {
    // Retourner tous les éléments si defaultChecked est true, sinon retourner au moins le premier
    if (list.value.length > 0) {
      return defaultChecked ? list.value : [list.value[0]];
    }
    return [];
  }
  
  // Fallback : retourner tous les éléments cochés par défaut si defaultChecked est true
  if (defaultChecked && list.value.length > 0) {
    return list.value;
  }
  
  // Fallback vers la fonction originale si nécessaire (seulement pour les autres tâches)
  if (list.value.length < 1) {
    return [];
  }
  const answers: string[] = await checkbox({
    message: message,
    choices: list.value.map((str, i) => {
      return { name: list.name[i], value: str, checked: !!defaultChecked };
    }),
    pageSize: 5,
    loop: true,
    validate: (value) => {
      if (value.length < 1) {
        return i18n.t("utils.inquirer.askMessageValidateCheckbox");
      }
      return true;
    },
  });
  return answers;
}

export async function askChoiseListe(message: string, list: { value: string[]; name: string[] }): Promise<string> {
  const options = getOptions();
  const taskName = getTaskName();
  
  // Pour GetBalancesREG
  if (taskName === 'GetBalancesREG') {
    if (message.includes('calculationType') || message.includes('type de calcul') || message.includes('Type de calcul')) {
      return options.calculationType || list.value[0] || 'sum';
    }
    return list.value[0] || '';
  }
  
  // Pour CalculatePowerVotingREG
  if (taskName === 'CalculatePowerVotingREG') {
    const msgLower = message.toLowerCase();
    
    // Sélection du fichier JSON de balances (le plus récent)
    if (msgLower.includes('balances') || msgLower.includes('snapshot') || msgLower.includes('jsonfile') || msgLower.includes('data')) {
      // Si un fichier spécifique est fourni dans les options, le chercher dans la liste
      if (options.balancesJsonFile && options.balancesJsonFile.trim() !== '') {
        // Extraire juste le nom du fichier du chemin complet
        let fileName = path.basename(options.balancesJsonFile);
        
        // Chercher le fichier dans la liste (comparaison flexible)
        let found = list.value.find(f => {
          const fName = path.basename(f);
          const tmpRegex = /_tmp\\.json$/;
          return fName === fileName || f.includes(fileName) || fileName.includes(fName) || 
                 fName.toLowerCase() === fileName.toLowerCase() ||
                 fName.replace(tmpRegex, '') === fileName.replace(tmpRegex, '');
        });
        
        if (found) {
          console.log('[Mock CalculatePowerVotingREG] Found balances file:', found, '(from options:', options.balancesJsonFile + ')');
          return found;
        }
        
        // Si pas trouvé, chercher un fichier qui commence par "balancesREG"
        found = list.value.find(f => f.toLowerCase().includes('balancesreg') || f.toLowerCase().startsWith('balancesreg'));
        if (found) {
          console.log('[Mock CalculatePowerVotingREG] Using balances file by prefix:', found);
          return found;
        }
        
        // Si toujours pas trouvé, retourner le dernier fichier de la liste
        const lastFile = list.value[list.value.length - 1] || list.value[0] || '';
        console.log('[Mock CalculatePowerVotingREG] Balances file not found, using latest:', lastFile);
        return lastFile;
      }
      // Retourner le dernier fichier de la liste (généralement le plus récent)
      const lastFile = list.value[list.value.length - 1] || list.value[0] || '';
      console.log('[Mock CalculatePowerVotingREG] No balances file specified, using latest:', lastFile);
      return lastFile;
    }
    
    // Sélection du modèle d'entrée
    if (msgLower.includes('model') && !msgLower.includes('power') && !msgLower.includes('voting')) {
      // Retourner le modèle spécifié ou le premier disponible
      if (options.inputModel) {
        const found = list.value.find(m => m.toLowerCase().includes(options.inputModel.toLowerCase()) || options.inputModel.toLowerCase().includes(m.toLowerCase()));
        if (found) {
          return found;
        }
        return options.inputModel;
      }
      // Détection automatique basée sur le nom du fichier (comme dans le code original)
      return list.value[0] || '';
    }
    
    // Sélection du modèle de power voting
    if (msgLower.includes('power') && msgLower.includes('voting') && msgLower.includes('model')) {
      if (options.powerVotingModel) {
        const found = list.value.find(m => m.toLowerCase().includes(options.powerVotingModel.toLowerCase()) || options.powerVotingModel.toLowerCase().includes(m.toLowerCase()));
        if (found) {
          return found;
        }
        return options.powerVotingModel;
      }
      return list.value[0] || '';
    }
    
    // Sélection du fichier power voting précédent
    if (msgLower.includes('previous') || msgLower.includes('précédent') || msgLower.includes('power') && msgLower.includes('voting') && !msgLower.includes('model')) {
      if (options.previousPowerVotingFile) {
        // Si "none" est demandé, le retourner
        if (options.previousPowerVotingFile === 'none' || options.previousPowerVotingFile === '') {
          return 'none';
        }
        // Sinon, chercher dans la liste
        const found = list.value.find(f => f.includes(options.previousPowerVotingFile) || options.previousPowerVotingFile.includes(f));
        if (found) {
          return found;
        }
        return options.previousPowerVotingFile;
      }
      return 'none';
    }
    
    // Par défaut, retourner le premier élément
    return list.value[0] || '';
  }
  
  // Pour les autres tâches, ne JAMAIS utiliser les prompts réels
  return list.value[0] || '';
}

export async function askUseconfirm(message: string, defaultValue?: boolean): Promise<boolean> {
  const options = getOptions();
  const taskName = getTaskName();
  
  if (taskName === 'GetBalancesREG') {
    const msgLower = message.toLowerCase();
    
    // Pour le mock
    if (msgLower.includes('mock') || msgLower.includes('test') || msgLower.includes('données de test')) {
      return options.useMock || defaultValue || false;
    }
    
    // Pour les fichiers temporaires
    if (msgLower.includes('temp') || msgLower.includes('temporaire') || msgLower.includes('fichier temporaire')) {
      return options.useTempFile || defaultValue || false;
    }
    
    // Pour les DEX (peut être appelé plusieurs fois pour différents réseaux)
    if (msgLower.includes('dex') || msgLower.includes('exchange')) {
      // Par défaut, extraire les DEX si demandé
      return options.askDexs !== false ? true : (defaultValue !== undefined ? defaultValue : true);
    }
    
    // Pour les autres confirmations, utiliser la valeur par défaut fournie
    return defaultValue !== undefined ? defaultValue : true;
  }
  
  // Pour GetBalancesREG, ne JAMAIS utiliser les prompts réels - toujours retourner la valeur par défaut
  if (taskName === 'GetBalancesREG') {
    return defaultValue !== undefined ? defaultValue : true;
  }
  
  // Fallback vers la fonction originale (seulement pour les autres tâches)
  const answers: boolean = await confirm({
    message: message,
    default: defaultValue,
  });
  return answers;
}

export async function askUseTempFile(files: string[]): Promise<string> {
  const options = getOptions();
  return options.tempFile || files[0] || '';
}

// Autres fonctions (garder l'original)
export async function askGraphQLUrl(): Promise<string> {
  const extra = process.env.ENDPOINT_EXTRA ?? [];
  const answers = await select({
    message: "Que voulez-vous faire ?",
    choices: [
      { value: "https://api.realtoken.network/graphql" },
      ...(extra as string[]).map((url) => ({ value: url })),
      { value: "http://localhost:3000/graphql" },
    ],
  });
  return answers;
}

export async function askTokenAddresses(tokens: Array<[string, string]>): Promise<string[]> {
  const choices = tokens.map(([address, shortName]) => ({
    name: \`\${shortName} (\${address.slice(0, 6)}...\${address.slice(-4)})\`,
    value: address,
    checked: true,
  }));

  const answers = await checkbox({
    message: i18n.t("utils.inquirer.askTokenAddresses"),
    choices: choices,
  });

  return answers;
}

export async function askDateRange(
  opts: {
    skipAsk?: boolean;
    startDate?: string;
    endDate?: string;
    snapshotTime?: string;
    currantTimestemp?: number;
  } = {}
): Promise<{
  startDate: string;
  endDate: string;
  snapshotTime: string;
}> {
  const options = getOptions();
  const taskName = getTaskName();
  
  // Pour GetBalancesREG, ne JAMAIS utiliser les prompts réels
  if (taskName === 'GetBalancesREG') {
    const today = new Date();
    const defaultDate = \`\${today.getUTCFullYear()}-\${String(today.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-\${String(today.getUTCDate()).padStart(2, "0")}\`;
    const defaultTime = \`\${String(today.getUTCHours()).padStart(2, "0")}:00\`;
    
    return {
      startDate: opts.startDate ?? options.startDate ?? defaultDate,
      endDate: opts.endDate ?? options.endDate ?? defaultDate,
      snapshotTime: opts.snapshotTime ?? options.snapshotTime ?? defaultTime,
    };
  }
  
  // Fallback vers la fonction originale (seulement pour les autres tâches)
  const today = new Date();
  const defaultDate = \`\${today.getUTCFullYear()}-\${String(today.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-\${String(today.getUTCDate()).padStart(2, "0")}\`;
  const defaultTime = \`\${String(today.getUTCHours()).padStart(2, "0")}:00\`;
  
  if (opts.skipAsk) {
    return {
      startDate: opts.startDate ?? defaultDate,
      endDate: opts.endDate ?? defaultDate,
      snapshotTime: opts.snapshotTime ?? defaultTime,
    };
  }

  const { startDate = defaultDate, endDate = defaultDate, snapshotTime = defaultTime } = opts;

  const start = await input({
    message: i18n.t("utils.inquirer.askDateRange"),
    default: defaultDate,
    validate: (value: string) => {
      const pass = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
      if (pass) {
        return true;
      }
      return i18n.t("utils.inquirer.askMessageValidateRange");
    },
  });

  const end = await input({
    message: i18n.t("utils.inquirer.askDateRangeEnd"),
    default: start,
    validate: (value: string) => {
      const pass = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
      if (pass) {
        return true;
      }
      return i18n.t("utils.inquirer.askMessageValidateRange");
    },
  });

  const time = await input({
    message: i18n.t("utils.inquirer.askSnapshotTime"),
    default: defaultTime,
    validate: (value: string) => {
      const pass = value.match(/^([01]\\d|2[0-3]):([0-5]\\d)$/);
      if (pass) {
        return true;
      }
      return i18n.t("utils.inquirer.askMessageValidateTime");
    },
  });

  return { startDate: start, endDate: end, snapshotTime: time };
}

export async function askUrls(
  urlsList: string[],
  multiSelect: boolean = true,
  message: string = "Quelle url graphQL utiliser ?"
): Promise<string[] | string> {
  const options = getOptions();
  const taskName = getTaskName();
  
  // Pour GetBalancesREG, retourner directement la première URL de la liste (pas de prompt)
  if (taskName === 'GetBalancesREG') {
    // Si des URLs sont fournies dans les options, les utiliser
    if (options.urls) {
      return multiSelect ? (Array.isArray(options.urls) ? options.urls : [options.urls]) : (Array.isArray(options.urls) ? options.urls[0] : options.urls);
    }
    // Sinon, retourner la première URL de la liste fournie
    if (urlsList && urlsList.length > 0) {
      return multiSelect ? [urlsList[0]] : urlsList[0];
    }
  }
  
  // Pour GetBalancesREG, ne JAMAIS utiliser les prompts réels - retourner directement la première URL
  if (taskName === 'GetBalancesREG') {
    if (urlsList && urlsList.length > 0) {
      return multiSelect ? [urlsList[0]] : urlsList[0];
    }
    // Si pas d'URL fournie, retourner une URL par défaut
    return multiSelect ? ['https://api.thegraph.com'] : 'https://api.thegraph.com';
  }
  
  // Fallback vers la fonction originale pour les autres cas (seulement pour les autres tâches)
  urlsList.push("http://localhost:3000/graphql", "custom");
  const askGraphQLUrl = {
    value: urlsList,
    name: [],
  };

  let urls;
  const timer = setTimeout(10000).then(() => {
    return multiSelect ? [urlsList[0]] : urlsList[0];
  });

  if (multiSelect) {
    urls = await Promise.race([askChoiseCheckbox(message, askGraphQLUrl), timer]);
  } else {
    urls = await Promise.race([askChoiseListe(message, askGraphQLUrl), timer]);
  }

  const urlsArray = Array.isArray(urls) ? urls : [urls];
  
  return urlsArray.includes("custom")
    ? [
        await askInput(i18n.t("utils.inquirer.askCustomUrl"), {
          regex: /^https?:\\/\\/[a-zA-Z0-9_-]*\\.[a-z]{2,}/,
          messageEchec: i18n.t("utils.inquirer.askMessageValidateCustomUrl"),
        }),
        ...urlsArray.filter((u: string) => u !== "custom"),
      ]
    : (multiSelect ? urlsArray : urlsArray[0]);
}
`;
    
    // Écrire la version mockée
    await fs.writeFile(originalInquirerPath, mockedInquirerContent, 'utf-8');

    // Créer le script wrapper
    const wrapperScript = join(BALANCE_CALCULATOR_PATH, 'task-wrapper.ts');
    const wrapperContent = `
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = JSON.parse(process.argv[2] || '{}');
const taskName = process.argv[3];

console.log('[Wrapper] Starting task', taskName, 'with options:', JSON.stringify(options, null, 2));

// Définir les variables d'environnement pour le mock
process.env.TASK_OPTIONS = JSON.stringify(options);
process.env.TASK_NAME = taskName;

try {
  console.log('[Wrapper] Importing task module...');
  // Importer la tâche (qui utilisera maintenant le mock inquirer)
  const taskModule = await import('./src/tasks/' + taskName + '.ts');
  const taskFunction = taskModule['task' + taskName];
  
  if (!taskFunction) {
    throw new Error('Task function task' + taskName + ' not found');
  }

  console.log('[Wrapper] Executing task...');
  // Exécuter la tâche
  let result: string;
  if (taskName === 'GetBalancesREG') {
    console.log('[Wrapper] Calling GetBalancesREG with tempData length:', (options.tempData || '').length);
    result = await taskFunction(options.tempData || '');
  } else {
    result = await taskFunction();
  }
  
  console.log('[Wrapper] Task completed, result file:', result);
  
  const resultPath = join(__dirname, 'task-result.json');
  writeFileSync(resultPath, JSON.stringify({ 
    success: true, 
    outputFile: result || '',
    message: 'Task completed successfully'
  }));
  
  console.log('[Wrapper] Result written to', resultPath);
  process.exit(0);
} catch (error: any) {
  console.error('[Wrapper] Task error:', error);
  const resultPath = join(__dirname, 'task-result.json');
  writeFileSync(resultPath, JSON.stringify({ 
    success: false, 
    error: error.message,
    stack: error.stack
  }));
  process.exit(1);
}
`;
    await fs.writeFile(wrapperScript, wrapperContent, 'utf-8');

    // Exécuter la tâche via le wrapper
    // Utiliser ts-node avec transpileOnly pour ignorer les erreurs de type
    return new Promise((resolve) => {
      const optionsJson = JSON.stringify(options || {});
      
      // Utiliser ts-node avec transpileOnly via les variables d'environnement
      // Le register standard de ts-node lira automatiquement TS_NODE_TRANSPILE_ONLY
      const tsNodeRegister = `data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("${BALANCE_CALCULATOR_PATH}/"));`;
      
      // S'assurer que toutes les clés API nécessaires sont bien définies (selon .env.exemple)
      const theGraphApiKey = process.env.THEGRAPH_API_KEY || '';
      const etherscanApiKey = process.env.API_KEY_ETHERSCAN || '';
      const gnosisScanApiKey = process.env.API_KEY_GNOSISSCAN || '';
      const polygonScanApiKey = process.env.API_KEY_POLYGONSCAN || '';
      const moralisApiKey = process.env.API_KEY_MORALIS || '';
      
      if (!theGraphApiKey) {
        console.warn('⚠️ THEGRAPH_API_KEY is not set in environment variables');
      } else {
        console.log(`✅ THEGRAPH_API_KEY is set (length: ${theGraphApiKey.length})`);
      }
      
      // Construire l'environnement avec toutes les variables nécessaires (selon .env.exemple)
      const childEnv = { 
        ...process.env, 
        THEGRAPH_API_KEY: theGraphApiKey,
        API_KEY_ETHERSCAN: etherscanApiKey,
        API_KEY_GNOSISSCAN: gnosisScanApiKey,
        API_KEY_POLYGONSCAN: polygonScanApiKey,
        API_KEY_MORALIS: moralisApiKey,
        NODE_PATH: join(BALANCE_CALCULATOR_PATH, 'node_modules'),
        TS_NODE_TRANSPILE_ONLY: 'true',
        TS_NODE_COMPILER_OPTIONS: JSON.stringify({ noImplicitAny: false, strict: false, skipLibCheck: true }),
        TS_NODE_PROJECT: tsconfigRuntimePath
      };

      const child = spawn('node', [
        '--import', tsNodeRegister,
        wrapperScript,
        optionsJson,
        task
      ], {
        cwd: BALANCE_CALCULATOR_PATH,
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;

      // Ajouter un timeout de 30 minutes pour éviter les blocages infinis
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.error(`⚠️ Timeout: La tâche ${task} a pris plus de 30 minutes`);
          child.kill('SIGTERM');
          res.json({
            success: false,
            output: stdout,
            error: 'Timeout: La génération a pris plus de 30 minutes. Le processus a été interrompu.',
            exitCode: -1
          });
          resolve();
        }
      }, 30 * 60 * 1000); // 30 minutes

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Afficher immédiatement pour le débogage
        process.stdout.write(`[${task}] ${output}`);
        console.log(`[${task}] stdout:`, output.trim());
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Afficher immédiatement pour le débogage
        process.stderr.write(`[${task}] ${output}`);
        console.error(`[${task}] stderr:`, output.trim());
      });

      child.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          console.error(`[${task}] Process error:`, error);
          res.status(500).json({ 
            success: false, 
            error: error.message,
            output: stdout,
            stderr: stderr
          });
          resolve();
        }
      });

      child.on('close', async (code) => {
        if (isResolved) {
          return; // Déjà résolu par le timeout ou une erreur
        }
        isResolved = true;
        clearTimeout(timeout);

        console.log(`[${task}] Process closed with code: ${code}`);
        console.log(`[${task}] stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
        if (stdout) {
          console.log(`[${task}] Last 500 chars of stdout:`, stdout.slice(-500));
        }
        if (stderr) {
          console.log(`[${task}] Last 500 chars of stderr:`, stderr.slice(-500));
        }

        // Restaurer le fichier inquirer.ts original
        try {
          if (originalInquirerContent) {
            await fs.writeFile(originalInquirerPath, originalInquirerContent, 'utf-8');
            console.log('✅ Original inquirer.ts restored');
          }
        } catch (restoreError) {
          console.error('❌ Error restoring original inquirer.ts:', restoreError);
        }

        const resultPath = join(BALANCE_CALCULATOR_PATH, 'task-result.json');
        let result = { success: false, error: 'Unknown error' };
        
        try {
          const resultContent = await fs.readFile(resultPath, 'utf-8');
          result = JSON.parse(resultContent);
          console.log(`[${task}] Task result:`, result);
        } catch (e) {
          console.error(`[${task}] Failed to read task result:`, e);
          result = { success: false, error: stderr || 'Failed to read task result' };
        }

        res.json({
          success: result.success && code === 0,
          output: stdout,
          error: stderr || result.error,
          outputFile: result.outputFile,
          exitCode: code
        });
        resolve();
      });

      child.on('error', (error) => {
        res.status(500).json({ 
          success: false, 
          error: error.message,
          output: stdout,
          stderr: stderr
        });
        resolve();
      });
    });
  } catch (error) {
    console.error('Error executing task:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Route pour obtenir les tâches disponibles
app.get('/api/tasks', async (req, res) => {
  try {
    const tasksDir = join(BALANCE_CALCULATOR_PATH, 'src/tasks');
    const files = await fs.readdir(tasksDir);
    const tasks = files
      .filter(f => f.endsWith('.ts') && !f.includes('.test.'))
      .map(f => f.replace('.ts', ''))
      .filter(t => ['GetAddressOwnRealToken', 'GetBalancesREG', 'ClassementREG', 'CalculatePowerVotingREG'].includes(t));
    
    res.json({ tasks });
  } catch (error) {
    console.error('Error listing tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', balanceCalculatorPath: BALANCE_CALCULATOR_PATH });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📁 Balance calculator path: ${BALANCE_CALCULATOR_PATH}`);
  console.log(`🌐 Backend API available at http://0.0.0.0:${PORT}`);
});

