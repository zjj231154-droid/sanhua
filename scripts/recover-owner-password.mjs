import { createRailwayVolumeBucket } from '../server/railway-assets.mjs'
import { recoverOwnerPassword } from '../server/owner-recovery.mjs'

const directory = String(process.env.SANHUA_STORAGE_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim()
const username = String(process.env.SANHUA_BOOTSTRAP_ADMIN_USERNAME || '').trim()
const password = String(process.env.SANHUA_BOOTSTRAP_ADMIN_PASSWORD || '')
if (!directory || !username || !password) {
  console.error('RECOVERY_CONFIGURATION_MISSING: volume path and bootstrap owner credentials are required')
  process.exitCode = 1
} else {
  try {
    const result = await recoverOwnerPassword(createRailwayVolumeBucket(directory), {
      username, password, apply: process.argv.includes('--apply'),
    })
    console.log(result)
  } catch (error) {
    console.error(`RECOVERY_FAILED: ${error.message}`)
    process.exitCode = 1
  }
}
