import { seedancePromptSkill } from './seedance-prompt-zh.js'

const REGISTRY = {
  'image-edit-agent': {
    skillId: 'image-edit-agent', displayName: '精修', workspace: 'retouch', version: '1.1.0', status: 'enabled',
    allowedTools: ['image.edit', 'image.analyze'], contentHash: '3F279055A1C727954EC51C4E6C4EB26EC4384F05CD2DB5253A32F8CF76DF37E8'
  },
  'chinese-cultural-merch-design': {
    skillId: 'chinese-cultural-merch-design', displayName: '中式文创设计平台', workspace: 'brand', version: '4.0.0', status: 'enabled',
    allowedTools: ['text.generate', 'image.generate', 'image.edit'], contentHash: 'D81217E79D6DE2CF5819639B7BA40E1C6E9A688E984BDD1C1F577272DEC3BA1A'
  },
  'script-writer-demo': {
    skillId: 'short-drama-production', displayName: '短剧制作工作台', workspace: 'script', version: '1.0.0', status: 'enabled',
    allowedTools: ['text.generate', 'script.plan', 'script.write', 'script.review', 'shot.plan'], contentHash: 'F0ABE85D76C1CC927E28F7A320C9AE3B424E8B21ADF20B5DE56CBCE6FEBD83BD'
  },
  'seedance-prompt-zh': {
    ...seedancePromptSkill, contentHash: 'SEEDANCE_PROMPT_ZH_V1_0_0'
  },
}
export function skillFor(workspace) {
  return Object.values(REGISTRY).find(skill => skill.workspace === workspace) || null
}
export function publicSkill(skill) {
  if (!skill) return null
  const { skillId, displayName, workspace, version, status, allowedTools } = skill
  return { skillId, displayName, workspace, version, status, allowedTools }
}
export function registryFor(workspace, skillId = '') {
  const skill = skillId ? REGISTRY[skillId] : skillFor(workspace)
  if (skill && skill.workspace !== workspace) return null
  return skill ? publicSkill(skill) : null
}
