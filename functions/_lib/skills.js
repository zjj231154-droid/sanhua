const REGISTRY = {
  'image-edit-agent': {
    skillId: 'image-edit-agent', displayName: '精修', workspace: 'retouch', version: '1.1.0', status: 'enabled',
    allowedTools: ['image.edit', 'image.analyze'], contentHash: '3F279055A1C727954EC51C4E6C4EB26EC4384F05CD2DB5253A32F8CF76DF37E8'
  },
  'chinese-cultural-merch-design': {
    skillId: 'chinese-cultural-merch-design', displayName: '中式文创周边设计', workspace: 'brand', version: '1.0.0', status: 'enabled',
    allowedTools: ['text.generate', 'image.generate', 'image.edit'], contentHash: 'F73A3E806954DCE454477F4E62DA7EDA2D212CCE97B23E3CDE95955835A7E328'
  },
  'script-writer-demo': {
    skillId: 'short-drama-production', displayName: '短剧制作工作台', workspace: 'script', version: '1.0.0', status: 'enabled',
    allowedTools: ['text.generate', 'script.plan', 'script.write', 'script.review', 'shot.plan'], contentHash: 'F0ABE85D76C1CC927E28F7A320C9AE3B424E8B21ADF20B5DE56CBCE6FEBD83BD'
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
export function registryFor(workspace) {
  const skill = skillFor(workspace)
  return skill ? publicSkill(skill) : null
}
