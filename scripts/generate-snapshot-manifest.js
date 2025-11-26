import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const snapshotDir = path.join(__dirname, '../public/snapshot')
const manifestPath = path.join(snapshotDir, 'manifest.json')

function generateManifest() {
  const snapshots = []

  if (!fs.existsSync(snapshotDir)) {
    console.warn(`Snapshot directory not found: ${snapshotDir}`)
    return
  }

  const dateDirs = fs
    .readdirSync(snapshotDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)

  for (const dateDir of dateDirs) {
    const datePath = path.join(snapshotDir, dateDir)
    const files = fs.readdirSync(datePath)

    const balancesFile = files.find((f) => f.startsWith('balancesREG_') && f.endsWith('.json'))
    const powerFile = files.find(
      (f) => f.startsWith('powerVotingREG_') && f.endsWith('.json'),
    )

    if (balancesFile && powerFile) {
      // Format date for sorting: DD-MM-YYYY -> YYYY-MM-DD
      const parts = dateDir.split('-')
      const dateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`

      snapshots.push({
        date: dateDir,
        dateFormatted,
        balancesFile,
        powerVotingFile: powerFile,
      })
    }
  }

  // Sort by date descending (newest first)
  snapshots.sort((a, b) => {
    return new Date(b.dateFormatted).getTime() - new Date(a.dateFormatted).getTime()
  })

  const manifest = { snapshots }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`✅ Generated manifest with ${snapshots.length} snapshots`)
}

generateManifest()

