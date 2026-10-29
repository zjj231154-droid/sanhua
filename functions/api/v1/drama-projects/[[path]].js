import { ownsTask, mayReadTaskResult } from '../../../_lib/task-ownership.js'
import { json, tokenSpaceRequest, DEFAULT_REASONING_MODEL } from '../../../_lib/tokenspace.js'
import { hasPermission, requireIdentity, resolvedProviderConnection } from '../../../_lib/collaboration.js'
import { createDramaProject, dramaProjectOwned, getDramaProject, listDramaProjects, projectAssets, updateDramaProject } from '../../../_lib/drama-project-store.js'
import { createScript, listVersions, restoreVersion, saveVersion } from '../../../_lib/script-store.js'
import { createTextRecord, listTextRecords } from '../../../_lib/text-record-store.js'
import { createWorkRecord, getWorkRecord, updateWorkRecord } from '../../../_lib/work-record-store.js'
import { assetAvailableInWorkspace, assetMetadataKey, assetsBucket, getJson, listJson, normalizeAssetName, putJson } from '../../../_lib/asset-store.js'
import { getTask, updateTask } from '../../../_lib/task-store.js'
import { onRequestPost as postVideo, syncVideoTask } from '../video-tasks/[[path]].js'
import { seedanceShotJsonRules } from '../../../_lib/seedance-prompt-zh.js'

const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)
const read = async request => { try { return await request.json() } catch { return null } }
const missing = () => json(404, { error: 'DRAMA_PROJECT_NOT_FOUND' })
const unavailable = () => json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
const stamp = () => new Date().toISOString()
const generationLocks = new Set()
const videoLocks = new Set()
const clean = (value, limit = 20000) => String(value ?? '').trim().slice(0, limit)
const choices = content => {
  const text = clean(content, 50000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const first = text.indexOf('{'), last = text.lastIndexOf('}')
  if (first < 0 || last <= first) return null
  try { return JSON.parse(text.slice(first, last + 1)) } catch { return null }
}
const shotFrom = (value, index, old) => ({
  shotId: old?.shotId || crypto.randomUUID(), shotNumber: old?.shotNumber || index + 1,
  scene: clean(value.scene, 160), characters: Array.isArray(value.characters) ? value.characters.map(item => clean(item, 100)).slice(0, 8) : [],
  prompt: clean(value.prompt, 4000), action: clean(value.action, 2000), camera: clean(value.camera, 1000),
  dialogue: clean(value.dialogue, 2000), sound: clean(value.sound, 1000), negative: clean(value.negative, 1000),
  durationSeconds: Math.max(4, Math.min(15, Number(value.durationSeconds) || 8)), status: old?.status || 'ready',
  videoTaskIds: old?.videoTaskIds || [], acceptedVideoTaskId: old?.acceptedVideoTaskId || null,
  version: Number(old?.version || 0) + 1, updatedAt: stamp(),
})
const promptFor = shot => [shot.prompt, shot.action && `动作：${shot.action}`, shot.camera && `运镜：${shot.camera}`, shot.dialogue && `台词：${shot.dialogue}`, shot.sound && `声音：${shot.sound}`, shot.negative && `负向约束：${shot.negative}`].filter(Boolean).join('\n')
const projectFor = async (context, identity, id) => {
  const project = await getDramaProject(context, id)
  return dramaProjectOwned(project, identity) ? project : null
}
const modelResult = async (context, identity, instruction, content) => {
  const provider = await resolvedProviderConnection(context, identity.user.id)
  const model = provider?.reasoningModel || context.env?.USEGOODAI_REASONING_MODEL || DEFAULT_REASONING_MODEL
  const result = await tokenSpaceRequest(context, 'chat/completions', { model, provider: 'usegoodai-reasoning', payload: { model, messages: [{ role: 'system', content: instruction }, { role: 'user', content }], temperature: 0.35 } })
  if (result.response) return { response: result.response }
  const output = choices(result.data?.choices?.[0]?.message?.content)
  return output ? { output, model } : { response: json(502, { error: 'DRAMA_GENERATION_INVALID', hint: '模型未返回可解析的剧本和分镜，请重试；原项目内容已保留。' }) }
}
const sourceAssetsValid = async (context, identity, project) => {
  const bucket = assetsBucket(context)
  if (projectAssets(project).length > 9) return false
  for (const id of projectAssets(project)) {
    const asset = await getJson(bucket, assetMetadataKey(id))
    if (!asset || !mayReadTaskResult(asset, identity) || (!identity.compatibilityMode && !assetAvailableInWorkspace(asset, identity.workspaceId))) return false
    if (asset.visibility === 'private' && asset.createdBy !== identity.user.id && !hasPermission(identity.membership, 'manage')) return false
  }
  return true
}
const sourceAssetSummary = async (context, project) => {
  const groups = [['sceneAssetIds', '场景'], ['characterAssetIds', '人物'], ['propAssetIds', '道具']]
  const bucket = assetsBucket(context)
  const values = await Promise.all(groups.flatMap(([field, role]) => (project[field] || []).map(async id => {
    const asset = await getJson(bucket, assetMetadataKey(id))
    return asset ? `${role}：@${asset.name}（素材 ID ${id}）` : null
  })))
  return values.filter(Boolean).join('；') || '未选择，按文本创作'
}

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  const [id, action, target] = parts(context)
  if (!id) {
    const projects = await listDramaProjects(context, identity)
    if (!projects) return unavailable()
    const query = new URL(context.request.url).searchParams
    const page = Math.max(1, Number(query.get('page')) || 1)
    const pageSize = Math.max(1, Math.min(100, Number(query.get('pageSize')) || projects.length || 20))
    const start = (page - 1) * pageSize
    return json(200, { projects: projects.slice(start, start + pageSize), total: projects.length, page, pageSize, nextPage: start + pageSize < projects.length ? page + 1 : null })
  }
  let project = await projectFor(context, identity, id)
  if (!project) return missing()
  if (action === 'video-tasks') {
    const tasks = (await Promise.all(project.videoTaskIds.map(async taskId => {
      const task = await getTask(context, taskId)
      return task && task.projectId === id && ownsTask(task, identity) ? syncVideoTask(context, task) : null
    }))).filter(Boolean).filter(task => !task.discardedAt)
    if (target) {
      const task = tasks.find(item => item.id === target)
      return task ? json(200, { task }) : json(404, { error: 'VIDEO_TASK_NOT_FOUND' })
    }
    const shots = project.shots.map(shot => {
      const latest = [...(shot.videoTaskIds || [])].reverse().map(taskId => tasks.find(task => task.id === taskId)).find(Boolean)
      const status = shot.submissionError ? 'failed' : latest?.status === 'failed' ? 'failed' : latest?.status === 'cancelled' ? 'cancelled' : latest?.status === 'completed' ? 'succeeded' : latest ? 'generating' : shot.status
      return status === shot.status ? shot : { ...shot, status }
    })
    if (shots.some((shot, index) => shot !== project.shots[index])) project = await updateDramaProject(context, project, { shots, status: tasks.some(task => ['queued', 'running'].includes(task.status)) ? 'generating' : shots.some(shot => shot.status === 'failed') ? 'failed' : 'ready' })
    return json(200, { tasks, project })
  }
  if (action === 'text-records') {
    let cursor, all = []
    do {
      const page = await listTextRecords(context, { workspace: 'script', limit: 80, cursor })
      if (!page) return unavailable()
      all = [...all, ...page.records.filter(record => record.projectId === id)]
      cursor = page.nextCursor
    } while (cursor && all.length < 500)
    return json(200, { records: all })
  }
  if (action === 'versions') return project.scriptId ? json(200, { versions: await listVersions(context, project.scriptId) }) : json(200, { versions: [] })
  return action ? json(404, { error: 'DRAMA_ROUTE_NOT_FOUND' }) : json(200, { project })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id, action, target, tail] = parts(context)
  const input = await read(context.request)
  if (!input) return json(400, { error: 'INVALID_JSON' })
  if (!id) {
    if (input.sceneAssetIds?.length || input.characterAssetIds?.length || input.propAssetIds?.length) {
      if (!(await sourceAssetsValid(context, identity, input))) return json(422, { error: 'REFERENCE_ASSET_INVALID' })
    }
    const project = await createDramaProject(context, identity, input)
    return project ? json(201, { project }) : unavailable()
  }
  let project = await projectFor(context, identity, id)
  if (!project) return missing()
  context = { ...context, workRecordId: project.currentTaskId }
  if ((await getWorkRecord(context, project.currentTaskId))?.status === 'cancelled') return json(409, { error: 'TASK_CANCELLED' })
  if (action === 'generate-script-storyboard') {
    if (!clean(project.brief)) return json(422, { error: 'DRAMA_BRIEF_REQUIRED' })
    if (project.scriptId && !input.regenerate) return json(200, { project, idempotent: true })
    if (project.status === 'generating' || generationLocks.has(id)) return json(409, { error: 'DRAMA_GENERATION_RUNNING' })
    if (!(await sourceAssetsValid(context, identity, project))) return json(422, { error: 'REFERENCE_ASSET_INVALID' })
    generationLocks.add(id)
    try {
    project = await updateDramaProject(context, project, { status: 'generating' })
    const instruction = `你是短剧编导，一次生成剧本和可直接用于 Seedance 的分镜。只输出 JSON 对象，字段必须为 summary 字符串、characters 字符串数组、scenes 字符串数组、script 字符串、shots 数组。shots 至少 1 项，每项包含 scene、characters 数组、prompt、action、camera、dialogue、sound、negative、durationSeconds(4到15)。${seedanceShotJsonRules}`
    const result = await modelResult(context, identity, instruction, `项目：${project.title}\n创作需求：${project.brief}\n已确认素材：${await sourceAssetSummary(context, project)}`)
    if (result.response) { await updateDramaProject(context, project, { status: 'failed' }); return result.response }
    const output = result.output
    if (!clean(output.script) || !Array.isArray(output.shots) || !output.shots.length || !output.shots.some(item => clean(item.prompt))) {
      await updateDramaProject(context, project, { status: 'failed' })
      return json(502, { error: 'DRAMA_GENERATION_INCOMPLETE', hint: '模型没有同时返回剧本和分镜，请重试。' })
    }
    const script = await createScript(context, { workspaceId: identity.workspaceId, projectId: id, createdBy: identity.user.id, title: project.title, kind: '短剧剧本', summary: clean(output.summary, 3000), outline: clean(output.script, 12000), content: clean(output.script, 24000), sourceAssetIds: projectAssets(project) })
    if (!script) return unavailable()
    const storyboardId = crypto.randomUUID(), storyboardVersionId = crypto.randomUUID()
    const shots = output.shots.slice(0, 50).map((item, index) => shotFrom(item, index))
    const bucket = assetsBucket(context)
    await putJson(bucket, `metadata/drama-storyboards/${id}/${storyboardVersionId}.json`, { projectId: id, storyboardId, versionId: storyboardVersionId, shots, createdAt: stamp() })
    const scriptRecord = await createTextRecord(context, { workspaceId: identity.workspaceId, projectId: id, createdBy: identity.user.id, workspace: 'script', sourceModule: 'drama-project.script', recordType: 'script', title: `${project.title} · 剧本`, content: script.content, contentFormat: 'markdown', sourceTaskId: project.currentTaskId, scriptId: script.id, scriptVersionId: script.currentVersionId })
    const storyboardRecord = await createTextRecord(context, { workspaceId: identity.workspaceId, projectId: id, createdBy: identity.user.id, workspace: 'script', sourceModule: 'drama-project.storyboard', recordType: 'storyboard_prompt', title: `${project.title} · 分镜提示词`, content: shots.map(shot => `镜头 ${shot.shotNumber}\n${promptFor(shot)}`).join('\n\n'), contentFormat: 'prompt', sourceTaskId: project.currentTaskId, scriptId: script.id, scriptVersionId: script.currentVersionId, storyboardId, storyboardVersionId })
    project = await updateDramaProject(context, project, { stage: 'script_storyboard', status: 'needs_review', scriptId: script.id, scriptVersionId: script.currentVersionId, storyboardId, storyboardVersionId, script: { summary: clean(output.summary, 3000), content: script.content, characters: output.characters || [], scenes: output.scenes || [], version: 1 }, shots, textRecordIds: [scriptRecord?.id, storyboardRecord?.id].filter(Boolean) })
    return json(200, { project })
    } catch (error) {
      await updateDramaProject(context, project, { status: 'failed' }).catch(() => {})
      return json(502, { error: 'DRAMA_GENERATION_FAILED', hint: error.message || '生成失败，原项目内容已保留。' })
    } finally { generationLocks.delete(id) }
  }
  if (action === 'regenerate-section') {
    const targetType = input.targetType === 'shot' ? 'shot' : input.targetType === 'script' ? 'script' : ''
    if (!targetType) return json(400, { error: 'INVALID_REGENERATION_TARGET' })
    const shot = targetType === 'shot' ? project.shots.find(item => item.shotId === input.targetId) : null
    if (targetType === 'shot' && !shot) return json(404, { error: 'SHOT_NOT_FOUND' })
    const scriptContent = project.script?.content || ''
    const targetStart = Number(input.targetStart)
    const targetText = String(input.targetText || '')
    if (targetType === 'script' && (!Number.isInteger(targetStart) || targetStart < 0 || !targetText.trim() || scriptContent.slice(targetStart, targetStart + targetText.length) !== targetText)) return json(409, { error: 'SCRIPT_SECTION_CHANGED', hint: '当前段落已变更，请刷新项目后重试。' })
    const instruction = targetType === 'shot'
      ? `仅重新生成当前短剧镜头。只返回 JSON 对象，字段 scene、characters 数组、prompt、action、camera、dialogue、sound、negative、durationSeconds。保持与剧本及邻近镜头连续，不改其他镜头。${seedanceShotJsonRules}`
      : '只改写以下短剧剧本段落，保持人物和主线。只返回 JSON 对象，字段 content 字符串。'
    const content = targetType === 'shot' ? `剧本：${project.script?.content}\n当前镜头：${JSON.stringify(shot)}\n修改要求：${clean(input.instructions, 2000) || '优化当前镜头'}` : `完整剧本仅用于理解上下文：${scriptContent}\n仅改写这一段：${targetText}\n修改要求：${clean(input.instructions, 2000) || '优化当前段落'}`
    const result = await modelResult(context, identity, instruction, content)
    if (result.response) return result.response
    if (targetType === 'shot') {
      if (!clean(result.output.prompt)) return json(502, { error: 'SHOT_GENERATION_INCOMPLETE' })
      const nextShot = shotFrom(result.output, shot.shotNumber - 1, shot)
      const shots = project.shots.map(item => item.shotId === shot.shotId ? nextShot : item)
      const storyboardVersionId = crypto.randomUUID()
      await putJson(assetsBucket(context), `metadata/drama-storyboards/${id}/${storyboardVersionId}.json`, { projectId: id, storyboardId: project.storyboardId, versionId: storyboardVersionId, shots, createdAt: stamp() })
      const record = await createTextRecord(context, { workspaceId: identity.workspaceId, projectId: id, createdBy: identity.user.id, workspace: 'script', sourceModule: 'drama-project.storyboard', recordType: 'storyboard_prompt', title: `${project.title} · 镜头 ${shot.shotNumber} 重新生成`, content: promptFor(nextShot), contentFormat: 'prompt', sourceTaskId: project.currentTaskId, scriptId: project.scriptId, scriptVersionId: project.scriptVersionId, storyboardId: project.storyboardId, storyboardVersionId, shotId: shot.shotId })
      project = await updateDramaProject(context, project, { shots, storyboardVersionId, status: 'needs_review', textRecordIds: [...project.textRecordIds, record?.id].filter(Boolean) })
    } else {
      if (!clean(result.output.content)) return json(502, { error: 'SCRIPT_GENERATION_INCOMPLETE' })
      const replaced = `${scriptContent.slice(0, targetStart)}${clean(result.output.content, 12000)}${scriptContent.slice(targetStart + targetText.length)}`
      const version = await saveVersion(context, project.scriptId, { content: replaced, outline: replaced, updatedBy: identity.user.id, changeNote: '重新生成当前段落' })
      const record = await createTextRecord(context, { workspaceId: identity.workspaceId, projectId: id, createdBy: identity.user.id, workspace: 'script', sourceModule: 'drama-project.script', recordType: 'script', title: `${project.title} · 剧本重新生成`, content: version.script.content, contentFormat: 'markdown', sourceTaskId: project.currentTaskId, scriptId: project.scriptId, scriptVersionId: version.script.currentVersionId })
      project = await updateDramaProject(context, project, { scriptVersionId: version.script.currentVersionId, script: { ...project.script, content: version.script.content, version: (project.script?.version || 1) + 1 }, status: 'needs_review', textRecordIds: [...project.textRecordIds, record?.id].filter(Boolean) })
    }
    return json(200, { project })
  }
  if (action === 'confirm-script-storyboard') {
    if (!project.scriptId || !project.shots?.length) return json(409, { error: 'SCRIPT_STORYBOARD_REQUIRED' })
    project = await updateDramaProject(context, project, { stage: 'video', status: 'ready' })
    return json(200, { project })
  }
  if (action === 'restore-version') {
    if (!project.scriptId || !clean(input.versionId, 160)) return json(422, { error: 'SCRIPT_VERSION_REQUIRED' })
    const restored = await restoreVersion(context, project.scriptId, input.versionId, identity.user.id)
    if (!restored) return json(404, { error: 'SCRIPT_VERSION_NOT_FOUND' })
    project = await updateDramaProject(context, project, { scriptVersionId: restored.currentVersionId, script: { ...project.script, content: restored.content, summary: restored.summary, version: (project.script?.version || 1) + 1 }, status: 'needs_review' })
    return json(200, { project })
  }
  if (action === 'video-tasks') {
    if (project.stage !== 'video' && project.stage !== 'completed') return json(409, { error: 'CONFIRM_SCRIPT_STORYBOARD_FIRST' })
    const mode = ['single', 'selected', 'all', 'failed'].includes(input.mode) ? input.mode : 'selected'
    if (target) {
      const task = await getTask(context, target)
      if (!ownsTask(task, identity) || !project.videoTaskIds.includes(target)) return json(404, { error: 'VIDEO_TASK_NOT_FOUND' })
      if (tail === 'discard') {
        if (task.videoAssetId) return json(409, { error: 'ARCHIVED_VIDEO_CANNOT_DISCARD' })
        if (['queued', 'running'].includes(task.status)) return json(409, { error: 'VIDEO_TASK_STILL_RUNNING' })
        await updateTask(context, task.id, { discardedAt: stamp(), hiddenAt: stamp() })
        const shots = project.shots.map(shot => shot.shotId === task.shotId ? { ...shot, status: 'ready' } : shot)
        project = await updateDramaProject(context, project, { shots })
        return json(200, { project, taskId: task.id, discarded: true })
      }
      if (tail === 'retry') input.mode = 'single', input.shotIds = [task.shotId], input.regenerate = true
      else return json(404, { error: 'DRAMA_ROUTE_NOT_FOUND' })
    }
    const resolvedMode = input.mode || mode
    const selected = resolvedMode === 'all' ? project.shots : resolvedMode === 'failed' ? project.shots.filter(shot => shot.status === 'failed') : project.shots.filter(shot => (input.shotIds || []).includes(shot.shotId))
    if (!selected.length || selected.length > 20) return json(422, { error: 'SHOT_SELECTION_REQUIRED' })
    if (videoLocks.has(id)) return json(409, { error: 'VIDEO_SUBMISSION_RUNNING' })
    videoLocks.add(id)
    try {
    const created = [], errors = [], textRecordIds = [...project.textRecordIds]
    for (const shot of selected) {
      const existing = await Promise.all((shot.videoTaskIds || []).map(taskId => getTask(context, taskId)))
      const active = [...existing].reverse().find(task => task && (['queued', 'running'].includes(task.status) || (!input.regenerate && task.status === 'completed')))
      if (active) { created.push(active); continue }
      const generationParams = { aspectRatio: input.aspectRatio || '9:16', resolution: input.resolution || '720p', durationSeconds: resolvedMode === 'single' ? input.durationSeconds || shot.durationSeconds : shot.durationSeconds }
      const work = await createWorkRecord(context, { moduleKey: 'video', moduleName: '短剧视频', workspaceId: identity.workspaceId, ownerUserId: identity.user.id, title: `${project.title} · 镜头 ${shot.shotNumber}`, route: 'video', currentStep: 3, sourceProjectId: id, sourceScriptId: project.scriptId, sourceShotId: shot.shotId, inputAssetIds: projectAssets(project), generationParams, clientSessionId: `drama-video-${id}-${shot.shotId}-${crypto.randomUUID()}`, initialData: { dramaProjectId: id, shotId: shot.shotId, prompt: promptFor(shot), generationParams } })
      const body = { workRecordId: work.taskId, projectId: id, shotId: shot.shotId, storyboardId: project.storyboardId, scriptId: project.scriptId, scriptVersionId: project.scriptVersionId, assetRefs: { scene: project.sceneAssetIds, character: project.characterAssetIds, prop: project.propAssetIds }, videoPrompt: promptFor(shot), shotPlan: promptFor(shot), aspectRatio: input.aspectRatio || '9:16', resolution: input.resolution || '720p', durationSeconds: resolvedMode === 'single' ? input.durationSeconds || shot.durationSeconds : shot.durationSeconds, title: `${project.title} · 镜头 ${shot.shotNumber}` }
      const response = await postVideo({ ...context, request: new Request(context.request.url, { method: 'POST', headers: context.request.headers, body: JSON.stringify(body) }), params: { path: '' } })
      const data = await response.json()
      if (!response.ok) {
        const message = data.hint || data.missing?.join('、') || data.error || '视频提交失败'
        errors.push({ shotId: shot.shotId, error: message, missing: data.missing })
        shot.status = 'failed'
        shot.submissionError = message
        await updateWorkRecord(context, work.taskId, { status: 'failed', errorCode: data.error || 'VIDEO_SUBMISSION_FAILED', errorMessage: message, operationSummary: '视频提交失败，可返回项目重试' })
        continue
      }
      const task = await updateTask(context, data.task.id, { projectId: id, sourceProjectId: id, shotId: shot.shotId, sourceShotId: shot.shotId, storyboardId: project.storyboardId, sourceStoryboardId: project.storyboardId, scriptId: project.scriptId, sourceScriptId: project.scriptId, sourceAssetIds: projectAssets(project) })
      if (data.textRecordId) textRecordIds.push(data.textRecordId)
      shot.videoTaskIds = [...(shot.videoTaskIds || []), task.id]
      shot.status = task.status === 'completed' ? 'succeeded' : 'generating'
      shot.submissionError = ''
      created.push(task)
    }
    project = await updateDramaProject(context, project, { shots: project.shots, videoTaskIds: [...new Set([...project.videoTaskIds, ...created.map(task => task.id)])], textRecordIds: [...new Set(textRecordIds)], status: created.length ? 'generating' : errors.length ? 'failed' : project.status })
    return json(created.length ? 202 : 422, { project, tasks: created, errors, ...(created.length ? {} : { error: 'VIDEO_SUBMISSION_FAILED', hint: errors.map(item => item.error).join('；') }) })
    } finally { videoLocks.delete(id) }
  }
  if (action === 'video-assets' && tail === 'accept') {
    const task = await getTask(context, target)
    if (!ownsTask(task, identity) || task.projectId !== id || !project.videoTaskIds.includes(target)) return json(404, { error: 'VIDEO_TASK_NOT_FOUND' })
    if (task.status !== 'completed' || !task.providerVideoUrl) return json(409, { error: 'VIDEO_RESULT_NOT_READY' })
    if (task.videoAssetId) return json(200, { project, assetId: task.videoAssetId, idempotent: true })
    const shot = project.shots.find(item => item.shotId === task.shotId)
    if (!shot) return json(404, { error: 'SHOT_NOT_FOUND' })
    const assetId = crypto.randomUUID(), now = stamp()
    const wanted = normalizeAssetName(input.name || `${project.title}-第1集-镜头${String(shot.shotNumber).padStart(2, '0')}-视频-${now.replace(/[-:.TZ]/g, '')}`)
    const names = new Set((await listJson(assetsBucket(context), 'metadata/assets/', 1000)).filter(item => item.assetType === 'video' && item.workspaceId === identity.workspaceId).map(item => item.name))
    let base = wanted, index = 2
    while (names.has(base)) base = `${wanted}-v${index++}`
    const asset = { id: assetId, visibility: 'private', ownerUserId: identity.user.id, workspaceId: identity.workspaceId, tenantId: identity.workspaceId, projectId: id, sourceProjectId: id, scriptId: project.scriptId, sourceScriptId: project.scriptId, storyboardId: project.storyboardId, sourceStoryboardId: project.storyboardId, shotId: shot.shotId, sourceShotId: shot.shotId, sourceAssetIds: projectAssets(project), videoTaskId: task.id, sourceTaskId: task.workRecordId, providerTaskId: task.providerTaskId, assetType: 'video', assetSpace: 'script', libraryKey: 'video', folderKey: 'result', name: base, displayName: base, downloadName: `${base}.mp4`, externalUrl: task.providerVideoUrl, mimeType: 'video/mp4', status: 'succeeded', createdBy: identity.user.id, createdAt: now, updatedAt: now, version: 1 }
    await putJson(assetsBucket(context), assetMetadataKey(assetId), asset)
    await updateTask(context, task.id, { videoAssetId: assetId, acceptedAt: now })
    if (task.workRecordId) {
      const record = await getWorkRecord(context, task.workRecordId)
      if (record) await updateWorkRecord(context, task.workRecordId, { resultAssetIds: [...(record.resultAssetIds || []), assetId], status: 'succeeded', progress: 100, operationSummary: '视频已接受并归档' })
    }
    const shots = project.shots.map(item => item.shotId === shot.shotId ? { ...item, acceptedVideoTaskId: task.id, status: 'succeeded' } : item)
    project = await updateDramaProject(context, project, { shots, stage: shots.every(item => item.acceptedVideoTaskId) ? 'completed' : project.stage, status: shots.every(item => item.acceptedVideoTaskId) ? 'ready' : project.status })
    if (project.currentTaskId) {
      const record = await getWorkRecord(context, project.currentTaskId)
      if (record) await updateWorkRecord(context, project.currentTaskId, { resultAssetIds: [...(record.resultAssetIds || []), assetId], operationSummary: '短剧视频已接受并归档' })
    }
    return json(200, { project, assetId })
  }
  if (action === 'archive') {
    project = await updateDramaProject(context, project, { status: 'archived', archivedAt: stamp() })
    return json(200, { project })
  }
  return json(404, { error: 'DRAMA_ROUTE_NOT_FOUND' })
}

export async function onRequestPatch(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id, action, shotId] = parts(context)
  const input = await read(context.request)
  if (!input) return json(400, { error: 'INVALID_JSON' })
  const current = await projectFor(context, identity, id)
  if (!current) return missing()
  let patch
  if (!action) {
    patch = { title: input.title, brief: input.brief, sceneAssetIds: input.sceneAssetIds, characterAssetIds: input.characterAssetIds, propAssetIds: input.propAssetIds, selectedShotId: input.selectedShotId }
    if (!(await sourceAssetsValid(context, identity, { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) }))) return json(422, { error: 'REFERENCE_ASSET_INVALID' })
  }
  else if (action === 'script') {
    if (!current.scriptId) return json(409, { error: 'SCRIPT_REQUIRED' })
    const version = await saveVersion(context, current.scriptId, { content: input.content, outline: input.content, summary: input.summary, updatedBy: identity.user.id, changeNote: '在项目工作台修改' })
    const record = await createTextRecord(context, { workspaceId: identity.workspaceId, projectId: id, createdBy: identity.user.id, workspace: 'script', sourceModule: 'drama-project.script', recordType: 'script', title: `${current.title} · 剧本版本 ${version.version.versionNo}`, content: version.script.content, contentFormat: 'markdown', sourceTaskId: current.currentTaskId, scriptId: current.scriptId, scriptVersionId: version.script.currentVersionId })
    patch = { script: { ...current.script, content: version.script.content, summary: version.script.summary, version: (current.script?.version || 1) + 1 }, scriptVersionId: version.script.currentVersionId, textRecordIds: [...current.textRecordIds, record.id] }
  } else if (action === 'shots' && shotId) {
    const shot = current.shots.find(item => item.shotId === shotId)
    if (!shot) return json(404, { error: 'SHOT_NOT_FOUND' })
    const nextShot = shotFrom({ ...shot, ...input }, shot.shotNumber - 1, shot)
    const shots = current.shots.map(item => item.shotId === shotId ? nextShot : item)
    const storyboardVersionId = crypto.randomUUID()
    await putJson(assetsBucket(context), `metadata/drama-storyboards/${id}/${storyboardVersionId}.json`, { projectId: id, storyboardId: current.storyboardId, versionId: storyboardVersionId, shots, createdAt: stamp() })
    const record = await createTextRecord(context, { workspaceId: identity.workspaceId, projectId: id, createdBy: identity.user.id, workspace: 'script', sourceModule: 'drama-project.storyboard', recordType: 'storyboard_prompt', title: `${current.title} · 镜头 ${shot.shotNumber} 分镜版本`, content: promptFor(nextShot), contentFormat: 'prompt', sourceTaskId: current.currentTaskId, scriptId: current.scriptId, scriptVersionId: current.scriptVersionId, storyboardId: current.storyboardId, storyboardVersionId, shotId })
    patch = { shots, storyboardVersionId, textRecordIds: [...current.textRecordIds, record.id] }
  } else return json(404, { error: 'DRAMA_ROUTE_NOT_FOUND' })
  const project = await updateDramaProject(context, current, { ...patch, expectedVersion: input.expectedVersion })
  return project?.conflict ? json(409, { error: 'VERSION_CONFLICT', currentVersion: project.conflict.version }) : json(200, { project })
}
