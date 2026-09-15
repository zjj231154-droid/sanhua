import { json, tokenSpaceRequest, DEFAULT_REASONING_MODEL } from '../../_lib/tokenspace.js'
import { registryFor } from '../../_lib/skills.js'
import { saveTask, updateTask } from '../../_lib/task-store.js'
const allowed = new Set(['retouch', 'brand', 'script'])
const textFor = (workspace, input = {}) => {
  const requirements = String(input.requirements || input.prompt || '').slice(0, 10000)
  if (workspace === 'brand') return `你是品牌创作设计助手，遵循 gpt-image-2-prompt-engine 的 Prompt as Code 方法。请把需求拆解为 Subject、Composition、Material、Typography、Lighting、Style、Constraints 七个维度，先给出 3 个可选创意方向，再给出一个可执行的 GPT-Image-2 图片提示词。必须保留用户指定的文字和 Logo，禁止乱码，不要声称已通过 VI 合规检查。需求：${requirements}`
  if (workspace === 'script') return `你是短剧制作工作台的编导助手，Skill short-drama-production v1.0.0。按“选题立项→故事规划→角色→分集目录→分集剧本→合规审查→资产/场次/镜头→提示词→交付”的阶段推进；本次先输出可确认的选题方向和故事规划，包含题材、受众、基调、开场钩子、人物关系、冲突、分场位置、道具、预计时长和待确认项。全部剧情必须发生在客户真实茶馆，不得虚构房间、设备或大规模场面；不要复制对标台词，不要直接发布或生成视频。需求：${requirements}`
  return `你是产品精修助手，遵循 image-edit-agent 1.1.0：先确认尺寸/比例、场景、装饰和保留项，再形成图片编辑计划。默认保护杯瓶轮廓、标签、Logo、文字和饮品质感，默认不新增道具。不要直接执行图片编辑。需求：${requirements}`
}
export async function onRequestPost(context) {
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = String(input.workspace || '')
  const skill = registryFor(workspace)
  if (!allowed.has(workspace) || !skill || skill.status !== 'enabled') return json(400, { error: 'SKILL_NOT_AVAILABLE', workspace })
  const model = input.model || context.env?.USEGOODAI_REASONING_MODEL || DEFAULT_REASONING_MODEL
  const task = await saveTask(context, { id: crypto.randomUUID(), workspace, type: 'agent-plan', status: 'running', progress: 10, stage: 'Skill 解析与计划固化', heartbeatAt: new Date().toISOString(), requirements: requirementsText(input), assets: Array.isArray(input.assets) ? input.assets.slice(0, 50) : [], model, createdAt: new Date().toISOString() })
  const prompt = textFor(workspace, input)
  const result = await tokenSpaceRequest(context, 'chat/completions', { model, provider: 'usegoodai', payload: { model, messages: [{ role: 'system', content: prompt }, { role: 'user', content: requirementsText(input) }], temperature: 0.35 } })
  if (result.response) { await updateTask(context, task.id, { status: 'failed', progress: 10, stage: '模型调用失败', error: 'UseGoodAI 请求失败' }); return result.response }
  const content = result.data?.choices?.[0]?.message?.content || ''
  await updateTask(context, task.id, { status: 'waiting_user', progress: 15, stage: '等待用户确认', plan: content })
  return json(202, { id: task.id, status: 'waiting_user', workspace, skill, plan: content, input: { assetCount: Array.isArray(input.assets) ? input.assets.length : 0 } })
}
function requirementsText(input) { return String(input.requirements || input.prompt || '请根据当前选中的素材提出推荐方案').slice(0, 10000) }
