import { json } from '../../../_lib/tokenspace.js'
import { getScript } from '../../../_lib/script-store.js'
import { saveTask, listTasks } from '../../../_lib/task-store.js'

const inputFrom = async request => { try { return await request.json() } catch { return null } }
const validate = async (context, input) => {
  const missing = []
  const scriptId = String(input?.scriptId || '').trim()
  const scriptVersionId = String(input?.scriptVersionId || '').trim()
  const sceneAssetIds = Array.isArray(input?.sceneAssetIds) ? input.sceneAssetIds.filter(Boolean).slice(0, 50) : []
  const shotPlan = String(input?.shotPlan || '').trim()
  const durationSeconds = Number(input?.durationSeconds || 0)
  const script = scriptId ? await getScript(context, scriptId) : null
  if (!script || script.deletedAt) missing.push('已保存剧本')
  if (!scriptVersionId || script?.currentVersionId !== scriptVersionId) missing.push('当前已保存剧本版本')
  if (!sceneAssetIds.length) missing.push('至少一个场景资产')
  if (shotPlan.length < 12) missing.push('分镜或分场说明')
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 1800) missing.push('1-1800 秒的预计时长')
  const providerConfigured = Boolean(String(context.env?.VIDEO_API_KEY || context.env?.USEGOODAI_VIDEO_API_KEY || '').trim())
  return { missing, scriptId, scriptVersionId, sceneAssetIds, shotPlan, durationSeconds, providerConfigured }
}

const route = context => String(context.params?.path || '').replace(/^\//, '')

export async function onRequestGet(context) {
  return json(200, { tasks: (await listTasks(context, { workspace: 'video' })).slice(0, 100) })
}

export async function onRequestPost(context) {
  const input = await inputFrom(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  const checked = await validate(context, input)
  if (route(context) === 'validate') return json(checked.missing.length ? 422 : 200, { ready: !checked.missing.length, missing: checked.missing, providerConfigured: checked.providerConfigured, notice: checked.providerConfigured ? '视频模型配置已检测到，实际渲染服务待接入。' : '视频模型未接入，创建任务后将保留为模拟任务。' })
  if (checked.missing.length) return json(422, { error: 'VIDEO_TASK_INVALID', missing: checked.missing })
  const createdAt = new Date().toISOString()
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workspace: 'video', type: 'video-generation', status: 'queued', progress: 0,
    stage: checked.providerConfigured ? '等待视频服务接入' : '视频模型未接入（模拟任务）', heartbeatAt: createdAt,
    requirements: checked.shotPlan, assets: checked.sceneAssetIds, sourceAssetIds: checked.sceneAssetIds,
    scriptId: checked.scriptId, scriptVersionId: checked.scriptVersionId, durationSeconds: checked.durationSeconds,
    simulated: !checked.providerConfigured, createdAt,
  })
  return json(202, { task, notice: checked.providerConfigured ? '视频任务已创建，当前服务尚未执行渲染。' : '视频模型未接入，已创建可追踪的模拟任务。' })
}
