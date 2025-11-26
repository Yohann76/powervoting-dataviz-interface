export interface SnapshotInfo {
  date: string
  dateFormatted: string
  balancesFile: string
  powerVotingFile: string
}

// Load snapshot manifest
export async function loadSnapshotManifest(): Promise<SnapshotInfo[]> {
  try {
    const response = await fetch('/snapshot/manifest.json')
    if (response.ok) {
      const manifest = await response.json()
      return manifest.snapshots
        .map((s: any) => ({
          date: s.date,
          dateFormatted: s.dateFormatted || formatDate(s.date),
          balancesFile: s.balancesFile,
          powerVotingFile: s.powerVotingFile,
        }))
        .sort((a: SnapshotInfo, b: SnapshotInfo) => {
          // Sort by date descending (newest first)
          return new Date(b.dateFormatted).getTime() - new Date(a.dateFormatted).getTime()
        })
    }
  } catch (err) {
    console.warn('Could not load manifest.json, using fallback', err)
  }

  // Fallback: return empty array
  return []
}

function formatDate(dateStr: string): string {
  // Convert DD-MM-YYYY to YYYY-MM-DD for proper sorting
  const [day, month, year] = dateStr.split('-')
  return `${year}-${month}-${day}`
}

export async function loadSnapshot(snapshot: SnapshotInfo): Promise<{
  balances: any
  powerVoting: any
}> {
  const [balancesResponse, powerVotingResponse] = await Promise.all([
    fetch(`/snapshot/${snapshot.date}/${snapshot.balancesFile}`),
    fetch(`/snapshot/${snapshot.date}/${snapshot.powerVotingFile}`),
  ])

  if (!balancesResponse.ok || !powerVotingResponse.ok) {
    throw new Error(`Failed to load snapshot ${snapshot.date}`)
  }

  const balances = await balancesResponse.json()
  const powerVoting = await powerVotingResponse.json()

  return { balances, powerVoting }
}

