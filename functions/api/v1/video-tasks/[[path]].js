import { json, tokenSpaceRequest } from '../../../_lib/tokenspace.js'
import { getScript } from '../../../_lib/script-store.js'
import { getTask, saveTask, listTasks, updateTask } from '../../../_lib/task-store.js'
import { assetMetadataKey, assetsBucket, getJson } from '../../../_lib/asset-store.js'
import { createTextRecord } from '../../../_lib/text-record-store.js'
import { hasPermission, requireIdentity, resolvedVideoProviderConnection } from '../../../_lib/collaboration.js'

const inputFrom = async request => { try { return await request.json() } catch { return null } }
const MAX_REFERENCE_IMAGES = 9
const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_REFERENCE_TOTAL_BYTES = 30 * 1024 * 1024
const assetRefsFrom = input => {
  const listed = value => Array.isArray(value) ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 50) : []
  const refs = input?.assetRefs || {}
  return {
    scene: listed(refs.scene || input?.sceneAssetIds), character: listed(refs.character || input?.characterAssetIds),
    prop: listed(refs.prop || input?.propAssetIds), other: listed(refs.other || input?.otherAssetIds),
  }
}
const base64From = bytes => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}
const referenceIds = refs => [...refs.scene, ...refs.character, ...refs.prop, ...refs.other]
const referenceImagesFor = async (context, identity, refs) => {
  const ids = referenceIds(refs)
  if (ids.length > MAX_REFERENCE_IMAGES) return { error: `Seedance 最多可引用 ${MAX_REFERENCE_IMAGES} 张图片，请减少当前选择。` }
  const bucket = assetsBucket(context)
  if (!bucket) return { error: '资产存储未配置，无法读取参考图片。' }
  const images = []
  let totalBytes = 0
  for (const id of ids) {
    const asset = await getJson(bucket, assetMetadataKey(id))
    if (!asset || (!identity.compatibilityMode && asset.workspaceId !== identity.workspaceId && asset.tenantId !== identity.workspaceId)) return { error: `参考资产不存在或无权使用：${id}` }
    if (asset.visibility === 'private' && asset.createdBy !== identity.user.id && !hasPermission(identity.membership, 'manage')) return { error: `无权使用私有参考资产：${asset.name || id}` }
    if (asset.assetType && asset.assetType !== 'image') return { error: `参考资产不是图片：${asset.name || id}` }
    if (Array.isArray(asset.usableFor) && asset.usableFor.length && !asset.usableFor.includes('video')) return { error: `该资产不可用于视频生成：${asset.name || id}` }
    const externalUrl = String(asset.externalUrl || '').trim()
    if (/^https:\/\//i.test(externalUrl)) {
      images.push({ id, name: String(asset.name || `参考图${images.length + 1}`).slice(0, 160), source: externalUrl })
      continue
    }
    // Legacy assets are served by this app from /cloud-assets.  They are
    // valid visible assets, but a relative browser URL cannot be sent to the
    // provider. Read only this known public path and attach its actual bytes.
    if (/^\/cloud-assets\//i.test(externalUrl)) {
      let response
      try { response = await fetch(new URL(externalUrl, context.request.url), { signal: AbortSignal.timeout(30000) }) } catch { return { error: `读取参考图片失败：${asset.name || id}，请稍后重试。` } }
      if (!response.ok) return { error: `无法读取参考图片：${asset.name || id}，请重新选择或重新上传后重试。` }
      let bytes
      try { bytes = new Uint8Array(await response.arrayBuffer()) } catch { return { error: `读取参考图片失败：${asset.name || id}，请重新上传后重试。` } }
      if (!bytes.byteLength || bytes.byteLength > MAX_REFERENCE_IMAGE_BYTES) return { error: `参考图片 ${asset.name || id} 超过 8MB 或文件无效。` }
      totalBytes += bytes.byteLength
      if (totalBytes > MAX_REFERENCE_TOTAL_BYTES) return { error: '参考图片总大小超过 30MB，请减少图片数量或压缩后重试。' }
      const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase()
      const mimeType = ['image/png', 'image/jpeg', 'image/webp'].includes(contentType) ? contentType : (asset.mimeType === 'image/webp' ? 'image/webp' : asset.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png')
      images.push({ id, name: String(asset.name || `参考图${images.length + 1}`).slice(0, 160), source: `data:${mimeType};base64,${base64From(bytes)}` })
      continue
    }
    if (!asset.storageKey) return { error: `参考资产缺少可读取的图片文件：${asset.name || id}，请重新上传后重试。` }
    let object
    try { object = await bucket.get(asset.storageKey) } catch { return { error: `读取参考图片失败：${asset.name || id}，请重新选择或重新上传后重试。` } }
    if (!object) return { error: `无法读取参考图片：${asset.name || id}` }
    let bytes
    try { bytes = new Uint8Array(await (typeof object.arrayBuffer === 'function' ? object.arrayBuffer() : new Response(object.body).arrayBuffer())) } catch { return { error: `读取参考图片失败：${asset.name || id}，请重新上传后重试。` } }
    if (!bytes.byteLength || bytes.byteLength > MAX_REFERENCE_IMAGE_BYTES) return { error: `参考图片 ${asset.name || id} 超过 8MB 或文件无效。` }
    totalBytes += bytes.byteLength
    if (totalBytes > MAX_REFERENCE_TOTAL_BYTES) return { error: '参考图片总大小超过 30MB，请减少图片数量或压缩后重试。' }
    const mimeType = ['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/png'
    images.push({ id, name: String(asset.name || `参考图${images.length + 1}`).slice(0, 160), source: `data:${mimeType};base64,${base64From(bytes)}` })
  }
  return { images }
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
  let references = { images: [] }
  if (!missing.length) {
    try { references = await referenceImagesFor(context, identity, assetRefs) }
    catch { references = { images: [], error: '参考图片校验失败，请重新选择已上传的短剧图片后重试。' } }
  }
  if (references.error) missing.push(references.error)
  return { missing, scriptId, scriptVersionId, sceneAssetIds, assetRefs, videoPrompt, shotPlan, durationSeconds, aspectRatio, resolution, provider, providerConfigured, referenceImages: references.images || [] }
}

const route = context => (Array.isArray(context.params?.path) ? context.params.path.join('/') : String(context.params?.path || '')).replace(/^\//, '')

const videoResultFrom = value => {
  const payload = value?.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : value || {}
  const status = String(payload.status || payload.state || payload.task_status || '').toLowerCase()
  const rawProgress = Number(String(payload.progress ?? payload.percentage ?? '').replace('%', ''))
  const url = [payload.url, payload.video_url, payload.result_url, payload.output?.video_url, payload.output?.url, payload.metadata?.url, payload.result?.url, payload.result?.video_url].find(item => typeof item === 'string' && /^https?:\/\//.test(item)) || null
  const message = String(payload.error?.message || payload.error_message || payload.message || '').trim().slice(0, 800)
  return { status, progress: Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : null, url, message }
}

const syncVideoTask = async (context, task) => {
  if (!task?.providerTaskId || !['queued', 'running'].includes(task.status)) return task
  const lastSync = Date.parse(task.lastProviderSyncAt || '')
  if (Number.isFinite(lastSync) && Date.now() - lastSync < 5000) return task
  const provider = await resolvedVideoProviderConnection(context, task.createdBy)
  if (!provider?.apiKey) return task
  try {
    const baseUrl = provider.baseUrl.replace(/\/$/, '')
    const root = /\/v1$/.test(baseUrl) ? baseUrl : `${baseUrl}/v1`
    const response = await fetch(`${root}/video/generations/${encodeURIComponent(task.providerTaskId)}`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) return task
    const result = videoResultFrom(await response.json())
    const checkedAt = new Date().toISOString()
    if (['completed', 'succeeded', 'success'].includes(result.status)) return updateTask(context, task.id, {
      status: 'completed', progress: 100, stage: result.url ? '视频已生成，结果已同步' : '视频已生成，但上游未返回播放地址', providerVideoUrl: result.url || task.providerVideoUrl || null,
      providerStatus: result.status, lastProviderSyncAt: checkedAt, heartbeatAt: checkedAt,
    }) || task
    if (['failed', 'error', 'cancelled', 'canceled', 'expired'].includes(result.status)) return updateTask(context, task.id, {
      status: result.status === 'expired' ? 'failed' : result.status === 'cancelled' || result.status === 'canceled' ? 'cancelled' : 'failed', progress: result.progress ?? task.progress,
      stage: result.message || '上游视频生成失败', providerStatus: result.status, lastProviderSyncAt: checkedAt, heartbeatAt: checkedAt,
    }) || task
    return updateTask(context, task.id, {
      status: 'running', progress: result.progress === null ? Math.max(15, Number(task.progress || 0)) : Math.max(15, Math.min(95, result.progress)),
      stage: '视频服务已受理，正在生成', providerStatus: result.status || 'processing', lastProviderSyncAt: checkedAt, heartbeatAt: checkedAt,
    }) || task
  } catch { return task }
}

const videoDownload = async (context, identity, id) => {
  const task = await getTask(context, id)
  if (!task || task.workspace !== 'video' || (!identity.compatibilityMode && task.workspaceId !== identity.workspaceId)) return json(404, { error: 'VIDEO_TASK_NOT_FOUND' })
  const source = String(task.providerVideoUrl || '').trim()
  if (!/^https:\/\//i.test(source)) return json(409, { error: 'VIDEO_RESULT_NOT_READY', hint: '视频结果尚未就绪，暂时无法下载。' })
  try {
    const upstream = await fetch(source, { signal: AbortSignal.timeout(120000) })
    if (!upstream.ok || !upstream.body) return json(502, { error: 'VIDEO_DOWNLOAD_FAILED', hint: '无法从视频服务读取文件，请稍后重试。' })
    const extension = /\.webm(?:\?|$)/i.test(source) ? 'webm' : 'mp4'
    const filename = `短剧视频-${String(task.id).slice(0, 8)}.${extension}`
    return new Response(upstream.body, { headers: {
      'content-type': upstream.headers.get('content-type') || `video/${extension}`,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'private, no-store',
    } })
  } catch { return json(502, { error: 'VIDEO_DOWNLOAD_FAILED', hint: '视频下载连接失败，请稍后重试。' }) }
}

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  const downloadMatch = /^([^/]+)\/download$/.exec(route(context))
  if (downloadMatch) return videoDownload(context, identity, downloadMatch[1])
  const stored = (await listTasks(context, { workspace: 'video', workspaceId: identity.workspaceId, compatibilityMode: identity.compatibilityMode })).slice(0, 100)
  const tasks = await Promise.all(stored.map(task => syncVideoTask(context, task)))
  return json(200, { tasks })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const input = await inputFrom(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  let checked
  try { checked = await validate(context, input, identity) }
  catch { return json(422, { error: 'VIDEO_TASK_INVALID', missing: ['视频校验暂时失败，请刷新页面后重新选择剧本和参考图片。'], hint: '视频校验暂时失败，请刷新页面后重新选择剧本和参考图片。' }) }
  if (route(context) === 'validate') return json(checked.missing.length ? 422 : 200, { ready: !checked.missing.length, missing: checked.missing, providerConfigured: checked.providerConfigured, normalizedAssetRefs: checked.assetRefs, notice: checked.providerConfigured ? `已检测到 ${checked.provider.model}，提交后将创建真实视频任务并按秒计费。` : '请先到管理设置验证并保存 TokenSpace 视频模型连接。' })
  if (checked.missing.length) return json(422, { error: 'VIDEO_TASK_INVALID', missing: checked.missing })
  if (!checked.providerConfigured) return json(409, { error: 'VIDEO_PROVIDER_NOT_CONFIGURED', hint: '请先到管理设置验证并保存 TokenSpace 视频模型连接。' })
  const submitted = await tokenSpaceRequest(context, 'video/generations', {
    model: checked.provider.model,
    provider: 'tokenspace',
    useVideoConnection: true,
    // TokenSpace/NewAPI accepts Seedance vendor metadata.  `reference_image`
    // keeps the selected image as a reference rather than silently treating it
    // as a decorative UI-only attachment or an unauthorised remote URL.
    payload: {
      model: checked.provider.model,
      prompt: `${checked.referenceImages.slice().sort((a, b) => b.name.length - a.name.length).reduce((text, item) => text.split(`@${item.name}`).join(`[Image${checked.referenceImages.findIndex(candidate => candidate.id === item.id) + 1}]`), checked.videoPrompt || checked.shotPlan)}\n\n已附加 ${checked.referenceImages.length} 张参考图：${checked.referenceImages.map((item, index) => `[Image${index + 1}] = @${item.name}`).join('；')}。请保持这些参考图中的角色、场景和道具一致性。`,
      duration: checked.durationSeconds,
      ratio: checked.aspectRatio,
      size: checked.resolution,
      metadata: { content: checked.referenceImages.map(item => ({ type: 'image_url', role: 'reference_image', image_url: { url: item.source } })) },
    },
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
    videoPrompt: checked.videoPrompt, aspectRatio: checked.aspectRatio, resolution: checked.resolution, mode: 'provider', provider: checked.provider.name, model: checked.provider.model, providerTaskId, providerVideoUrl, referenceBindings: checked.referenceImages.map((item, index) => ({ assetId: item.id, alias: `Image${index + 1}`, name: item.name })), textRecordId: textRecord?.id || null, simulated: false, createdAt,
  })
  return json(202, { task, textRecordId: textRecord?.id || null, notice: providerVideoUrl ? '视频已生成，结果已写入任务记录。' : `已提交至 ${checked.provider.model}，正在异步生成。` })
}
