import { json, tokenSpaceRequest } from '../../../_lib/tokenspace.js'
import { getScript } from '../../../_lib/script-store.js'
import { saveTask, listTasks } from '../../../_lib/task-store.js'
import { createTextRecord } from '../../../_lib/text-record-store.js'
import { requireIdentity, resolvedVideoProviderConnection } from '../../../_lib/collaboration.js'

const inputFrom = async request => { try { return await request.json() } catch { return null } }
const assetRefsFrom = input => {
  const listed = value => Array.isArray(value) ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 50) : []
  const refs = input?.assetRefs || {}
  return {
    scene: listed(refs.scene || input?.sceneAssetIds), character: listed(refs.character || input?.characterAssetIds),
    prop: listed(refs.prop || input?.propAssetIds), other: listed(refs.other || input?.otherAssetIds),
  }
}
const validate = async (context, input, identity) => {
  const missing = []
  const scriptId = String(input?.scriptId || '').trim()
  const scriptVersionId = String(input?.scriptVersionId || '').trim()
  const assetRefs = assetRefsFrom(input)
  const sceneAssetIds = assetRefs.scene
  const videoPrompt = String(input?.videoPrompt || '').trim()
  const shotPlan = String(input?.shotPlan || '').trim()
  const aspectRatio = ['16:9', '9:16', '1:1'].includes(input?.aspectRatio) ? input.aspectRatio : '16:9'
  const durationSeconds = Number(input?.durationSeconds || 0)
  const resolution = ['480p', '720p', '1080p'].includes(input?.resolution) ? input.resolution : '720p'
  const script = scriptId ? await getScript(context, scriptId) : null
  if (!script || script.deletedAt || (!identity.compatibilityMode && script.workspaceId !== identity.workspaceId)) missing.push('已保存剧本')
  if (!scriptVersionId || script?.currentVersionId !== scriptVersionId) missing.push('当前已保存剧本版本')
  if (!sceneAssetIds.length) missing.push('至少一个场景资产')
  if (Math.max(videoPrompt.length, shotPlan.length) < 12) missing.push('分镜或分场说明')
  if (!Number.isFinite(durationSeconds) || durationSeconds < 4 || durationSeconds > 15) missing.push('4-15 秒的视频时长')
  const provider = await resolvedVideoProviderConnection(context, identity.user.id)
  const providerConfigured = Boolean(provider?.apiKey && provider?.model)
  return { missing, scriptId, scriptVersionId, sceneAssetIds, assetRefs, videoPrompt, shotPlan, durationSeconds, aspectRatio, resolution, provider, providerConfigured }
}

const route = context => String(context.params?.path || '').replace(/^\//, '')

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  return json(200, { tasks: (await listTasks(context, { workspace: 'video', workspaceId: identity.workspaceId, compatibilityMode: identity.compatibilityMode })).slice(0, 100) })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const input = await inputFrom(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  const checked = await validate(context, input, identity)
  if (route(context) === 'validate') return json(checked.missing.length ? 422 : 200, { ready: !checked.missing.length, missing: checked.missing, providerConfigured: checked.providerConfigured, normalizedAssetRefs: checked.assetRefs, notice: checked.providerConfigured ? `已检测到 ${checked.provider.model}，提交后将创建真实视频任务并按秒计费。` : '请先到管理设置验证并保存 TokenSpace 视频模型连接。' })
  if (checked.missing.length) return json(422, { error: 'VIDEO_TASK_INVALID', missing: checked.missing })
  if (!checked.providerConfigured) return json(409, { error: 'VIDEO_PROVIDER_NOT_CONFIGURED', hint: '请先到管理设置验证并保存 TokenSpace 视频模型连接。' })
  const submitted = await tokenSpaceRequest(context, 'video/generations', {
    model: checked.provider.model,
    provider: 'tokenspace',
    useVideoConnection: true,
    // OpenAI-compatible video routes use `size` for output resolution. Do not send
    // provider-specific audio flags when no audio generation was requested.
    payload: { model: checked.provider.model, prompt: checked.videoPrompt || checked.shotPlan, duration: checked.durationSeconds, ratio: checked.aspectRatio, size: checked.resolution },
  })
  if (submitted.response) return submitted.response
  const providerTaskId = String(submitted.data?.id || submitted.data?.data?.id || '').slice(0, 160) || null
  const providerVideoUrl = String(submitted.data?.url || submitted.data?.data?.url || submitted.data?.data?.[0]?.url || '').slice(0, 2000) || null
  const createdAt = new Date().toISOString()
  const textRecord = await createTextRecord(context, {
    workspaceId: identity.workspaceId, projectId: 'script', createdBy: identity.user.id, updatedBy: identity.user.id, workspace: 'script', sourceModule: 'script.video', recordType: 'storyboard_prompt', title: String(input.title || '视频生成提示词').trim(),
    content: checked.videoPrompt || checked.shotPlan, contentFormat: 'prompt', model: checked.provider.model, provider: checked.provider.name,
    sourceAssetIds: [...checked.assetRefs.scene, ...checked.assetRefs.character, ...checked.assetRefs.prop, ...checked.assetRefs.other], scriptId: checked.scriptId, scriptVersionId: checked.scriptVersionId,
  })
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workspace: 'video', workspaceId: identity.workspaceId, projectId: 'script', createdBy: identity.user.id, updatedBy: identity.user.id, version: 1, type: 'video-generation', status: providerVideoUrl ? 'completed' : 'running', progress: providerVideoUrl ? 100 : 15,
    stage: providerVideoUrl ? '视频已生成，等待查看' : '视频服务已受理，正在生成', heartbeatAt: createdAt,
    requirements: checked.videoPrompt || checked.shotPlan, assets: checked.sceneAssetIds, sourceAssetIds: checked.sceneAssetIds,
    scriptId: checked.scriptId, scriptVersionId: checked.scriptVersionId, durationSeconds: checked.durationSeconds,
    assetRefs: checked.assetRefs, characterAssetIds: checked.assetRefs.character, propAssetIds: checked.assetRefs.prop, otherAssetIds: checked.assetRefs.other,
    videoPrompt: checked.videoPrompt, aspectRatio: checked.aspectRatio, resolution: checked.resolution, mode: 'provider', provider: checked.provider.name, model: checked.provider.model, providerTaskId, providerVideoUrl, textRecordId: textRecord?.id || null, simulated: false, createdAt,
  })
  return json(202, { task, textRecordId: textRecord?.id || null, notice: providerVideoUrl ? '视频已生成，结果已写入任务记录。' : `已提交至 ${checked.provider.model}，正在异步生成。` })
}
