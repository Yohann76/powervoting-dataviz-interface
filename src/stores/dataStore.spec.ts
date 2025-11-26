import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from './dataStore'
import { describe, it, expect, beforeEach } from 'vitest'

describe('Data Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('initializes with empty data', () => {
        const store = useDataStore()
        expect(store.balances).toEqual([])
        expect(store.powerVoting).toEqual([])
    })

    it('correctly sets and processes balance data', () => {
        const store = useDataStore()
        const mockData = {
            result: {
                balances: [
                    {
                        walletAddress: '0x123',
                        type: 'wallet',
                        totalBalanceREG: '1000'
                    },
                    {
                        walletAddress: '0x456',
                        type: 'wallet',
                        totalBalanceREG: '500'
                    }
                ]
            }
        }

        store.setBalancesData(mockData)

        expect(store.balances.length).toBe(2)
        expect(store.balanceStats).not.toBeNull()
        expect(store.balanceStats?.total).toBe(1500)
        expect(store.balanceStats?.mean).toBe(750)
        expect(store.balanceStats?.max).toBe(1000)
        expect(store.balanceStats?.min).toBe(500)
    })

    it('correctly sets and processes power voting data', () => {
        const store = useDataStore()
        const mockData = {
            result: {
                powerVoting: [
                    {
                        address: '0x123',
                        powerVoting: '100'
                    },
                    {
                        address: '0x456',
                        powerVoting: '50'
                    }
                ]
            }
        }

        store.setPowerVotingData(mockData)

        expect(store.powerVoting.length).toBe(2)
        expect(store.powerVotingStats).not.toBeNull()
        expect(store.powerVotingStats?.total).toBe(150)
    })

    it('calculates top holders correctly', () => {
        const store = useDataStore()
        const mockData = {
            result: {
                balances: [
                    { walletAddress: '0x1', totalBalanceREG: '10' },
                    { walletAddress: '0x2', totalBalanceREG: '30' },
                    { walletAddress: '0x3', totalBalanceREG: '20' }
                ]
            }
        }

        store.setBalancesData(mockData)

        const top = store.topBalanceHolders
        expect(top.length).toBe(3)
        expect(top[0]?.address).toBe('0x2') // Highest balance
        expect(top[0]?.balance).toBe(30)
        expect(top[1]?.address).toBe('0x3')
        expect(top[2]?.address).toBe('0x1')
        expect(top[2]?.address).toBe('0x1')
    })

    it('analyzes pools correctly', () => {
        const store = useDataStore()
        const mockData = {
            result: {
                balances: [
                    {
                        walletAddress: '0x1',
                        sourceBalance: {
                            gnosis: {
                                dexs: {
                                    sushiswap: [
                                        {
                                            equivalentREG: '100',
                                            poolAddress: '0xPool1',
                                            tickLower: -100,
                                            tickUpper: 100
                                        }
                                    ],
                                    honeyswap: [
                                        {
                                            equivalentREG: '50',
                                            poolAddress: '0xPool2'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ]
            }
        }

        store.setBalancesData(mockData)

        const analysis = store.poolAnalysis
        expect(analysis).not.toBeNull()
        expect(analysis?.v3.totalREG).toBe(100)
        expect(analysis?.v3.count).toBe(1)
        expect(analysis?.v2.totalREG).toBe(50)
        expect(analysis?.v2.count).toBe(1)
        expect(analysis?.totalPools).toBe(2)
    })
})
