import { json } from '../../../../_lib/tokenspace.js'
import { registryFor } from '../../../../_lib/skills.js'
export function onRequestGet(context) {
  const workspace = String(context.params.id || '')
  const skill = registryFor(workspace)
  if (!skill) return json(404, { error: 'WORKSPACE_NOT_FOUND' })
  return json(200, { workspace, agent: { id: `${workspace}-assistant`, name: workspace === 'retouch' ? '精修助手' : workspace === 'brand' ? '设计助手' : '编导助手' }, skill })
}
