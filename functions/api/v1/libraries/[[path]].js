import { json } from '../../../_lib/tokenspace.js'
import { assetsBucket, listJson } from '../../../_lib/asset-store.js'
import { ASSET_LIBRARIES, hasLocation, libraryFor } from '../../../_lib/library-config.js'
import { hasPermission, requireIdentity } from '../../../_lib/collaboration.js'
import { syncLegacyAssets } from '../../../_lib/legacy-assets.js'

const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view')
  if (identity.error) return identity.error
  const bucket = assetsBucket(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  const url = new URL(context.request.url)
  if (url.searchParams.get('includeLegacy') === 'true') await syncLegacyAssets(bucket, identity)
  const [libraryKey, action] = parts(context)
  const assets = (await listJson(bucket, 'metadata/assets/'))
    .filter(asset => identity.compatibilityMode || asset.workspaceId === identity.workspaceId || asset.tenantId === identity.workspaceId)
    .filter(asset => asset.visibility !== 'private' || asset.createdBy === identity.user.id)
  const withCounts = library => ({ ...library, folders: library.folders.map(folder => ({ ...folder, assetType: 'image', downloadEnabled: true, saveAsTemplateEnabled: Boolean(folder.saveAsTemplateEnabled), count: assets.filter(asset => hasLocation(asset, library.key, folder.key)).length })) })
  if (!libraryKey) return json(200, { libraries: ASSET_LIBRARIES.map(withCounts) })
  const library = libraryFor(libraryKey)
  if (!library || action !== 'folders') return json(404, { error: 'LIBRARY_NOT_FOUND' })
  return json(200, { library: withCounts(library), folders: withCounts(library).folders })
}
