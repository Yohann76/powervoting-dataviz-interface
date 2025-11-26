import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface BalanceData {
  walletAddress: string
  type: string
  totalBalanceREG: string | number
  totalBalanceEquivalentREG?: string | number
  [key: string]: any
}

export interface PowerVotingData {
  address: string
  powerVoting: string | number
}

export const useDataStore = defineStore('data', () => {
  const rawBalancesData = ref<any>(null)
  const rawPowerVotingData = ref<any>(null)

  const balances = computed<BalanceData[]>(() => {
    if (!rawBalancesData.value) return []

    // Handle both direct array and nested result structure
    const data = rawBalancesData.value.result?.balances || rawBalancesData.value
    return Array.isArray(data) ? data : []
  })

  const powerVoting = computed<PowerVotingData[]>(() => {
    if (!rawPowerVotingData.value) return []

    // Handle both direct array and nested result structure
    const data = rawPowerVotingData.value.result?.powerVoting || rawPowerVotingData.value
    return Array.isArray(data) ? data : []
  })

  // Statistics
  const balanceStats = computed(() => {
    if (balances.value.length === 0) return null

    const values = balances.value
      .map((b) => parseFloat(String(b.totalBalanceREG || b.totalBalance || 0)))
      .filter((v) => !isNaN(v))

    if (values.length === 0) return null

    const sorted = [...values].sort((a, b) => a - b)
    const total = values.reduce((sum, val) => sum + val, 0)
    const mean = total / values.length

    const median =
      sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2
        : (sorted[Math.floor(sorted.length / 2)] ?? 0)

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    return {
      count: values.length,
      total,
      mean,
      median,
      min: Math.min(...values),
      max: Math.max(...values),
      stdDev,
    }
  })

  const powerVotingStats = computed(() => {
    if (powerVoting.value.length === 0) return null

    const values = powerVoting.value
      .map((p) => parseFloat(String(p.powerVoting || 0)))
      .filter((v) => !isNaN(v))

    if (values.length === 0) return null

    const sorted = [...values].sort((a, b) => a - b)
    const total = values.reduce((sum, val) => sum + val, 0)
    const mean = total / values.length

    const median =
      sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2
        : (sorted[Math.floor(sorted.length / 2)] ?? 0)

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    return {
      count: values.length,
      total,
      mean,
      median,
      min: Math.min(...values),
      max: Math.max(...values),
      stdDev,
    }
  })

  // Distribution data for charts
  const balanceDistribution = computed(() => {
    if (balances.value.length === 0) return null

    const values = balances.value
      .map((b) => parseFloat(String(b.totalBalanceREG || b.totalBalance || 0)))
      .filter((v) => !isNaN(v) && v > 0)

    if (values.length === 0) return null

    // Create bins
    const bins = [
      { label: '0-100', min: 0, max: 100, count: 0 },
      { label: '100-500', min: 100, max: 500, count: 0 },
      { label: '500-1000', min: 500, max: 1000, count: 0 },
      { label: '1000-5000', min: 1000, max: 5000, count: 0 },
      { label: '5000-10000', min: 5000, max: 10000, count: 0 },
      { label: '10000+', min: 10000, max: Infinity, count: 0 },
    ]

    values.forEach((value) => {
      const bin = bins.find((b) => value >= b.min && value < b.max)
      if (bin !== undefined) bin.count++
    })

    return bins
  })

  const powerVotingDistribution = computed(() => {
    if (powerVoting.value.length === 0) return null

    const values = powerVoting.value
      .map((p) => parseFloat(String(p.powerVoting || 0)))
      .filter((v) => !isNaN(v) && v > 0)

    if (values.length === 0) return null

    // Create bins
    const bins = [
      { label: '0-100', min: 0, max: 100, count: 0 },
      { label: '100-500', min: 100, max: 500, count: 0 },
      { label: '500-1000', min: 500, max: 1000, count: 0 },
      { label: '1000-5000', min: 1000, max: 5000, count: 0 },
      { label: '5000-10000', min: 5000, max: 10000, count: 0 },
      { label: '10000+', min: 10000, max: Infinity, count: 0 },
    ]

    values.forEach((value) => {
      const bin = bins.find((b) => value >= b.min && value < b.max)
      if (bin !== undefined) bin.count++
    })

    return bins
  })

  // Top holders
  const topBalanceHolders = computed(() => {
    if (balances.value.length === 0) return []

    return [...balances.value]
      .map((b) => ({
        address: b.walletAddress,
        balance: parseFloat(String(b.totalBalanceREG || b.totalBalance || 0)),
      }))
      .filter((item) => !isNaN(item.balance))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
  })

  const topPowerVoters = computed(() => {
    if (powerVoting.value.length === 0) return []

    return [...powerVoting.value]
      .map((p) => ({
        address: p.address,
        power: parseFloat(String(p.powerVoting || 0)),
      }))
      .filter((item) => !isNaN(item.power))
      .sort((a, b) => b.power - a.power)
      .slice(0, 10)
  })

  function setBalancesData(data: any) {
    rawBalancesData.value = data
  }

  function setPowerVotingData(data: any) {
    rawPowerVotingData.value = data
  }

  function clearData() {
    rawBalancesData.value = null
    rawPowerVotingData.value = null
  }

  return {
    balances,
    powerVoting,
    balanceStats,
    powerVotingStats,
    balanceDistribution,
    powerVotingDistribution,
    topBalanceHolders,
    topPowerVoters,
    setBalancesData,
    setPowerVotingData,
    clearData,
  }
})
