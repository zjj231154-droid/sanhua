import { json, tokenSpaceRequest } from '../../_lib/tokenspace.js'
import { archiveImageOutputs, assetsBucket } from '../../_lib/asset-store.js'
import { saveTask, updateTask } from '../../_lib/task-store.js'

const workspaceFor = value => ['retouch', 'brand'].includes(value) ? value : null

export async function onRequestPost(context) {
  if (!assetsBucket(context)) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED', hint: '批量生图前，请在 Cloudflare Pages 设置中将 R2 Bucket 绑定为 SANHUA_ASSETS。' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = workspaceFor(input.workspace)
  const prompt = String(input.prompt || '').trim().slice(0, 12000)
  const count = Number(input.count || 4)
  if (!workspace) return json(400, { error: 'WORKSPACE_REQUIRED' })
  if (!prompt) return json(400, { error: 'PROMPT_REQUIRED' })
  if (!Number.isInteger(count) || count < 1 || count > 4) return json(400, { error: 'BATCH_COUNT_MUST_BE_BETWEEN_1_AND_4' })
  const model = String(input.model || 'gpt-image-2').slice(0, 160)
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workspace, type: 'image-batch', status: 'running', progress: 25,
    stage: `模型处理中（0/${count}）`, heartbeatAt: new Date().toISOString(), requirements: prompt,
    finalPrompt: prompt, model, createdAt: new Date().toISOString(), requestedCount: count,
  })
  const result = await tokenSpaceRequest(context, 'images/generations', {
    model, provider: 'usegoodai', payload: { model, prompt, n: count, size: input.size || '1024x1024', response_format: 'b64_json' },
  })
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
  const archived = await archiveImageOutputs(context, { taskId: task.id, workspace, outputs, model, prompt, sourceAssetIds: Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds.slice(0, 50) : [], title: input.title })
  if (archived.error) {
    await updateTask(context, task.id, { status: 'failed', progress: 90, stage: '资产归档失败', error: 'ASSET_ARCHIVE_FAILED' })
    return archived.error
  }
  const completed = await updateTask(context, task.id, { status: 'completed', progress: 100, stage: '数据库完成并可访问', heartbeatAt: new Date().toISOString(), completedAt: new Date().toISOString(), outputIds: archived.assets.map(asset => asset.id), outputs: archived.assets.map(asset => ({ id: asset.id, url: `/api/assets/${asset.storageKey}`, name: asset.name })) })
  return json(201, { task: completed, assets: archived.assets.map(asset => ({ ...asset, url: `/api/assets/${asset.storageKey}` })) })
}
