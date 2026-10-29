import { preflightReferences } from '../../../_lib/reference-preflight.js'
import { referenceIdsFrom, referenceBindingsFor, compileReferencePrompt } from '../../../_lib/reference-bindings.js'
import { ownsTask, taskScope } from '../../../_lib/task-ownership.js'
import { json, tokenSpaceRequest } from '../../../_lib/tokenspace.js'
import { getScript } from '../../../_lib/script-store.js'
import { getTask, saveTask, listTasks, updateTask } from '../../../_lib/task-store.js'
import { createTextRecord } from '../../../_lib/text-record-store.js'
import { requireIdentity, resolvedVideoProviderConnection } from '../../../_lib/collaboration.js'
import { createWorkRecord, getWorkRecord, updateWorkRecord } from '../../../_lib/work-record-store.js'
import { dramaProjectOwned, getDramaProject } from '../../../_lib/drama-project-store.js'

const inputFrom = async request => { try { return await request.json() } catch { return null } }
const assetRefsFrom = input => {
  const listed = value => Array.isArray(value) ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 50) : []
  if (Array.isArray(input?.referencedAssetIds)) return { scene: [], character: [], prop: [], other: listed(input.referencedAssetIds) }
  const refs = input?.assetRefs || {}
  return {
    scene: listed(refs.scene || input?.sceneAssetIds), character: listed(refs.character || input?.characterAssetIds),
    prop: listed(refs.prop || input?.propAssetIds), other: listed(refs.other || input?.otherAssetIds),
  }
}
const referenceIds = refs => referenceIdsFrom([...refs.scene, ...refs.character, ...refs.prop, ...refs.other])
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
  const project = input?.projectId ? await getDramaProject(context, String(input.projectId)) : null
  const optionalProjectReferences = dramaProjectOwned(project, identity) && project.scriptId === scriptId && ['video', 'completed'].includes(project.stage)
  if (!script || script.deletedAt || !ownsTask(script, identity)) missing.push('已保存剧本')
  if (!scriptVersionId || script?.currentVersionId !== scriptVersionId) missing.push('当前已保存剧本版本')
  if (!sceneAssetIds.length && !optionalProjectReferences) missing.push('至少一个场景资产')
  if (Math.max(videoPrompt.length, shotPlan.length) < 12) missing.push('分镜或分场说明')
  if (!Number.isFinite(durationSeconds) || durationSeconds < 4 || durationSeconds > 15) missing.push('4-15 秒的视频时长')
  const provider = await resolvedVideoProviderConnection(context, identity.user.id)
  const providerConfigured = Boolean(provider?.apiKey && provider?.model)
  let references = { images: [], ready: true, items: [], errors: [] }, bindings = [], compiledPrompt = videoPrompt || shotPlan
  try {
    bindings = referenceBindingsFor(referenceIds(assetRefs), input.referenceBindings || [])
    compiledPrompt = compileReferencePrompt(compiledPrompt, referenceIds(assetRefs), bindings)
    if (!missing.length) references = await preflightReferences(context, identity, referenceIds(assetRefs), { includeImages: true })
  } catch (error) { missing.push(error.message || '素材引用绑定无效') }
  if (!references.ready) missing.push(...references.errors.map(item => `${item.name || item.assetId || '参考图'}：${item.reason}`))
  return { missing, scriptId, scriptVersionId, sceneAssetIds, assetRefs, videoPrompt, shotPlan, durationSeconds, aspectRatio, resolution, provider, providerConfigured, compiledPrompt, referenceBindings: bindings, referencePreflightStatus: references.ready ? 'available' : 'failed', referencePreflightErrors: references.errors, referenceImages: references.images || [] }
}

const route = context => (Array.isArray(context.params?.path) ? context.params.path.join('/') : String(context.params?.path || '')).replace(/^\//, '')

const videoResultFrom = value => {
  const payload = value?.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : value || {}
  const status = String(payload.status || payload.state || payload.task_status || '').toLowerCase()
  const rawValue = payload.progress ?? payload.percentage
  const rawProgress = rawValue == null ? NaN : Number(String(rawValue).replace('%', ''))
  const url = [payload.url, payload.video_url, payload.result_url, payload.output?.video_url, payload.output?.url, payload.metadata?.url, payload.result?.url, payload.result?.video_url].find(item => typeof item === 'string' && /^https?:\/\//.test(item)) || null
  const message = String(payload.error?.message || payload.error_message || payload.message || '').trim().slice(0, 800)
  return { status, progress: Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : null, url, message }
}

export const syncVideoTask = async (context, task) => {
  if (task?.workRecordId && (await getWorkRecord(context, task.workRecordId))?.status === 'cancelled') return { ...task, status: 'cancelled' }
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
    if (['completed', 'succeeded', 'success'].includes(result.status)) {
      const next = await updateTask(context, task.id, {
      status: 'completed', progress: 100, stage: result.url ? '视频已生成，结果已同步' : '视频已生成，但上游未返回播放地址', providerVideoUrl: result.url || task.providerVideoUrl || null,
      providerStatus: result.status, lastProviderSyncAt: checkedAt, heartbeatAt: checkedAt,
      }) || task
      if (task.workRecordId) await updateWorkRecord(context, task.workRecordId, { status: 'succeeded', progress: 100, providerTaskId: task.providerTaskId, operationSummary: next.stage, errorCode: '', errorMessage: '' })
      return next
    }
    if (['failed', 'error', 'cancelled', 'canceled', 'expired'].includes(result.status)) {
      const next = await updateTask(context, task.id, {
      status: result.status === 'expired' ? 'failed' : result.status === 'cancelled' || result.status === 'canceled' ? 'cancelled' : 'failed', progress: result.progress ?? task.progress, progressSource: result.progress == null ? 'platform_estimate' : 'provider',
      stage: result.message || '上游视频生成失败', providerStatus: result.status, lastProviderSyncAt: checkedAt, heartbeatAt: checkedAt,
      }) || task
      if (task.workRecordId) await updateWorkRecord(context, task.workRecordId, { status: next.status === 'cancelled' ? 'cancelled' : 'failed', progress: next.progress, errorCode: 'PROVIDER_REQUEST_FAILED', errorMessage: next.stage, operationSummary: next.stage })
      return next
    }
    const next = await updateTask(context, task.id, {
      status: 'running', progress: result.progress, progressSource: result.progress == null ? 'unknown' : 'provider',
      stage: '视频服务已受理，正在生成', providerStatus: result.status || 'processing', lastProviderSyncAt: checkedAt, heartbeatAt: checkedAt,
    }) || task
    if (task.workRecordId) await updateWorkRecord(context, task.workRecordId, { status: 'running', progress: next.progress, progressSource: next.progressSource, operationSummary: next.stage, providerTaskId: task.providerTaskId })
    return next
  } catch { return task }
}

const videoDownload = async (context, identity, id) => {
  const task = await getTask(context, id)
  if (!task || task.workspace !== 'video' || !ownsTask(task, identity)) return json(404, { error: 'VIDEO_TASK_NOT_FOUND' })
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
  const id = route(context)
  if (id) { const task = await getTask(context, id); return ownsTask(task, identity) && task.workspace === 'video' ? json(200, { task: await syncVideoTask(context, task) }) : json(404, { error: 'VIDEO_TASK_NOT_FOUND' }) }
  const stored = (await listTasks(context, { workspace: 'video', ...taskScope(identity) })).slice(0, 100)
  const tasks = await Promise.all(stored.map(task => syncVideoTask(context, task)))
  return json(200, { tasks })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const input = await inputFrom(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  let workRecordId = String(input.workRecordId || input.taskId || '').trim()
  let workRecord = workRecordId ? await getWorkRecord(context, workRecordId) : null
  if (workRecordId && (!workRecord || (!identity.compatibilityMode && (workRecord.workspaceId !== identity.workspaceId || workRecord.ownerUserId !== identity.user.id)))) return json(404, { error: 'WORK_RECORD_NOT_FOUND' })
  let checked
  try { checked = await validate(context, input, identity) }
  catch { return json(422, { error: 'VIDEO_TASK_INVALID', missing: ['视频校验暂时失败，请刷新页面后重新选择剧本和参考图片。'], hint: '视频校验暂时失败，请刷新页面后重新选择剧本和参考图片。' }) }
  if (route(context) === 'validate') return json(checked.missing.length ? 422 : 200, { ready: !checked.missing.length, missing: checked.missing, providerConfigured: checked.providerConfigured, normalizedAssetRefs: checked.assetRefs, notice: checked.providerConfigured ? `已检测到 ${checked.provider.model}，提交后将创建真实视频任务并按秒计费。` : '请先到管理设置验证并保存 TokenSpace 视频模型连接。' })
  if (checked.missing.length) return json(422, { error: 'VIDEO_TASK_INVALID', missing: checked.missing, referencePreflightStatus: checked.referencePreflightStatus, referencePreflightErrors: checked.referencePreflightErrors })
  if (!checked.providerConfigured) return json(409, { error: 'VIDEO_PROVIDER_NOT_CONFIGURED', hint: '请先到管理设置验证并保存 TokenSpace 视频模型连接。' })
  if (!workRecord) {
    workRecord = await createWorkRecord(context, { moduleKey: 'video', moduleName: '视频生成', workspaceId: identity.workspaceId, ownerUserId: identity.user.id, title: input.title || '视频生成', route: 'video', currentStep: 3, inputAssetIds: referenceIds(checked.assetRefs), generationParams: { model: checked.provider?.model || '', aspectRatio: checked.aspectRatio, resolution: checked.resolution, durationSeconds: checked.durationSeconds }, initialData: input })
    workRecordId = workRecord.taskId
  }
  context = { ...context, workRecordId }
  if (workRecord.status === 'cancelled') return json(409, { error: 'TASK_CANCELLED' })
  await updateWorkRecord(context, workRecordId, { status: 'running', progress: null, inputAssetIds: referenceIds(checked.assetRefs), generationParams: { model: checked.provider?.model || '', aspectRatio: checked.aspectRatio, resolution: checked.resolution, durationSeconds: checked.durationSeconds }, operationSummary: '正在提交视频服务' })
  const submitted = await tokenSpaceRequest(context, 'video/generations', {
    model: checked.provider.model,
    provider: 'tokenspace',
    useVideoConnection: true,
    // TokenSpace/NewAPI accepts Seedance vendor metadata.  `reference_image`
    // keeps the selected image as a reference rather than silently treating it
    // as a decorative UI-only attachment or an unauthorised remote URL.
    payload: {
      model: checked.provider.model,
      prompt: `${checked.referenceImages.slice().sort((a, b) => b.name.length - a.name.length).reduce((text, item) => text.split(`@${item.name}`).join(`[Image${checked.referenceImages.findIndex(candidate => candidate.id === item.id) + 1}]`), checked.compiledPrompt)}\n\n已附加 ${checked.referenceImages.length} 张参考图：${checked.referenceImages.map((item, index) => `[Image${index + 1}] = @${item.name}`).join('；')}。请保持这些参考图中的角色、场景和道具一致性。`,
      duration: checked.durationSeconds,
      ratio: checked.aspectRatio,
      size: checked.resolution,
      metadata: { content: checked.referenceImages.map(item => ({ type: 'image_url', role: 'reference_image', image_url: { url: item.source } })) },
    },
  })
  if (submitted.response) { if (workRecord) await updateWorkRecord(context, workRecordId, { status: 'failed', progress: 0, errorCode: 'PROVIDER_REQUEST_FAILED', errorMessage: '视频服务请求失败', operationSummary: '视频服务请求失败' }); return submitted.response }
  const providerTaskId = String(submitted.data?.id || submitted.data?.data?.id || '').slice(0, 160) || null
  const providerVideoUrl = String(submitted.data?.url || submitted.data?.data?.url || submitted.data?.data?.[0]?.url || '').slice(0, 2000) || null
  const createdAt = new Date().toISOString()
  const textRecord = await createTextRecord(context, {
    workspaceId: identity.workspaceId, projectId: input.projectId || 'script', createdBy: identity.user.id, updatedBy: identity.user.id, workspace: 'script', sourceModule: 'script.video', recordType: 'video_prompt', title: String(input.title || '视频生成提示词').trim(),
    content: checked.videoPrompt || checked.shotPlan, contentFormat: 'prompt', model: checked.provider.model, provider: checked.provider.name, sourceTaskId: workRecordId || undefined,
    sourceAssetIds: [...checked.assetRefs.scene, ...checked.assetRefs.character, ...checked.assetRefs.prop, ...checked.assetRefs.other], scriptId: checked.scriptId, scriptVersionId: checked.scriptVersionId, shotId: input.shotId, storyboardId: input.storyboardId,
  })
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workRecordId, workspace: 'video', workspaceId: identity.workspaceId, projectId: input.projectId || 'script', shotId: input.shotId || null, createdBy: identity.user.id, updatedBy: identity.user.id, version: 1, type: 'video-generation', status: providerVideoUrl ? 'completed' : 'running', progress: providerVideoUrl ? 100 : 15,
    stage: providerVideoUrl ? '视频已生成，等待查看' : '视频服务已受理，正在生成', heartbeatAt: createdAt,
    requirements: checked.videoPrompt || checked.shotPlan, assets: referenceIds(checked.assetRefs), sourceAssetIds: referenceIds(checked.assetRefs), generationParams: { model: checked.provider?.model || '', aspectRatio: checked.aspectRatio, resolution: checked.resolution, durationSeconds: checked.durationSeconds },
    scriptId: checked.scriptId, scriptVersionId: checked.scriptVersionId, durationSeconds: checked.durationSeconds,
    assetRefs: checked.assetRefs, characterAssetIds: checked.assetRefs.character, propAssetIds: checked.assetRefs.prop, otherAssetIds: checked.assetRefs.other,
    referencedAssetIds: referenceIds(checked.assetRefs), prompt: checked.videoPrompt || checked.shotPlan, referencePreflightStatus: checked.referencePreflightStatus, referencePreflightErrors: checked.referencePreflightErrors, archiveStatus: 'pending',
    videoPrompt: checked.videoPrompt, aspectRatio: checked.aspectRatio, resolution: checked.resolution, mode: 'provider', provider: checked.provider.name, model: checked.provider.model, providerTaskId, providerVideoUrl, referenceBindings: checked.referenceImages.map((item, index) => ({ assetId: item.id, alias: `Image${index + 1}`, token: checked.referenceBindings.find(binding => binding.assetId === item.id)?.token, name: item.name })), textRecordId: textRecord?.id || null, simulated: false, createdAt,
  })
  if (workRecord) await updateWorkRecord(context, workRecordId, { status: providerVideoUrl ? 'succeeded' : 'queued', progress: providerVideoUrl ? 100 : 15, providerTaskId: providerTaskId || task.id, providerType: checked.provider.name, providerModel: checked.provider.model, resultTextRecordIds: textRecord?.id ? [...(workRecord.resultTextRecordIds || []), textRecord.id] : workRecord.resultTextRecordIds, operationSummary: providerVideoUrl ? '视频已生成，结果已同步' : '视频服务已受理，正在生成', errorCode: '', errorMessage: '' })
  return json(202, { workRecordId: workRecordId || null, task, textRecordId: textRecord?.id || null, notice: providerVideoUrl ? '视频已生成，结果已写入任务记录。' : `已提交至 ${checked.provider.model}，正在异步生成。` })
}
