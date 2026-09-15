import { json, tokenSpaceRequest } from '../../_lib/tokenspace.js'
import { registryFor } from '../../_lib/skills.js'
const allowed = new Set(['retouch', 'brand', 'script'])
const textFor = (workspace, input = {}) => {
  const requirements = String(input.requirements || input.prompt || '').slice(0, 10000)
  if (workspace === 'brand') return `你是品牌创作设计助手，遵循 gpt-image-2-prompt-engine 的 Prompt as Code 方法。请把需求拆解为 Subject、Composition、Material、Typography、Lighting、Style、Constraints 七个维度，先给出 3 个可选创意方向，再给出一个可执行的 GPT-Image-2 图片提示词。必须保留用户指定的文字和 Logo，禁止乱码，不要声称已通过 VI 合规检查。需求：${requirements}`
  if (workspace === 'script') return `你是茶馆短剧编导助手。只使用客户真实茶馆场景约束，先输出可确认的大纲、人物、冲突、分场位置、道具和待确认项，不要直接发布或生成视频。需求：${requirements}`
  return `你是产品精修助手，遵循 image-edit-agent 1.1.0：先确认尺寸/比例、场景、装饰和保留项，再形成图片编辑计划。默认保护杯瓶轮廓、标签、Logo、文字和饮品质感，默认不新增道具。不要直接执行图片编辑。需求：${requirements}`
}
export async function onRequestPost(context) {
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = String(input.workspace || '')
  const skill = registryFor(workspace)
  if (!allowed.has(workspace) || !skill || skill.status !== 'enabled') return json(400, { error: 'SKILL_NOT_AVAILABLE', workspace })
  const prompt = textFor(workspace, input)
  const result = await tokenSpaceRequest(context, 'chat/completions', { model: input.model || 'gpt-5.6-luna', provider: 'tokenspace', payload: { model: input.model || 'gpt-5.6-luna', messages: [{ role: 'system', content: prompt }, { role: 'user', content: requirementsText(input) }], temperature: 0.35 } })
  if (result.response) return result.response
  const content = result.data?.choices?.[0]?.message?.content || ''
  return json(202, { id: crypto.randomUUID(), status: 'waiting_user', workspace, skill, plan: content, input: { assetCount: Array.isArray(input.assets) ? input.assets.length : 0 } })
}
function requirementsText(input) { return String(input.requirements || input.prompt || '请根据当前选中的素材提出推荐方案').slice(0, 10000) }
