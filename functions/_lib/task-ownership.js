// Task ownership is independent of workspace membership and administrator roles.
export const ownsTask = (item, identity) => Boolean(item && (identity.compatibilityMode || (
  item.workspaceId === identity.workspaceId && (item.ownerUserId || item.createdBy) === identity.user.id
)))
export const taskScope = identity => identity.compatibilityMode ? {} : { workspaceId: identity.workspaceId, ownerUserId: identity.user.id }
export const mayReadTaskResult = (asset, identity) => Boolean(asset && (identity.compatibilityMode ||
  (!(asset.sourceTaskId || asset.videoTaskId || asset.category === 'generated') || asset.visibility === 'workspace' ||
    (asset.ownerUserId || asset.createdBy) === identity.user.id)))
