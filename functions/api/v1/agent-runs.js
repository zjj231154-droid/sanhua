import { json, tokenSpaceRequest, DEFAULT_REASONING_MODEL } from '../../_lib/tokenspace.js'
import { registryFor } from '../../_lib/skills.js'
import { saveTask, updateTask } from '../../_lib/task-store.js'
import { createTextRecord } from '../../_lib/text-record-store.js'
import { requireIdentity, resolvedProviderConnection } from '../../_lib/collaboration.js'
const allowed = new Set(['retouch', 'brand', 'script'])
const brandTextFor = requirements => {
  const dielineMode = /流程阶段：产品刀版图/.test(requirements)
  const graphicMode = /创作模式：平面二创/.test(requirements)
  if (dielineMode) return `你是中式文创产品结构设计助手，严格遵循 chinese-cultural-merch-design v4.0.0 的盒型包装“结构确认优先”规则。用户已确认产品类型、材质、尺寸和参考图。不要直接生成产品效果图，不要重新提问。先简短说明结构、工艺和待厂家确认项；最后必须单独以“FINAL_DIELINE_PROMPT:”开头输出可直接发给图片模型的完整中文提示词。提示词应输出清晰的概念刀版示意/工艺结构图，标注真实尺寸、展开或结构关系、材质、工艺和“生产前由厂家/CAD 校核”；不得虚构未知的盒型内外尺寸、材料克重、开口方向或量产参数。参考图是唯一视觉基准，必须保留主体造型、关键色彩、品牌/IP/书法/图形特征和装饰元素，不能仅作风格参考。需求：${requirements}`
  if (graphicMode) return `你是中式插画、纹样与 IP 视觉延展顾问，严格遵循 chinese-cultural-merch-design v4.0.0 的“做平面”流程。用户已经提交原始素材、二创方向、输出形式、必须保留元素与画幅；不要重新提问，也不要直接生成图片。先简短说明素材类型判断、已锁定元素和延展策略；最后必须单独以“FINAL_IMAGE_PROMPT:”开头输出一段可直接发给图片模型的完整中文提示词。提示词必须明确这是基于原始参考图的二次创作与视觉延展，而不是相同主题的新图；参考图为唯一视觉基准，必须严格还原主体造型、主要构图、关键色彩、品牌/IP/书法/图形特征、装饰元素、氛围和材质观感。必须写入二创方向、输出形式、画幅和用户指定保留元素。若参考图含明确人物、动物、吉祥物或 IP，必须把原图作为唯一角色视觉基准，严格保持脸型、头部轮廓、头身比例、体型、五官关系、毛色、花纹、标志性色块、标志性配饰、核心气质及原画线条语言；只允许变化动作、姿态、场景、环境、道具、季节、构图、视角和氛围，并明确不得重新设计角色或生成相似角色。系列与四季图必须是同一个角色。整体维持新中式、东方雅致、合理留白，避免廉价国潮、无关元素、乱码和明显 AI 感。需求：${requirements}`
  return `你是中式文创周边设计助手，严格遵循 chinese-cultural-merch-design v4.0.0 的产品工作流。按需求中的产品路径推进：非盒型或明确“不生成新刀版”的盒型可在尺寸与素材确认后生成效果图；只有选择“需要新刀版图”的盒型才必须先完成概念/真实结构审核。不要重新提问，也不要跳过素材保护或已确认结构。先简短给出产品定义、工艺可行性、刀版一致性和素材转化方式；最后必须单独以“FINAL_IMAGE_PROMPT:”开头输出一段可直接发给图片模型的完整中文提示词。提示词必须包含以下五个原样英文段落标题：REFERENCE IMAGE RESTORATION、PRODUCT ADAPTATION、MUST KEEP、MUST AVOID、OUTPUT VIEW。REFERENCE IMAGE RESTORATION 必须写明参考图是唯一视觉基准，并严格还原引用素材的主体造型、主要构图、关键色彩、品牌/IP/书法或图形特征、装饰、氛围和材质观感；PRODUCT ADAPTATION 必须说明如何按已确认结构（如有）、产品材质、真实尺寸做裁切、留白、延展或排版；MUST KEEP 明确保留 Logo、文字相对位置和可识别核心，若素材有角色/IP，还必须锁定脸型、比例、五官、毛色、花纹与标志性色块；MUST AVOID 禁止只做风格参考、改变品牌主体、重新设计角色、在已确认刀版时偏离结构、廉价贴图感、乱码和多余文字；OUTPUT VIEW 要求同一可量产中式文创产品输出 2—3 个一致视图，并包含 REAL SIZE 与 DESIGN CONCEPT。整体为新中式、东方美学、年轻且有品牌感。需求：${requirements}`
}
const textFor = (workspace, input = {}) => {
  const requirements = String(input.requirements || input.prompt || '').slice(0, 10000)
  if (workspace === 'brand') return brandTextFor(requirements)
  if (workspace === 'script') return `你是短剧制作工作台的编导助手，Skill short-drama-production v1.0.0。按“选题立项→故事规划→角色→分集目录→分集剧本→合规审查→资产/场次/镜头→提示词→交付”的阶段推进；本次先输出可确认的选题方向和故事规划，包含题材、受众、基调、开场钩子、人物关系、冲突、分场位置、道具、预计时长和待确认项。全部剧情必须发生在客户真实茶馆，不得虚构房间、设备或大规模场面；不要复制对标台词，不要直接发布或生成视频。需求：${requirements}`
  return `你是产品精修助手，遵循 image-edit-agent 1.1.0：先确认尺寸/比例、场景、装饰和保留项，再形成图片编辑计划。默认保护杯瓶轮廓、标签、Logo、文字和饮品质感，默认不新增道具。不要直接执行图片编辑。需求：${requirements}`
}
export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit')
  if (identity.error) return identity.error
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = String(input.workspace || '')
  const skill = registryFor(workspace)
  if (!allowed.has(workspace) || !skill || skill.status !== 'enabled') return json(400, { error: 'SKILL_NOT_AVAILABLE', workspace })
  const providerConnection = await resolvedProviderConnection(context, identity.user.id)
  const model = input.model || providerConnection?.reasoningModel || context.env?.USEGOODAI_REASONING_MODEL || DEFAULT_REASONING_MODEL
  const task = await saveTask(context, { id: crypto.randomUUID(), workspace, workspaceId: identity.workspaceId, projectId: workspace, createdBy: identity.user.id, updatedBy: identity.user.id, version: 1, type: 'agent-plan', status: 'running', progress: 10, stage: 'Skill 解析与计划固化', heartbeatAt: new Date().toISOString(), requirements: requirementsText(input), assets: Array.isArray(input.assets) ? input.assets.slice(0, 50) : [], model, createdAt: new Date().toISOString() })
  const prompt = textFor(workspace, input)
  const result = await tokenSpaceRequest(context, 'chat/completions', { model, provider: 'usegoodai-reasoning', payload: { model, messages: [{ role: 'system', content: prompt }, { role: 'user', content: requirementsText(input) }], temperature: 0.35 } })
  if (result.response) { await updateTask(context, task.id, { status: 'failed', progress: 10, stage: '模型调用失败', error: 'UseGoodAI 请求失败' }); return result.response }
  const content = result.data?.choices?.[0]?.message?.content || ''
  const textRecord = await createTextRecord(context, {
    workspace, sourceModule: `${workspace}.prompts`, recordType: workspace === 'brand' ? 'brand_plan' : workspace === 'script' ? 'script_outline' : 'retouch_plan',
    title: workspace === 'brand' ? '品牌设计计划' : workspace === 'script' ? '待确认短剧脚本大纲' : '产品精修计划', content, contentFormat: 'prompt',
    workspaceId: identity.workspaceId, projectId: workspace, createdBy: identity.user.id, updatedBy: identity.user.id, model, provider: 'usegoodai-reasoning', sourceTaskId: task.id, sourceAssetIds: Array.isArray(input.assets) ? input.assets : [], referenceAssetIds: Array.isArray(input.reference_asset_ids) ? input.reference_asset_ids : [],
  })
  const updatedTask = await updateTask(context, task.id, { status: 'waiting_user', progress: 15, stage: '等待用户确认', plan: content, textRecordId: textRecord?.id || null })
  return json(202, { id: task.id, status: 'waiting_user', workspace, skill, plan: content, textRecordId: textRecord?.id || null, task: updatedTask, input: { assetCount: Array.isArray(input.assets) ? input.assets.length : 0 } })
}
function requirementsText(input) { return String(input.requirements || input.prompt || '请根据当前选中的素材提出推荐方案').slice(0, 10000) }
