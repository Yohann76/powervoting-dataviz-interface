<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/dataStore'
import { loadSnapshotManifest, loadSnapshot, type SnapshotInfo } from '@/utils/snapshotLoader'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js'

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
)

const router = useRouter()
const dataStore = useDataStore()
const expandedWallets = ref<Record<string, boolean>>({})
const availableSnapshots = ref<SnapshotInfo[]>([])
const selectedComparisonSnapshot = ref<string | null>(null)
const isLoadingComparison = ref(false)

onMounted(async () => {
  if (dataStore.balances.length === 0 || dataStore.powerVoting.length === 0) {
    router.push('/')
    return
  }

  try {
    availableSnapshots.value = await loadSnapshotManifest()
  } catch (err) {
    console.error('Failed to load snapshots:', err)
  }
})

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

const formatInteger = (num: number) => {
  return new Intl.NumberFormat('fr-FR').format(Math.round(num))
}

const isWalletExpanded = (address: string) => {
  return !!expandedWallets.value[address]
}

const toggleWalletPositions = (address: string) => {
  expandedWallets.value[address] = !isWalletExpanded(address)
}

const formatAddress = (address: string) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

const formatSnapshotDate = (dateStr: string) => {
  const [day, month, year] = dateStr.split('-')
  return new Date(`${year}-${month}-${day}`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const loadComparisonSnapshot = async () => {
  if (!selectedComparisonSnapshot.value) return

  isLoadingComparison.value = true
  try {
    const snapshot = availableSnapshots.value.find((s) => s.date === selectedComparisonSnapshot.value)
    if (!snapshot) return

    const { balances, powerVoting } = await loadSnapshot(snapshot)
    dataStore.setComparisonSnapshot({
      balances,
      powerVoting,
      date: snapshot.date,
    })
  } catch (err) {
    console.error('Failed to load comparison snapshot:', err)
  } finally {
    isLoadingComparison.value = false
  }
}

const clearComparison = () => {
  dataStore.clearComparisonSnapshot()
  selectedComparisonSnapshot.value = null
}

// Chart data
const balanceDistributionChartData = computed(() => {
  const dist = dataStore.balanceDistribution
  if (!dist) return null

  return {
    labels: dist.map((b) => b.label),
    datasets: [
      {
        label: 'Nombre de wallets',
        data: dist.map((b) => b.count),
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(14, 165, 233, 0.8)',
        ],
        borderColor: [
          'rgb(99, 102, 241)',
          'rgb(139, 92, 246)',
          'rgb(236, 72, 153)',
          'rgb(251, 146, 60)',
          'rgb(34, 197, 94)',
          'rgb(14, 165, 233)',
        ],
        borderWidth: 2,
      },
    ],
  }
})

const powerVotingDistributionChartData = computed(() => {
  const dist = dataStore.powerVotingDistribution
  if (!dist) return null

  return {
    labels: dist.map((b) => b.label),
    datasets: [
      {
        label: "Nombre d'adresses",
        data: dist.map((b) => b.count),
        backgroundColor: [
          'rgba(236, 72, 153, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(99, 102, 241, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderColor: [
          'rgb(236, 72, 153)',
          'rgb(251, 146, 60)',
          'rgb(34, 197, 94)',
          'rgb(14, 165, 233)',
          'rgb(99, 102, 241)',
          'rgb(139, 92, 246)',
        ],
        borderWidth: 2,
      },
    ],
  }

})

const poolsDistributionChartData = computed(() => {
  const analysis = dataStore.poolAnalysis
  if (!analysis) return null

  return {
    labels: ['Pools V2', 'Pools V3'],
    datasets: [
      {
        data: [analysis.v2.totalREG, analysis.v3.totalREG],
        backgroundColor: ['rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.8)'],
        borderColor: ['rgb(139, 92, 246)', 'rgb(236, 72, 153)'],
        borderWidth: 2
      }
    ]
  }
})

const dexsDistributionChartData = computed(() => {
  const analysis = dataStore.poolAnalysis
  if (!analysis) return null

  // Merge DEXs from V2 and V3
  const allDexs = new Set([
    ...Object.keys(analysis.v2.dexs),
    ...Object.keys(analysis.v3.dexs)
  ])

  const labels = Array.from(allDexs)
  const data = labels.map(dex => {
    return (analysis.v2.dexs[dex] || 0) + (analysis.v3.dexs[dex] || 0)
  })

  return {
    labels,
    datasets: [
      {
        label: 'Total REG',
        data,
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(99, 102, 241, 0.8)'
        ],
        borderWidth: 0
      }
    ]
  }
})

const poolPowerChartData = computed(() => {
  const correlation = dataStore.poolPowerCorrelation
  if (!correlation || correlation.length === 0) return null

  const topEntries = correlation.slice(0, 25)
  const labels = topEntries.map((entry) => formatAddress(entry.address))

  const ratioPools = topEntries.map((entry) => {
    if (entry.poolLiquidityREG <= 0) return 0
    return entry.poolVotingShare / entry.poolLiquidityREG
  })

  const ratioTotal = topEntries.map((entry) => {
    const totalREG = entry.walletDirectREG + entry.poolLiquidityREG
    if (totalREG <= 0) return 0
    // Option A: Ratio total sur REG total (wallet + pools) pour montrer le multiplicateur moyen
    return entry.powerVoting / totalREG
  })

  const baseline = topEntries.map((entry) => (entry.poolLiquidityREG > 0 ? 1 : 0))

  return {
    labels,
    datasets: [
      {
        label: 'Boost pools (Power ÷ REG)',
        data: ratioPools,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        tension: 0.25,
        fill: false,
        pointRadius: 4,
      },
      {
        label: 'Multiplicateur moyen global (wallet 1:1 + pools boostés)',
        data: ratioTotal,
        borderColor: 'rgba(236, 72, 153, 1)',
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        tension: 0.25,
        fill: false,
        pointRadius: 4,
      },
      {
        label: 'Référence 1:1',
        data: baseline,
        borderColor: 'rgba(148, 163, 184, 0.8)',
        borderDash: [8, 6],
        tension: 0,
        fill: false,
        pointRadius: 0,
      },
    ],
  }
})

const tooltipCallbacks = {
  label(context: any) {
    const datasetLabel = context.dataset?.label || ''
    const rawValue = Number(context.raw ?? 0)
    const isCountDataset = /wallet|adresse|nombre|count/i.test(datasetLabel)
    const formatter = isCountDataset ? formatInteger : formatNumber
    const formatted = formatter(rawValue)
    if (!datasetLabel) return formatted
    return `${datasetLabel}: ${formatted}`
  },
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      labels: {
        color: '#cbd5e1',
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      callbacks: tooltipCallbacks,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        color: '#cbd5e1',
      },
      grid: {
        color: 'rgba(51, 65, 85, 0.3)',
      },
    },
    x: {
      ticks: {
        color: '#cbd5e1',
      },
      grid: {
        color: 'rgba(51, 65, 85, 0.3)',
      },
    },
  },
}

const countChartOptions = {
  ...chartOptions,
  scales: {
    ...chartOptions.scales,
    y: {
      ...chartOptions.scales.y,
      ticks: {
        ...chartOptions.scales.y.ticks,
        callback: (value: number) => formatInteger(Number(value)),
      },
    },
  },
}

const poolPowerChartOptions = {
  ...chartOptions,
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      ticks: {
        color: '#cbd5e1',
      },
      grid: {
        color: 'rgba(51, 65, 85, 0.3)',
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        color: '#cbd5e1',
      },
      grid: {
        color: 'rgba(51, 65, 85, 0.25)',
      },
    },
  },
}
</script>

<template>
  <div class="analysis-view" v-if="dataStore.balances.length > 0">
    <div class="analysis-header">
      <h2>📊 Analyse des données</h2>
      <p>Exploration et visualisation des balances REG et du pouvoir de vote</p>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-grid">
      <div class="stat-card balance-card">
        <div class="stat-header">
          <h3>💰 Balances REG</h3>
        </div>
        <div class="stat-content" v-if="dataStore.balanceStats">
          <div class="stat-item">
            <span class="stat-label">Total</span>
            <span class="stat-value">{{ formatNumber(dataStore.balanceStats.total) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Moyenne</span>
            <span class="stat-value">{{ formatNumber(dataStore.balanceStats.mean) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Médiane</span>
            <span class="stat-value">{{ formatNumber(dataStore.balanceStats.median) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Min / Max</span>
            <span class="stat-value">
              {{ formatNumber(dataStore.balanceStats.min) }} /
              {{ formatNumber(dataStore.balanceStats.max) }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Écart-type</span>
            <span class="stat-value">{{ formatNumber(dataStore.balanceStats.stdDev) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Nb wallets</span>
            <span class="stat-value">{{ dataStore.balanceStats.count }}</span>
          </div>
        </div>
      </div>

      <div class="stat-card power-card">
        <div class="stat-header">
          <h3>⚡ Power Voting</h3>
        </div>
        <div class="stat-content" v-if="dataStore.powerVotingStats">
          <div class="stat-item">
            <span class="stat-label">Total</span>
            <span class="stat-value">{{ formatNumber(dataStore.powerVotingStats.total) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Moyenne</span>
            <span class="stat-value">{{ formatNumber(dataStore.powerVotingStats.mean) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Médiane</span>
            <span class="stat-value">{{ formatNumber(dataStore.powerVotingStats.median) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Min / Max</span>
            <span class="stat-value">
              {{ formatNumber(dataStore.powerVotingStats.min) }} /
              {{ formatNumber(dataStore.powerVotingStats.max) }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Écart-type</span>
            <span class="stat-value">{{ formatNumber(dataStore.powerVotingStats.stdDev) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Nb adresses</span>
            <span class="stat-value">{{ dataStore.powerVotingStats.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="chart-card">
        <h3>📈 Distribution des Balances REG</h3>
        <div class="chart-container" v-if="balanceDistributionChartData">
          <Bar :data="balanceDistributionChartData" :options="countChartOptions" />
        </div>
      </div>

      <div class="chart-card">
        <h3>📊 Distribution du Power Voting</h3>
        <div class="chart-container" v-if="powerVotingDistributionChartData">
          <Bar :data="powerVotingDistributionChartData" :options="countChartOptions" />
        </div>
      </div>
    </div>

    <p class="chart-note" v-if="balanceDistributionChartData">
      Chaque barre représente une tranche de balances REG (axe horizontal). La hauteur de la barre
      indique combien de wallets se situent dans cette tranche (axe vertical). Exemple : « 100‑500 »
      signifie “4 845 wallets détiennent entre 100 et 500 REG équivalents”.
    </p>

    <!-- Pools Analysis Section -->
    <div class="section-header">
      <h2>🌊 Analyse Pools V2 & V3</h2>
      <p>Répartition de la liquidité et impact sur le Power Voting</p>
    </div>

    <div class="stats-grid" v-if="dataStore.poolAnalysis">
      <div class="stat-card v2-card">
        <div class="stat-header">
          <h3>💧 Pools V2</h3>
        </div>
        <div class="stat-content">
          <div class="stat-item">
            <span class="stat-label">Total REG</span>
            <span class="stat-value">{{ formatNumber(dataStore.poolAnalysis.v2.totalREG) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Nb Positions</span>
            <span class="stat-value">{{ dataStore.poolAnalysis.v2.count }}</span>
          </div>
        </div>
      </div>

      <div class="stat-card v3-card">
        <div class="stat-header">
          <h3>🦄 Pools V3</h3>
        </div>
        <div class="stat-content">
          <div class="stat-item">
            <span class="stat-label">Total REG</span>
            <span class="stat-value">{{ formatNumber(dataStore.poolAnalysis.v3.totalREG) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Nb Positions</span>
            <span class="stat-value">{{ dataStore.poolAnalysis.v3.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <h3>🥧 Répartition V2 vs V3</h3>
        <div class="chart-container" v-if="poolsDistributionChartData">
          <Doughnut :data="poolsDistributionChartData" :options="chartOptions" />
        </div>
      </div>

      <div class="chart-card">
        <h3>🏦 Répartition par DEX</h3>
        <div class="chart-container" v-if="dexsDistributionChartData">
          <Bar :data="dexsDistributionChartData" :options="chartOptions" />
        </div>
      </div>
    </div>

    <div class="section-header">
      <h2>🔗 Corrélation Pools & Power Voting</h2>
      <p>
        Les courbes comparent désormais des ratios (Power ÷ REG en pool) à la ligne 1 : 1, ce qui
        permet de visualiser instantanément si une position LP surperforme ou non le boost attendu.
      </p>
    </div>

    <div class="charts-grid correlation-grid">
      <div class="chart-card full-width">
        <h3>📉 Efficacité des positions LP : Multiplicateurs Power ÷ REG par adresse</h3>
        <div class="chart-container" v-if="poolPowerChartData">
          <Line :data="poolPowerChartData" :options="poolPowerChartOptions" />
        </div>
        <div class="chart-empty" v-else>
          <p>Aucune adresse active en pool n'a été détectée.</p>
        </div>
      </div>
    </div>

    <div class="chart-explainer">
      <p>
        Cette visualisation trace trois ratios :
        <strong>Boost pools</strong> (power réellement issu des pools ÷ REG en pool),
        <strong>Power total ÷ REG total</strong> (power total ÷ (REG wallet + REG en pool)) et la
        <strong>ligne de référence 1 : 1</strong>. Lorsque les courbes bleue ou rose passent
        <em>au-dessus</em> de 1 : 1, cela signifie qu'une adresse obtient plus de pouvoir de vote
        que sa simple mise en REG (boost). Si elles sont <em>en dessous</em>, la position est moins
        efficace qu’un dépôt direct (décote / inéligibilité partielle). Les adresses sont triées par
        liquidité décroissante pour faciliter la comparaison.
      </p>
      <p class="axis-note">
        L'axe vertical (à gauche) représente ce multiplicateur (1x = parité parfaite).
        <strong>Ligne bleue</strong> : multiplicateur des pools uniquement (power pools ÷ REG en pool).
        <strong>Ligne rose</strong> : multiplicateur moyen sur tout le REG (power total ÷ REG total).
        Au-dessus de 1x → boost, en dessous → performance réduite.
      </p>
      <p class="axis-note">
        Rappel : avec la normalisation du boost V3, pour 1 REG dans un pool concentré, le boost final est de 5 (si MaxBoost = 5 et MinBoost = 1). Pour un range large, le boost est de 4 (équivalent au boost V2). Les deux courbes devraient être similaires car le wallet direct est à 1:1 (pas de boost), donc seul le boost des pools est visible.
      </p>
    </div>

    <div class="pool-wallet-summary" v-if="dataStore.poolWalletBreakdown">
      <div class="summary-item">
        <span class="summary-label">Wallets V2</span>
        <span class="summary-value">{{ formatInteger(dataStore.poolWalletBreakdown.v2Wallets) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Wallets V3</span>
        <span class="summary-value">{{ formatInteger(dataStore.poolWalletBreakdown.v3Wallets) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Wallets V2 &amp; V3</span>
        <span class="summary-value">{{ formatInteger(dataStore.poolWalletBreakdown.both) }}</span>
      </div>
    </div>

    <div
      class="correlation-table"
      v-if="dataStore.poolPowerCorrelation && dataStore.poolPowerCorrelation.length"
    >
      <div
        class="correlation-row"
        v-for="profile in dataStore.poolPowerCorrelation.slice(0, 15)"
        :key="profile.address"
      >
        <div class="row-main">
          <div class="address-block">
            <span class="address-short">{{ formatAddress(profile.address) }}</span>
            <span class="address-full">{{ profile.address }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Liquidité en pools</span>
            <span class="metric-value">{{ formatNumber(profile.poolLiquidityREG) }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Power total</span>
            <span class="metric-value">{{ formatNumber(profile.powerVoting) }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Boost vs 1:1</span>
            <span class="metric-value">
              {{ profile.boostMultiplier ? profile.boostMultiplier.toFixed(2) + 'x' : '–' }}
            </span>
          </div>
          <div class="metric positions-count">
            <span class="metric-label">Positions</span>
            <span class="metric-value">{{ profile.positions.length }}</span>
          </div>
          <button
            class="positions-toggle"
            @click="toggleWalletPositions(profile.address)"
          >
            {{ isWalletExpanded(profile.address) ? 'Masquer les détails' : 'Afficher les détails' }}
          </button>
        </div>
        <div class="row-details" v-if="isWalletExpanded(profile.address)">
          <div class="detail-metrics">
            <div class="metric">
              <span class="metric-label">Power (attribué pools)</span>
              <span class="metric-value">{{ formatNumber(profile.poolVotingShare) }}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Wallet hors pools</span>
              <span class="metric-value">{{ formatNumber(profile.walletDirectREG) }}</span>
            </div>
          </div>
          <div class="positions-list">
            <div
              class="position-pill"
              v-for="position in profile.positions"
              :key="`${profile.address}-${position.poolAddress || 'pool'}-${position.dex}-${position.regAmount}`"
            >
              <span class="pill-dex">{{ position.dex }} • {{ position.poolType.toUpperCase() }}</span>
              <span class="pill-pool">
                {{ position.poolAddress ? formatAddress(position.poolAddress) : 'N/A' }}
              </span>
              <span class="pill-value">{{ formatNumber(position.regAmount) }} REG</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Snapshot Comparison -->
    <div class="section-header">
      <h2>📊 Comparaison avec snapshot historique</h2>
      <p>Comparez les métriques actuelles avec un snapshot précédent</p>
    </div>

    <div class="comparison-section" v-if="availableSnapshots.length > 0">
      <div class="comparison-controls">
        <select
          v-model="selectedComparisonSnapshot"
          @change="loadComparisonSnapshot"
          :disabled="isLoadingComparison"
          class="comparison-select"
        >
          <option value="">-- Sélectionner un snapshot --</option>
          <option
            v-for="snapshot in availableSnapshots"
            :key="snapshot.date"
            :value="snapshot.date"
          >
            {{ formatSnapshotDate(snapshot.date) }}
          </option>
        </select>
        <button
          v-if="dataStore.snapshotComparison"
          @click="clearComparison"
          class="btn-clear-comparison"
        >
          ✕ Effacer la comparaison
        </button>
      </div>

      <div v-if="dataStore.snapshotComparison" class="comparison-results">
        <div class="comparison-card">
          <h3>📈 Différences</h3>
          <div class="comparison-grid">
            <div class="comparison-item">
              <div class="comparison-label">Nombre de holders</div>
              <div class="comparison-values">
                <span class="comparison-current">{{ formatInteger(dataStore.snapshotComparison.current.holders) }}</span>
                <span class="comparison-arrow">→</span>
                <span class="comparison-diff" :class="dataStore.snapshotComparison.diff.holders >= 0 ? 'positive' : 'negative'">
                  {{ dataStore.snapshotComparison.diff.holders >= 0 ? '+' : '' }}{{ formatInteger(dataStore.snapshotComparison.diff.holders) }}
                </span>
              </div>
              <div class="comparison-reference">
                Snapshot du {{ formatSnapshotDate(dataStore.snapshotComparison.date) }}: {{ formatInteger(dataStore.snapshotComparison.comparison.holders) }}
              </div>
            </div>

            <div class="comparison-item">
              <div class="comparison-label">Wallets en pools</div>
              <div class="comparison-values">
                <span class="comparison-current">{{ formatInteger(dataStore.snapshotComparison.current.poolWallets) }}</span>
                <span class="comparison-arrow">→</span>
                <span class="comparison-diff" :class="dataStore.snapshotComparison.diff.poolWallets >= 0 ? 'positive' : 'negative'">
                  {{ dataStore.snapshotComparison.diff.poolWallets >= 0 ? '+' : '' }}{{ formatInteger(dataStore.snapshotComparison.diff.poolWallets) }}
                </span>
              </div>
              <div class="comparison-reference">
                Snapshot du {{ formatSnapshotDate(dataStore.snapshotComparison.date) }}: {{ formatInteger(dataStore.snapshotComparison.comparison.poolWallets) }}
              </div>
            </div>

            <div class="comparison-item">
              <div class="comparison-label">Power Voting total</div>
              <div class="comparison-values">
                <span class="comparison-current">{{ formatNumber(dataStore.snapshotComparison.current.totalPower) }}</span>
                <span class="comparison-arrow">→</span>
                <span class="comparison-diff" :class="dataStore.snapshotComparison.diff.totalPower >= 0 ? 'positive' : 'negative'">
                  {{ dataStore.snapshotComparison.diff.totalPower >= 0 ? '+' : '' }}{{ formatNumber(dataStore.snapshotComparison.diff.totalPower) }}
                </span>
              </div>
              <div class="comparison-reference">
                Snapshot du {{ formatSnapshotDate(dataStore.snapshotComparison.date) }}: {{ formatNumber(dataStore.snapshotComparison.comparison.totalPower) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Holders -->
    <div class="top-holders-grid">
      <div class="top-card">
        <h3>🏆 Top 10 Balances REG</h3>
        <div class="top-list">
          <div
            v-for="(holder, index) in dataStore.topBalanceHolders"
            :key="holder.address"
            class="top-item"
          >
            <span class="rank">{{ index + 1 }}</span>
            <span class="address">{{ formatAddress(holder.address) }}</span>
            <span class="value">{{ formatNumber(holder.balance) }}</span>
          </div>
        </div>
      </div>

      <div class="top-card">
        <h3>⚡ Top 10 Power Voting</h3>
        <div class="top-list">
          <div
            v-for="(voter, index) in dataStore.topPowerVoters"
            :key="voter.address"
            class="top-item"
          >
            <span class="rank">{{ index + 1 }}</span>
            <span class="address">{{ formatAddress(voter.address) }}</span>
            <span class="value">{{ formatNumber(voter.power) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="no-data">
    <p>Aucune donnée disponible. Veuillez charger des fichiers.</p>
    <button @click="router.push('/')" class="btn btn-primary">Retour à l'upload</button>
  </div>
</template>

<style scoped>
.analysis-view {
  animation: fadeIn 0.5s ease;
}

.analysis-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.analysis-header h2 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.analysis-header p {
  color: var(--text-secondary);
  font-size: 1.125rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.stat-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: var(--shadow-lg);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

.stat-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
}

.stat-header h3 {
  font-size: 1.5rem;
  color: var(--text-primary);
}

.stat-content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.balance-card .stat-value {
  color: var(--primary-color);
}

.power-card .stat-value {
  color: var(--accent-color);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.chart-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: var(--shadow-lg);
}

.chart-card h3 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.chart-container {
  height: 350px;
}

.chart-card.full-width {
  grid-column: 1 / -1;
}

.correlation-grid {
  grid-template-columns: 1fr;
}

.chart-empty {
  height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--glass-bg);
  border: 1px dashed var(--border-color);
  border-radius: 0.75rem;
}

.chart-note {
  margin-top: -1rem;
  margin-bottom: 2rem;
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.6;
}

.pool-wallet-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-item {
  flex: 1 1 200px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  box-shadow: var(--shadow-md);
}

.summary-label {
  display: block;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.chart-explainer {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 2rem;
  color: var(--text-secondary);
  line-height: 1.6;
  box-shadow: var(--shadow-md);
}

.chart-explainer strong {
  color: var(--text-primary);
}

.chart-explainer em {
  color: var(--accent-color);
}

.chart-explainer .axis-note {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.top-holders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.top-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: var(--shadow-lg);
}

.top-card h3 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.top-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.top-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.top-item:hover {
  background: var(--bg-tertiary);
  transform: translateX(4px);
}

.rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.875rem;
}

.address {
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
}

.value {
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;
}

.correlation-table {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.correlation-row {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: var(--shadow-lg);
}

.row-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  justify-content: space-between;
}

.positions-count .metric-value {
  color: var(--secondary-color);
}

.positions-toggle {
  margin-left: auto;
  padding: 0.6rem 1rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.positions-toggle:hover {
  background: var(--primary-color);
  color: #0f172a;
}

.row-details {
  margin-top: 1.25rem;
  border-top: 1px dashed var(--border-color);
  padding-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.address-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.address-short {
  font-weight: 700;
  color: var(--text-primary);
}

.address-full {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 120px;
}

.metric-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.positions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.position-pill {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  font-size: 0.85rem;
}

.pill-dex {
  font-weight: 600;
  color: var(--primary-color);
}

.pill-pool {
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
}

.pill-value {
  font-weight: 600;
  color: var(--text-primary);
}

.pill-more {
  align-self: center;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.no-data {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--card-bg);
  border-radius: 1rem;
  border: 1px solid var(--border-color);
}

.no-data p {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .stats-grid,
  .charts-grid,
  .top-holders-grid {
    grid-template-columns: 1fr;
  }

  .stat-content {
    grid-template-columns: 1fr;
  }

  .analysis-header h2 {
    font-size: 1.75rem;
  }

  .row-main {
    flex-direction: column;
    align-items: flex-start;
  }

  .positions-toggle {
    width: 100%;
  }

  .pool-wallet-summary {
    flex-direction: column;
  }
}

.section-header {
  text-align: center;
  margin: 4rem 0 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

.section-header h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.section-header p {
  color: var(--text-secondary);
}

.v2-card .stat-value {
  color: #8b5cf6; /* Violet */
}

.v3-card .stat-value {
  color: #ec4899; /* Pink */
}

.comparison-section {
  margin-bottom: 2.5rem;
}

.comparison-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.comparison-select {
  flex: 1;
  min-width: 250px;
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  cursor: pointer;
}

.comparison-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-clear-comparison {
  padding: 0.75rem 1.25rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-clear-comparison:hover {
  background: var(--bg-secondary);
  border-color: var(--error-color);
  color: var(--error-color);
}

.comparison-results {
  animation: fadeIn 0.5s ease;
}

.comparison-card {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: var(--shadow-lg);
}

.comparison-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.comparison-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
}

.comparison-label {
  font-size: 0.9rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.comparison-values {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.comparison-current {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.comparison-arrow {
  color: var(--text-secondary);
  font-size: 1.25rem;
}

.comparison-diff {
  font-size: 1.5rem;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
}

.comparison-diff.positive {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.comparison-diff.negative {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.comparison-reference {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
}

@media (max-width: 768px) {
  .comparison-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .comparison-select {
    min-width: 100%;
  }

  .comparison-grid {
    grid-template-columns: 1fr;
  }
}
</style>
