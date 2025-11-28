<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/dataStore'
import { api, type GeneratedFile, type Task } from '@/services/api'
import Papa from 'papaparse'

const router = useRouter()
const dataStore = useDataStore()

// État de l'application
const configText = ref<string>('')
const isLoadingConfig = ref(false)
const isGenerating = ref(false)
const generationOutput = ref<string>('')
const generationError = ref<string>('')
const generatedFiles = ref<GeneratedFile[]>([])
const isServerAvailable = ref(false)

// Initialiser les dates par défaut (aujourd'hui)
const today = new Date().toISOString().split('T')[0]

// Options unifiées pour la génération
const generationOptions = ref({
  // Ce qu'on veut générer
  generateBalances: true,
  generatePowerVoting: true,
  generateClassement: false,
  
  // Dates
  startDate: today,
  endDate: today,
  snapshotTime: '00:00',
  
  // Réseaux et DEX
  useMock: false,
  networks: ['gnosis', 'ethereum', 'polygon'],
  
  // Options pour balances
  targetAddress: 'all',
  calculationType: 'sum', // sum ou average
  
  // Options pour power voting
  powerVotingModel: 'linearModel',
  batchSize: '1000',
  previousPowerVotingFile: 'none',
  
  // Options avancées
  useTempFile: false,
  tempFile: '',
})

// Fonction pour vérifier la santé du serveur avec retry
const checkServerHealthWithRetry = async (maxRetries = 10, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const isAvailable = await api.checkHealth()
      if (isAvailable) {
        console.log(`✅ Backend disponible après ${i + 1} tentative(s)`)
        return true
      }
    } catch (error) {
      console.log(`⏳ Tentative ${i + 1}/${maxRetries} échouée, nouvelle tentative dans ${delay}ms...`)
    }
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  console.error('❌ Backend non disponible après', maxRetries, 'tentatives')
  return false
}

// Charger les tâches disponibles et la config par défaut
onMounted(async () => {
  try {
    isServerAvailable.value = await checkServerHealthWithRetry()
    if (!isServerAvailable.value) {
      generationError.value = 'Le serveur backend n\'est pas disponible. Vérifiez les logs Docker: docker compose logs'
      return
    }

    isLoadingConfig.value = true
    try {
      const defaultConfig = await api.getDefaultConfig()
      configText.value = defaultConfig
    } catch (error) {
      console.error('Error loading config:', error)
      // Charger une configuration par défaut si l'API échoue
      configText.value = `import { NormalizeOptions } from "../types/inputModles.types.js";
import dexConfig from "./dex.json" assert { type: "json" };

export const optionsModifiers: NormalizeOptions = {
  excludeAddresses: [],
  boostBalancesDexs: {},
  boostBalancesIncentivesVault: 1,
  boostBalancesWallet: 1,
  balanceKey: "totalBalance",
  zeroforced: 1,
};`
    }
    isLoadingConfig.value = false

    await refreshGeneratedFiles()
  } catch (error) {
    console.error('Error loading initial data:', error)
    generationError.value = error instanceof Error ? error.message : 'Erreur lors du chargement'
  }
})

// Rafraîchir la liste des fichiers générés
const refreshGeneratedFiles = async () => {
  try {
    generatedFiles.value = await api.getGeneratedFiles()
  } catch (error) {
    console.error('Error refreshing files:', error)
  }
}

// Générer les fichiers
const handleGenerate = async () => {
  if (!generationOptions.value.generateBalances && !generationOptions.value.generatePowerVoting) {
    generationError.value = 'Veuillez sélectionner au moins une option à générer (Balances ou Power Voting)'
    return
  }

  if (!generationOptions.value.startDate || !generationOptions.value.endDate) {
    generationError.value = 'Veuillez renseigner les dates de début et de fin'
    return
  }

  isGenerating.value = true
  generationError.value = ''
  generationOutput.value = ''
  generationOutput.value = '🚀 Démarrage de la génération...\n\n'

  try {
    let lastBalanceFile = ''

    // Étape 1: Générer les balances si demandé
    if (generationOptions.value.generateBalances) {
      generationOutput.value += '📊 Étape 1/2: Génération des balances REG...\n'
      
      const balanceOptions = {
        tempData: generationOptions.value.useTempFile ? generationOptions.value.tempFile : '',
        useMock: generationOptions.value.useMock,
        networks: generationOptions.value.networks,
        startDate: generationOptions.value.startDate,
        endDate: generationOptions.value.endDate,
        snapshotTime: generationOptions.value.snapshotTime,
        targetAddress: generationOptions.value.targetAddress,
        calculationType: generationOptions.value.calculationType,
      }

      const balanceResponse = await api.generate({
        task: 'GetBalancesREG',
        config: configText.value,
        options: balanceOptions,
      })

      if (balanceResponse.success) {
        generationOutput.value += '✅ Balances générées avec succès!\n'
        generationOutput.value += balanceResponse.output || ''
        // Le fichier sera détecté automatiquement pour la prochaine étape
        lastBalanceFile = balanceResponse.outputFile || ''
      } else {
        generationError.value = `Erreur lors de la génération des balances: ${balanceResponse.error}`
        generationOutput.value += `❌ Erreur: ${balanceResponse.error}\n`
        return
      }
    }

    // Étape 2: Générer le power voting si demandé
    if (generationOptions.value.generatePowerVoting) {
      const stepNumber = generationOptions.value.generateBalances ? '2/2' : '1/1'
      generationOutput.value += `\n⚡ Étape ${stepNumber}: Génération du Power Voting...\n`
      
      // Si les balances ont été générées, utiliser automatiquement le fichier généré
      if (lastBalanceFile) {
        generationOutput.value += `📁 Utilisation du fichier balances généré: ${lastBalanceFile.split('/').pop() || lastBalanceFile}\n`
      } else {
        generationOutput.value += '📁 Recherche du fichier balances le plus récent...\n'
      }
      
      const powerVotingOptions = {
        balancesJsonFile: lastBalanceFile || '', // Utilise le fichier généré si disponible, sinon sera détecté automatiquement
        inputModel: '', // Sera détecté automatiquement
        powerVotingModel: generationOptions.value.powerVotingModel,
        previousPowerVotingFile: generationOptions.value.previousPowerVotingFile,
        batchSize: generationOptions.value.batchSize,
      }

      const powerVotingResponse = await api.generate({
        task: 'CalculatePowerVotingREG',
        config: configText.value,
        options: powerVotingOptions,
      })

      if (powerVotingResponse.success) {
        generationOutput.value += '✅ Power Voting généré avec succès!\n'
        generationOutput.value += powerVotingResponse.output || ''
      } else {
        generationError.value = `Erreur lors de la génération du Power Voting: ${powerVotingResponse.error}`
        generationOutput.value += `❌ Erreur: ${powerVotingResponse.error}\n`
      }
    }

    // Étape 3: Générer le classement si demandé
    if (generationOptions.value.generateClassement) {
      generationOutput.value += '\n📈 Étape 3/3: Génération du classement...\n'
      
      const classementOptions = {
        balancesFile: lastBalanceFile || '',
      }

      const classementResponse = await api.generate({
        task: 'ClassementREG',
        config: configText.value,
        options: classementOptions,
      })

      if (classementResponse.success) {
        generationOutput.value += '✅ Classement généré avec succès!\n'
        generationOutput.value += classementResponse.output || ''
      } else {
        generationError.value = `Erreur lors de la génération du classement: ${classementResponse.error}`
        generationOutput.value += `❌ Erreur: ${classementResponse.error}\n`
      }
    }

    generationOutput.value += '\n🎉 Génération terminée!'
    await refreshGeneratedFiles()
    
    // Charger automatiquement les fichiers générés dans le store et rediriger vers upload
    await loadGeneratedFilesToStore()
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : 'Erreur lors de la génération'
  } finally {
    isGenerating.value = false
  }
}

// Télécharger un fichier
const downloadFile = async (file: GeneratedFile) => {
  try {
    const blob = await api.downloadFile(file.name)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading file:', error)
    generationError.value = 'Erreur lors du téléchargement'
  }
}

// Charger un fichier généré dans l'interface
const loadGeneratedFile = async (file: GeneratedFile) => {
  try {
    const blob = await api.downloadFile(file.name)
    const text = await blob.text()

    let data: any
    if (file.type === 'json') {
      data = JSON.parse(text)
    } else {
      // CSV
      const parsed = Papa.parse(text, { header: true, dynamicTyping: true })
      data = parsed.data
    }

    // Déterminer si c'est un fichier balance ou powerVoting
    const isBalance = file.name.toLowerCase().includes('balance')
    const isPowerVoting = file.name.toLowerCase().includes('power')

    if (isBalance) {
      dataStore.setBalancesData(data)
    } else if (isPowerVoting) {
      dataStore.setPowerVotingData(data)
    } else {
      // Essayer de détecter automatiquement
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0]
        if ('totalBalanceREG' in firstItem || 'totalBalance' in firstItem) {
          dataStore.setBalancesData(data)
        } else if ('powerVoting' in firstItem || 'address' in firstItem) {
          dataStore.setPowerVotingData(data)
        }
      }
    }
  } catch (error) {
    console.error('Error loading file:', error)
    generationError.value = 'Erreur lors du chargement du fichier'
  }
}

// Charger automatiquement les fichiers générés les plus récents dans le store
const loadGeneratedFilesToStore = async () => {
  try {
    await refreshGeneratedFiles()
    
    // Trouver les fichiers les plus récents
    const latestBalanceFile = balanceFiles.value.length > 0 
      ? balanceFiles.value.sort((a, b) => 
          new Date(b.modified).getTime() - new Date(a.modified).getTime()
        )[0]
      : null
    
    const latestPowerVotingFile = powerVotingFiles.value.length > 0
      ? powerVotingFiles.value.sort((a, b) => 
          new Date(b.modified).getTime() - new Date(a.modified).getTime()
        )[0]
      : null

    // Charger les fichiers si disponibles
    if (latestBalanceFile && generationOptions.value.generateBalances) {
      await loadGeneratedFile(latestBalanceFile)
      generationOutput.value += `\n✅ Fichier balance chargé: ${latestBalanceFile.name}\n`
    }

    if (latestPowerVotingFile && generationOptions.value.generatePowerVoting) {
      await loadGeneratedFile(latestPowerVotingFile)
      generationOutput.value += `✅ Fichier power voting chargé: ${latestPowerVotingFile.name}\n`
    }

    // Rediriger vers upload après un court délai avec un paramètre pour indiquer qu'on vient de la génération
    generationOutput.value += '\n🚀 Redirection vers la page d\'upload...\n'
    setTimeout(() => {
      router.push({ path: '/upload', query: { fromGeneration: 'true' } })
    }, 1500)
  } catch (error) {
    console.error('Error loading generated files to store:', error)
    generationError.value = 'Erreur lors du chargement automatique des fichiers'
  }
}

// Filtrer les fichiers par type
const balanceFiles = computed(() => 
  generatedFiles.value.filter(f => f.name.toLowerCase().includes('balance'))
)
const powerVotingFiles = computed(() => 
  generatedFiles.value.filter(f => f.name.toLowerCase().includes('power'))
)

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('fr-FR')
}

const apiUrl = computed(() => {
  // Détecter automatiquement l'URL de l'API
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    return `${protocol}//${host}:3001`;
  }
  
  return 'http://localhost:3001';
})

const reloadPage = () => {
  window.location.reload()
}
</script>

<template>
  <div class="generation-view">
    <div class="generation-header">
      <h2>⚙️ Génération des données</h2>
      <p>Configurez et générez les fichiers balances REG et power voting</p>
    </div>

    <div v-if="!isServerAvailable" class="error-card">
      <h3>⚠️ Serveur backend non disponible</h3>
      <p>Le serveur backend n'est pas accessible. Vérifiez que :</p>
      <ul style="text-align: left; margin: 1rem 0; padding-left: 2rem; color: var(--text-secondary);">
        <li>Le container Docker est démarré : <code style="background: var(--glass-bg); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">docker compose ps</code></li>
        <li>Le backend écoute sur le port 3001 : <code style="background: var(--glass-bg); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">curl http://localhost:3001/api/health</code></li>
        <li>Consultez les logs : <code style="background: var(--glass-bg); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">docker compose logs app</code></li>
      </ul>
      <p style="margin-top: 1rem; color: var(--text-secondary);">
        <strong>URL de l'API attendue :</strong> 
        <code style="background: var(--glass-bg); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">{{ apiUrl }}</code>
      </p>
      <button @click="reloadPage" class="btn btn-secondary" style="margin-top: 1rem;">
        🔄 Réessayer
      </button>
    </div>

    <div v-else class="generation-container">
      <!-- Configuration -->
      <div class="config-section">
        <div class="section-header">
          <h3>📝 Configuration (optionsModifiers.ts)</h3>
          <button @click="refreshGeneratedFiles" class="btn-refresh">🔄 Actualiser</button>
        </div>
        <div class="config-editor">
          <textarea
            v-model="configText"
            class="config-textarea"
            placeholder="Configuration..."
            :disabled="isLoadingConfig"
          ></textarea>
          <div v-if="isLoadingConfig" class="loading-overlay">Chargement de la configuration...</div>
        </div>
      </div>

      <!-- Formulaire de génération unifié -->
      <div class="generation-form-section">
        <div class="section-header">
          <h3>🎯 Options de génération</h3>
        </div>

        <div class="generation-form">
          <!-- Ce qu'on veut générer -->
          <div class="form-section">
            <h4>📦 Fichiers à générer</h4>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="generationOptions.generateBalances" />
                <span>💰 Balances REG</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="generationOptions.generatePowerVoting" />
                <span>⚡ Power Voting</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="generationOptions.generateClassement" />
                <span>📊 Classement</span>
              </label>
            </div>
          </div>

          <!-- Dates -->
          <div class="form-section">
            <h4>📅 Période</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Date de début :</label>
                <input type="date" v-model="generationOptions.startDate" class="form-input" required />
              </div>
              <div class="form-group">
                <label>Date de fin :</label>
                <input type="date" v-model="generationOptions.endDate" class="form-input" required />
              </div>
              <div class="form-group">
                <label>Heure du snapshot :</label>
                <input type="time" v-model="generationOptions.snapshotTime" class="form-input" />
              </div>
            </div>
          </div>

          <!-- Options pour balances -->
          <div class="form-section" v-if="generationOptions.generateBalances">
            <h4>⚙️ Options Balances</h4>
            <div class="form-row">
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="generationOptions.useMock" />
                  Utiliser des données de test (mock)
                </label>
              </div>
            </div>
            
            <div v-if="!generationOptions.useMock" class="form-group">
              <label>Réseaux à analyser :</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="generationOptions.networks" value="gnosis" />
                  <span>Gnosis</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="generationOptions.networks" value="ethereum" />
                  <span>Ethereum</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="generationOptions.networks" value="polygon" />
                  <span>Polygon</span>
                </label>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Adresse cible (ou "all") :</label>
                <input 
                  type="text" 
                  v-model="generationOptions.targetAddress" 
                  class="form-input"
                  placeholder="0x... ou all"
                />
              </div>
              <div class="form-group">
                <label>Type de calcul :</label>
                <select v-model="generationOptions.calculationType" class="form-input">
                  <option value="sum">Somme</option>
                  <option value="average">Moyenne</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Options pour power voting -->
          <div class="form-section" v-if="generationOptions.generatePowerVoting">
            <h4>⚡ Options Power Voting</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Modèle :</label>
                <select v-model="generationOptions.powerVotingModel" class="form-input" required>
                  <option value="linearModel">Linear Model</option>
                  <option value="exponentialModel">Exponential Model</option>
                </select>
              </div>
              <div class="form-group">
                <label>Taille du batch :</label>
                <input 
                  type="number" 
                  v-model="generationOptions.batchSize" 
                  class="form-input"
                  min="1"
                  required
                />
              </div>
            </div>
            <div class="form-group">
              <label>Fichier power voting précédent (optionnel) :</label>
              <input 
                type="text" 
                v-model="generationOptions.previousPowerVotingFile" 
                class="form-input"
                placeholder="powerVotingREG_*.json ou 'none'"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Bouton de génération -->
      <div class="generate-section">
        <button
          @click="handleGenerate"
          :disabled="isGenerating || isLoadingConfig || (!generationOptions.generateBalances && !generationOptions.generatePowerVoting)"
          class="btn btn-primary btn-generate"
        >
          <span v-if="!isGenerating">🚀 Générer les fichiers</span>
          <span v-else class="loading">⏳ Génération en cours...</span>
        </button>
        <p v-if="!generationOptions.generateBalances && !generationOptions.generatePowerVoting" class="form-hint">
          ⚠️ Veuillez sélectionner au moins "Balances REG" ou "Power Voting" à générer
        </p>
      </div>

      <!-- Output de génération -->
      <div v-if="generationOutput || generationError" class="output-section">
        <div v-if="generationError" class="error-message">
          <h4>❌ Erreur</h4>
          <pre>{{ generationError }}</pre>
        </div>
        <div v-if="generationOutput" class="success-message">
          <h4>✅ Sortie</h4>
          <pre>{{ generationOutput }}</pre>
        </div>
      </div>

      <!-- Fichiers générés -->
      <div class="files-section">
        <div class="section-header">
          <h3>📁 Fichiers générés</h3>
          <button @click="refreshGeneratedFiles" class="btn-refresh">🔄 Actualiser</button>
        </div>

        <div v-if="generatedFiles.length === 0" class="no-files">
          <p>Aucun fichier généré pour le moment.</p>
        </div>

        <div v-else class="files-grid">
          <!-- Fichiers Balance -->
          <div class="file-category">
            <h4>💰 Balances REG</h4>
            <div v-if="balanceFiles.length === 0" class="no-files-category">
              <p>Aucun fichier balance généré</p>
            </div>
            <div v-else class="file-list">
              <div
                v-for="file in balanceFiles"
                :key="file.name"
                class="file-item"
              >
                <div class="file-info">
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-meta">{{ formatFileSize(file.size) }} • {{ formatDate(file.modified) }}</span>
                </div>
                <div class="file-actions">
                  <button @click="downloadFile(file)" class="btn-icon" title="Télécharger">
                    📥
                  </button>
                  <button @click="loadGeneratedFile(file)" class="btn-icon btn-load" title="Charger dans l'interface">
                    📂
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Fichiers Power Voting -->
          <div class="file-category">
            <h4>⚡ Power Voting</h4>
            <div v-if="powerVotingFiles.length === 0" class="no-files-category">
              <p>Aucun fichier power voting généré</p>
            </div>
            <div v-else class="file-list">
              <div
                v-for="file in powerVotingFiles"
                :key="file.name"
                class="file-item"
              >
                <div class="file-info">
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-meta">{{ formatFileSize(file.size) }} • {{ formatDate(file.modified) }}</span>
                </div>
                <div class="file-actions">
                  <button @click="downloadFile(file)" class="btn-icon" title="Télécharger">
                    📥
                  </button>
                  <button @click="loadGeneratedFile(file)" class="btn-icon btn-load" title="Charger dans l'interface">
                    📂
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="navigation-section">
        <button @click="router.push('/upload')" class="btn btn-secondary">
          ← Retour à l'upload
        </button>
        <button
          v-if="dataStore.balances.length > 0 && dataStore.powerVoting.length > 0"
          @click="router.push('/analysis')"
          class="btn btn-primary"
        >
          Aller à l'analyse →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.generation-view {
  animation: fadeIn 0.5s ease;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.generation-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.generation-header h2 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.generation-header p {
  color: var(--text-secondary);
  font-size: 1.125rem;
}

.error-card {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--error-color);
  border-radius: 1rem;
  padding: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

.error-card h3 {
  color: var(--error-color);
  margin-bottom: 1rem;
}

.generation-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.config-section,
.generation-form-section,
.generate-section,
.output-section,
.files-section {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: var(--shadow-lg);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-size: 1.5rem;
  color: var(--text-primary);
}

.btn-refresh {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
}

.btn-refresh:hover {
  background: var(--bg-secondary);
  border-color: var(--primary-color);
}

.config-editor {
  position: relative;
}

.config-textarea {
  width: 100%;
  min-height: 400px;
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  resize: vertical;
}

.config-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 1rem 2rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
}

.generation-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  padding: 1.5rem;
  background: var(--glass-bg);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
}

.form-section h4 {
  margin: 0 0 1.5rem 0;
  font-size: 1.125rem;
  color: var(--text-primary);
  font-weight: 600;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.form-hint {
  margin-top: 0.75rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.form-input {
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}

.checkbox-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  font-weight: normal;
  cursor: pointer;
  padding: 0.5rem 1rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.checkbox-label:hover {
  border-color: var(--primary-color);
  background: var(--bg-tertiary);
}

.checkbox-label input[type="checkbox"] {
  margin-right: 0.5rem;
}

.btn-generate {
  width: 100%;
  padding: 1.25rem;
  font-size: 1.125rem;
}

.output-section pre {
  background: var(--glass-bg);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
}

.error-message {
  margin-bottom: 1rem;
}

.error-message h4 {
  color: var(--error-color);
  margin-bottom: 0.5rem;
}

.success-message h4 {
  color: #22c55e;
  margin-bottom: 0.5rem;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.file-category h4 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.no-files,
.no-files-category {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.file-item:hover {
  border-color: var(--primary-color);
  background: var(--bg-tertiary);
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.file-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.125rem;
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--primary-color);
  border-color: var(--primary-color);
  transform: scale(1.1);
}

.btn-load {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.navigation-section {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  box-shadow: var(--shadow-md);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-secondary);
  border-color: var(--primary-color);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .generation-view {
    padding: 1rem;
  }

  .files-grid {
    grid-template-columns: 1fr;
  }

  .navigation-section {
    flex-direction: column;
  }
}
</style>

