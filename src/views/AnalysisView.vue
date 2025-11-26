<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/dataStore'
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

onMounted(() => {
  if (dataStore.balances.length === 0 || dataStore.powerVoting.length === 0) {
    router.push('/')
  }
})

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

const formatAddress = (address: string) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
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
          <Bar :data="balanceDistributionChartData" :options="chartOptions" />
        </div>
      </div>

      <div class="chart-card">
        <h3>📊 Distribution du Power Voting</h3>
        <div class="chart-container" v-if="powerVotingDistributionChartData">
          <Bar :data="powerVotingDistributionChartData" :options="chartOptions" />
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
}
</style>
