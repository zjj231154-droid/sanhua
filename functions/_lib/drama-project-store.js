import { assetsBucket, getJson, listJson, putJson } from './asset-store.js'
import { createWorkRecord, updateWorkRecord } from './work-record-store.js'

const prefix = 'metadata/drama-projects/'
const key = id => `${prefix}${id}.json`
const stamp = () => new Date().toISOString()
const clean = (value, limit = 20000) => String(value ?? '').trim().slice(0, limit)
const ids = value => Array.isArray(value) ? [...new Set(value.map(item => clean(item, 160)).filter(Boolean))].slice(0, 50) : []
export const projectAssets = project => [...(project.sceneAssetIds || []), ...(project.characterAssetIds || []), ...(project.propAssetIds || [])]

export async function getDramaProject(context, id) {
  const bucket = assetsBucket(context)
  return bucket ? getJson(bucket, key(id)) : null
}

export async function listDramaProjects(context, identity) {
  const bucket = assetsBucket(context)
  if (!bucket) return null
  return (await listJson(bucket, prefix, 500))
    .filter(project => identity.compatibilityMode || project.workspaceId === identity.workspaceId)
    .filter(project => !project.archivedAt)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function createDramaProject(context, identity, input = {}) {
  const bucket = assetsBucket(context)
  if (!bucket) return null
  const id = crypto.randomUUID()
  const createdAt = stamp()
  const record = await createWorkRecord(context, {
    moduleKey: 'script', moduleName: '短剧脚本', workspaceId: identity.workspaceId, ownerUserId: identity.user.id,
    title: clean(input.title, 120) || '未命名短剧项目', route: 'create', currentStep: 1,
    clientSessionId: `drama-${id}`, initialData: { dramaProjectId: id, stage: 'requirements' },
  })
  const project = {
    projectId: id, workspaceId: identity.workspaceId, ownerUserId: identity.user.id,
    title: clean(input.title, 120) || '未命名短剧项目', brief: clean(input.brief), stage: 'requirements', status: 'draft',
    sceneAssetIds: ids(input.sceneAssetIds), characterAssetIds: ids(input.characterAssetIds), propAssetIds: ids(input.propAssetIds),
    scriptId: null, scriptVersionId: null, storyboardId: null, storyboardVersionId: null,
    script: null, shots: [], videoTaskIds: [], textRecordIds: [], currentTaskId: record?.taskId || null,
    version: 1, createdAt, updatedAt: createdAt,
  }
  await putJson(bucket, key(id), project)
  return project
}

export async function updateDramaProject(context, current, patch = {}) {
  const bucket = assetsBucket(context)
  if (!bucket || !current) return null
  if (patch.expectedVersion !== undefined && Number(patch.expectedVersion) !== Number(current.version)) return { conflict: current }
  const allowed = ['stage', 'status', 'scriptId', 'scriptVersionId', 'storyboardId', 'storyboardVersionId', 'script', 'shots', 'videoTaskIds', 'textRecordIds', 'archivedAt']
  const next = { ...current }
  if (patch.title !== undefined) next.title = clean(patch.title, 120) || current.title
  if (patch.brief !== undefined) next.brief = clean(patch.brief)
  for (const name of ['sceneAssetIds', 'characterAssetIds', 'propAssetIds']) if (patch[name] !== undefined) next[name] = ids(patch[name])
  for (const name of allowed) if (patch[name] !== undefined) next[name] = patch[name]
  next.version = Number(current.version || 0) + 1
  next.updatedAt = stamp()
  await putJson(bucket, key(current.projectId), next)
  if (current.currentTaskId) await updateWorkRecord(context, current.currentTaskId, {
    title: next.title, currentStep: next.stage === 'requirements' ? 1 : next.stage === 'script_storyboard' ? 2 : 3,
    status: ['generating'].includes(next.status) ? 'running' : next.status === 'failed' ? 'failed' : 'draft',
    draftData: { dramaProjectId: next.projectId, stage: next.stage, selectedShotId: patch.selectedShotId || '', title: next.title },
    inputAssetIds: projectAssets(next), resultTextRecordIds: next.textRecordIds,
    operationSummary: `短剧项目 · ${next.stage}`,
  })
  return next
}

export const dramaProjectOwned = (project, identity) => project && (identity.compatibilityMode || project.workspaceId === identity.workspaceId)
