import { json, tokenSpaceRequest, DEFAULT_REASONING_MODEL, providerFrom } from '../../_lib/tokenspace.js'
import { requireIdentity, resolvedImageProviderConnection, resolvedProviderConnection } from '../../_lib/collaboration.js'
import { getWorkRecord } from '../../_lib/work-record-store.js'
import { ownsTask } from '../../_lib/task-ownership.js'
import { saveTask, updateTask } from '../../_lib/task-store.js'
import { createTextRecord } from '../../_lib/text-record-store.js'
import { archiveImageOutputs } from '../../_lib/asset-store.js'
const dataUrlToBlob = value => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value || '')
  if (!match) return null
  return new Blob([Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))], { type: match[1] })
}
export async function onRequestGet(context) {
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path
  if (path !== 'test') return json(405, { error: 'METHOD_NOT_ALLOWED' })
  // This endpoint deliberately performs a tiny completion rather than merely
  // checking whether a key exists or whether the provider's /models endpoint
  // is reachable. It therefore verifies the configured key, route and model.
  const provider = providerFrom(context, 'usegoodai-reasoning')
  const model = String(context.env?.USEGOODAI_REASONING_MODEL || DEFAULT_REASONING_MODEL).trim()
  if (!provider.apiKey) return json(503, { error: 'API_KEY_NOT_CONFIGURED', provider: provider.name, requestedModel: model })
  const startedAt = Date.now()
  try {
    const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly: connection successful' }], max_tokens: 16, temperature: 0 }),
      signal: AbortSignal.timeout(30000),
    })
    const raw = await response.text()
    let data
    try { data = JSON.parse(raw) } catch { data = null }
    const elapsedMs = Date.now() - startedAt
    if (!response.ok) {
      const message = String(data?.error?.message || data?.message || data?.error || `模型服务返回 HTTP ${response.status}`).slice(0, 500)
      return json(response.status, { error: message, provider: provider.name, requestedModel: model, elapsedMs })
    }
    const reply = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) return json(502, { error: '模型已返回响应，但响应不含可读文本', provider: provider.name, requestedModel: model, elapsedMs })
    return json(200, { success: true, provider: provider.name, requestedModel: model, respondedModel: String(data?.model || model), reply: reply.trim().slice(0, 200), elapsedMs })
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    const message = error?.name === 'TimeoutError' ? '模型调用超过 30 秒未返回，请检查模型服务或稍后重试' : '无法连接模型服务，请检查 Railway 网络与 UseGoodAI 配置'
    return json(502, { error: message, provider: provider.name, requestedModel: model, elapsedMs })
  }
}
export async function onRequestPost(context) {
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path
  if (path) return json(404, { error: 'NOT_FOUND' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const identity = await requireIdentity(context, 'use')
  if (identity.error) return identity.error
  const type = ['prompt', 'analyze', 'image', 'edit', 'video'].includes(input.type) ? input.type : 'prompt'
  const providerConnection = type === 'image' || type === 'edit' ? await resolvedImageProviderConnection(context, identity.user.id) : await resolvedProviderConnection(context, identity.user.id)
  const model = String(input.model || (type === 'image' || type === 'edit' ? providerConnection?.imageModel || 'gpt-image-2' : type === 'video' ? 'sora-2' : providerConnection?.reasoningModel || context.env?.USEGOODAI_REASONING_MODEL || DEFAULT_REASONING_MODEL)).slice(0, 160)
  const prompt = String(input.prompt || '').slice(0, 10000)
  if (!prompt) return json(400, { error: '请填写提示词' })
  const workRecordId = String(input.workRecordId || '').trim()
  if (workRecordId && !ownsTask(await getWorkRecord(context, workRecordId), identity)) return json(404, { error: 'WORK_RECORD_NOT_FOUND' })
  const trackedRequest = async (endpoint, options) => {
    const workspace = ['retouch', 'brand', 'script', 'video'].includes(input.workspace) ? input.workspace : type === 'video' ? 'video' : 'retouch'
    const task = await saveTask(context, { id: crypto.randomUUID(), workRecordId, workspace, workspaceId: identity.workspaceId, createdBy: identity.user.id, type: type === 'video' ? 'video-generation' : type === 'analyze' ? 'assistant-analysis' : 'text-generation', title: type === 'analyze' ? '图片识别助手' : type === 'prompt' ? '精修提示词助手' : '模型生成任务', requirements: prompt, assets: input.sourceAssetIds || [], status: 'running', progress: null, model, stage: '模型处理中', draftData: { prompt, selectedAssetIds: input.sourceAssetIds || [], workflowStep: type === 'analyze' ? 1 : 5 } })
    const scoped = { ...context, workRecordId: task.workRecordId }
    const result = await tokenSpaceRequest(scoped, endpoint, options)
    if (result.response) {
      const failure = await result.response.clone().json().catch(() => ({}))
      await updateTask(scoped, task.id, { status: 'failed', stage: '助手处理失败', error: failure.hint || failure.error || '助手请求失败' })
      return result
    }
    const content = result.data?.choices?.[0]?.message?.content
    const record = typeof content === 'string' ? await createTextRecord(scoped, { workspace, workspaceId: identity.workspaceId, createdBy: identity.user.id, sourceModule: `${workspace}.assistant`, recordType: 'assistant_result', title: task.title, content, sourceTaskId: task.workRecordId }) : null
    if (['image', 'edit'].includes(type)) {
      const outputs = (result.data?.data || []).map(output => ({ ...output, archiveAssetId: crypto.randomUUID() }))
      const pendingArchive = { taskId: task.workRecordId || task.id, workspace, outputs, prompt, model, sourceAssetIds: input.sourceAssetIds || [] }
      await updateTask(scoped, task.id, { pendingArchive })
      let archived
      try { archived = await archiveImageOutputs(scoped, pendingArchive) } catch { archived = {} }
      if (!archived.assets?.length) { await updateTask(scoped, task.id, { status: 'failed', error: '结果归档失败，生成结果已保留，可重新归档。', stage: '结果归档失败' }); return result }
      await updateTask(scoped, task.id, { pendingArchive: null, status: 'completed', progress: 100, stage: '图片已生成', outputIds: archived.assets.map(asset => asset.id) })
    } else if (type === 'video') {
      const providerTaskId = result.data?.id || result.data?.data?.id, providerVideoUrl = result.data?.url || result.data?.data?.url
      await updateTask(scoped, task.id, { status: providerVideoUrl ? 'completed' : providerTaskId ? 'running' : 'failed', progress: providerVideoUrl ? 100 : null, stage: providerVideoUrl ? '视频已生成' : '等待视频结果', providerTaskId, providerVideoUrl })
    } else await updateTask(scoped, task.id, { status: type === 'prompt' ? 'waiting_user' : 'completed', progress: type === 'prompt' ? null : 100, stage: type === 'prompt' ? '计划已生成，等待确认' : '助手处理完成', textRecordId: record?.id || null })
    return result
  }
  if (type === 'analyze') {
    const image = String(input.image || '').slice(0, 24_000_000)
    if (!dataUrlToBlob(image)) return json(400, { error: '图片识别需要 PNG、JPG 或 WebP 图片' })
    const payload = {
      model,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } },
      ] }],
    }
    const result = await trackedRequest('chat/completions', { model, payload, provider: 'usegoodai-reasoning' })
    return result.response || json(200, { type, data: result.data })
  }
  if (type === 'edit') {
    const sources = Array.isArray(input.images) ? input.images : [input.image]
    const images = sources.map(dataUrlToBlob).filter(Boolean)
    if (!images.length) return json(400, { error: '图生图需要至少一张 PNG、JPG 或 WebP 图片' })
    const form = new FormData(); form.append('model', model); form.append('prompt', prompt); form.append('response_format', 'b64_json')
    images.forEach((image, index) => form.append(images.length === 1 ? 'image' : 'image[]', image, `source-${index}.png`))
    const result = await trackedRequest('images/edits', { model, form, provider: 'usegoodai', useImageConnection: true })
    return result.response || json(200, { type, data: result.data })
  }
  const endpoint = type === 'image' ? 'images/generations' : type === 'video' ? 'videos/generations' : 'chat/completions'
  const payload = type === 'prompt' ? { model, messages: [{ role: 'user', content: prompt }] } : { model, prompt, size: input.size || '1024x1024', response_format: 'b64_json' }
  const result = await trackedRequest(endpoint, { model, payload, provider: type === 'prompt' ? 'usegoodai-reasoning' : 'usegoodai', useImageConnection: type === 'image' })
  return result.response || json(200, { type, data: result.data })
}
