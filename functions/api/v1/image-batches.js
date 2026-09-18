import { json, tokenSpaceRequest } from '../../_lib/tokenspace.js'
import { archiveImageOutputs, assetsBucket } from '../../_lib/asset-store.js'
import { saveTask, updateTask } from '../../_lib/task-store.js'

const workspaceFor = value => ['retouch', 'brand'].includes(value) ? value : null

export async function onRequestPost(context) {
  if (!assetsBucket(context)) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED', hint: '请在 Cloudflare Pages 绑定 SANHUA_ASSETS，或在 Railway 挂载 Volume 并设置 SANHUA_STORAGE_DIR。' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = workspaceFor(input.workspace)
  const prompt = String(input.prompt || '').trim().slice(0, 12000)
  const images = Array.isArray(input.images) ? input.images.filter(value => typeof value === 'string').slice(0, 4) : []
  const count = Number(input.count || 4)
  if (!workspace) return json(400, { error: 'WORKSPACE_REQUIRED' })
  if (!prompt) return json(400, { error: 'PROMPT_REQUIRED' })
  if (!Number.isInteger(count) || count < 1 || count > 4) return json(400, { error: 'BATCH_COUNT_MUST_BE_BETWEEN_1_AND_4' })
  const model = String(input.model || 'gpt-image-2').slice(0, 160)
  const requestedName = String(input.requestedName || input.requested_name || '').trim().slice(0, 160)
  const namePrefix = String(input.namePrefix || input.name_prefix || '').trim().slice(0, 160)
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workspace, type: 'image-batch', status: 'running', progress: 25,
    stage: `模型处理中（0/${count}）`, heartbeatAt: new Date().toISOString(), requirements: prompt,
    finalPrompt: prompt, model, createdAt: new Date().toISOString(), requestedCount: count, requestedName, namePrefix,
  })
  let result
  if (images.length) {
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', prompt)
    form.append('response_format', 'b64_json')
    for (let index = 0; index < images.length; index += 1) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(images[index])
      if (!match) {
        await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '输入图片无效', error: 'INVALID_IMAGE_INPUT' })
        return json(400, { error: '图片必须是 PNG、JPG 或 WebP 的 Data URL' })
      }
      const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
      form.append(images.length === 1 ? 'image' : 'image[]', new Blob([bytes], { type: match[1] }), `source-${index}.${match[1].split('/')[1]}`)
    }
    result = await tokenSpaceRequest(context, 'images/edits', { model, form, provider: 'usegoodai' })
  } else {
    result = await tokenSpaceRequest(context, 'images/generations', {
      model, provider: 'usegoodai', payload: { model, prompt, n: count, size: input.size || '1024x1024', response_format: 'b64_json' },
    })
  }
  if (result.response) {
    await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '模型调用失败', error: '图片模型未返回结果' })
    return result.response
  }
  const outputs = Array.isArray(result.data?.data) ? result.data.data : []
  if (!outputs.length) {
    await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '模型未返回图片', error: 'MODEL_RETURNED_NO_IMAGES' })
    return json(502, { error: 'MODEL_RETURNED_NO_IMAGES', taskId: task.id })
  }
  await updateTask(context, task.id, { progress: 90, stage: `归档图片（${outputs.length}/${count}）`, heartbeatAt: new Date().toISOString() })
  const archived = await archiveImageOutputs(context, { taskId: task.id, workspace, outputs, model, prompt, sourceAssetIds: Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds.slice(0, 50) : [], title: input.title, requestedName, namePrefix, promptSummary: input.promptSummary, referenceAssetIds: Array.isArray(input.referenceAssetIds) ? input.referenceAssetIds.slice(0, 50) : [] })
  if (archived.error) {
    await updateTask(context, task.id, { status: 'failed', progress: 90, stage: '资产归档失败', error: 'ASSET_ARCHIVE_FAILED' })
    return archived.error
  }
  const completed = await updateTask(context, task.id, { status: 'completed', progress: 100, stage: '数据库完成并可访问', heartbeatAt: new Date().toISOString(), completedAt: new Date().toISOString(), outputIds: archived.assets.map(asset => asset.id), outputs: archived.assets.map(asset => ({ id: asset.id, url: `/api/assets/${asset.storageKey}`, name: asset.name })) })
  return json(201, { task: completed, assets: archived.assets.map(asset => ({ ...asset, url: `/api/assets/${asset.storageKey}` })) })
}
