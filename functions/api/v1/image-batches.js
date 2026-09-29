import { json, tokenSpaceRequest } from '../../_lib/tokenspace.js'
import { archiveImageOutputs, assetsBucket } from '../../_lib/asset-store.js'
import { saveTask, updateTask } from '../../_lib/task-store.js'
import { createTextRecord } from '../../_lib/text-record-store.js'
import { requireIdentity, resolvedImageProviderConnection } from '../../_lib/collaboration.js'

const workspaceFor = value => ['retouch', 'brand'].includes(value) ? value : null

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit')
  if (identity.error) return identity.error
  if (!assetsBucket(context)) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED', hint: '请在 Cloudflare Pages 绑定 SANHUA_ASSETS，或在 Railway 挂载 Volume 并设置 SANHUA_STORAGE_DIR。' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = workspaceFor(input.workspace)
  const prompt = String(input.prompt || '').trim().slice(0, 12000)
  const submittedImages = Array.isArray(input.images) ? input.images.filter(value => typeof value === 'string') : []
  const referenceImage = typeof input.referenceImage === 'string' ? input.referenceImage : ''
  const brandPhase = String(input.metadata?.brandPhase || '')
  const count = Number(input.count || (input.workspace === 'retouch' ? 1 : 4))
  if (!workspace) return json(400, { error: 'WORKSPACE_REQUIRED' })
  if (!prompt) return json(400, { error: 'PROMPT_REQUIRED' })
  const limit = workspace === 'retouch' ? 10 : 4
  if (!Number.isInteger(count) || count < 1 || count > limit) return json(400, { error: 'BATCH_LIMIT_EXCEEDED', limit })
  if (submittedImages.length > limit || (Array.isArray(input.sourceAssetIds) && input.sourceAssetIds.length > limit)) return json(400, { error: 'BATCH_LIMIT_EXCEEDED', limit })
  if (workspace === 'retouch' && !submittedImages.length) return json(400, { error: 'IMAGE_REQUIRED' })
  if (workspace === 'brand' && ['product-effect', 'graphic-effect'].includes(brandPhase) && !submittedImages.length) return json(400, { error: 'REFERENCE_IMAGE_REQUIRED', hint: '品牌效果图必须携带原始参考图。' })
  if (workspace === 'brand' && brandPhase === 'product-effect' && input.metadata?.dielineRequired && (!input.metadata?.dielineConfirmed || !input.metadata?.dielineAssetId)) return json(409, { error: 'DIELINE_CONFIRMATION_REQUIRED', hint: '已选择生成新刀版图，请先确认刀版图，再生成产品效果图。' })
  const images = submittedImages
  const providerConnection = await resolvedImageProviderConnection(context, identity.user.id)
  const model = String(input.model || providerConnection?.imageModel || 'gpt-image-2').slice(0, 160)
  const requestedName = String(input.requestedName || input.requested_name || '').trim().slice(0, 160)
  const namePrefix = String(input.namePrefix || input.name_prefix || '').trim().slice(0, 160)
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workspace, workspaceId: identity.workspaceId, projectId: workspace, createdBy: identity.user.id, updatedBy: identity.user.id, version: 1, type: 'image-batch', status: 'running', progress: 25,
    stage: `模型处理中（0/${count}）`, heartbeatAt: new Date().toISOString(), requirements: prompt,
    finalPrompt: String(input.metadata?.finalPrompt || prompt).slice(0, 12000), originalPlan: String(input.metadata?.originalPlan || '').slice(0, 12000), model, createdAt: new Date().toISOString(), requestedCount: count, requestedName, namePrefix,
  })
  const textRecord = await createTextRecord(context, {
    workspace, sourceModule: `${workspace}.prompts`, recordType: workspace === 'brand' ? 'brand_prompt' : 'retouch_prompt',
    workspaceId: identity.workspaceId, projectId: workspace, createdBy: identity.user.id, updatedBy: identity.user.id, title: requestedName || (workspace === 'brand' ? '品牌创作最终提示词' : '产品精修最终提示词'), content: String(input.metadata?.finalPrompt || prompt), contentFormat: 'prompt', model, provider: 'usegoodai', sourceTaskId: task.id,
    sourceAssetIds: Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds : [], referenceAssetIds: Array.isArray(input.referenceAssetIds) ? input.referenceAssetIds : [],
  })
  await updateTask(context, task.id, { textRecordId: textRecord?.id || null })
  const dataUrlToBlob = (value, label) => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value || '')
    if (!match) return null
    const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
    return { blob: new Blob([bytes], { type: match[1] }), extension: match[1].split('/')[1], name: label }
  }
  let outputs = []
  if (images.length) {
    const template = referenceImage ? dataUrlToBlob(referenceImage, 'reference-template') : null
    if (referenceImage && !template) return json(400, { error: '图片必须是 PNG、JPG 或 WebP 的 Data URL' })
    for (let index = 0; index < images.length; index += 1) {
      const source = dataUrlToBlob(images[index], `source-${index + 1}`)
      if (!source) {
        await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '输入图片无效', error: 'INVALID_IMAGE_INPUT' })
        return json(400, { error: '图片必须是 PNG、JPG 或 WebP 的 Data URL' })
      }
      await updateTask(context, task.id, { progress: Math.round(25 + (index / images.length) * 55), stage: `模型处理中（${index + 1}/${images.length}）`, heartbeatAt: new Date().toISOString() })
      const form = new FormData()
      form.append('model', model)
      form.append('prompt', prompt)
      form.append('response_format', 'b64_json')
      // 每张产品图单独编辑；可选模板作为第二张参考图。所有请求复用同一份最终提示词。
      const field = template ? 'image[]' : 'image'
      form.append(field, source.blob, `${source.name}.${source.extension}`)
      if (template) form.append('image[]', template.blob, `${template.name}.${template.extension}`)
      const result = await tokenSpaceRequest(context, 'images/edits', { model, form, provider: 'usegoodai', useImageConnection: true })
      if (result.response) {
        await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '模型调用失败', error: '图片模型未返回结果' })
        return result.response
      }
      const output = Array.isArray(result.data?.data) ? result.data.data[0] : null
      if (!output) {
        await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '模型未返回图片', error: 'MODEL_RETURNED_NO_IMAGES' })
        return json(502, { error: 'MODEL_RETURNED_NO_IMAGES', taskId: task.id, index: index + 1 })
      }
      outputs.push(output)
    }
  } else {
    const result = await tokenSpaceRequest(context, 'images/generations', {
      model, provider: 'usegoodai', useImageConnection: true, payload: { model, prompt, n: count, size: input.size || '1024x1024', response_format: 'b64_json' },
    })
    if (result.response) {
      await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '模型调用失败', error: '图片模型未返回结果' })
      return result.response
    }
    outputs = Array.isArray(result.data?.data) ? result.data.data : []
  }
  if (!outputs.length) {
    await updateTask(context, task.id, { status: 'failed', progress: 25, stage: '模型未返回图片', error: 'MODEL_RETURNED_NO_IMAGES' })
    return json(502, { error: 'MODEL_RETURNED_NO_IMAGES', taskId: task.id })
  }
  await updateTask(context, task.id, { progress: 90, stage: `归档图片（${outputs.length}/${count}）`, heartbeatAt: new Date().toISOString() })
  const archived = await archiveImageOutputs(context, { taskId: task.id, workspace, outputs, model, prompt, sourceAssetIds: Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds.slice(0, limit) : [], title: input.title, requestedName, namePrefix, promptSummary: input.promptSummary, referenceAssetIds: Array.isArray(input.referenceAssetIds) ? input.referenceAssetIds.slice(0, limit) : [], originalPlan: input.metadata?.originalPlan, finalPrompt: input.metadata?.finalPrompt || prompt, brandPhase })
  if (archived.error) {
    await updateTask(context, task.id, { status: 'failed', progress: 90, stage: '资产归档失败', error: 'ASSET_ARCHIVE_FAILED' })
    return archived.error
  }
  const completed = await updateTask(context, task.id, { status: 'completed', progress: 100, stage: '数据库完成并可访问', heartbeatAt: new Date().toISOString(), completedAt: new Date().toISOString(), outputIds: archived.assets.map(asset => asset.id), outputs: archived.assets.map(asset => ({ id: asset.id, url: `/api/assets/${asset.storageKey}`, name: asset.name })) })
  return json(201, { task: completed, textRecordId: textRecord?.id || null, assets: archived.assets.map(asset => ({ ...asset, url: `/api/assets/${asset.storageKey}` })) })
}
