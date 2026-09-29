export const ASSET_LIBRARIES = [
  { key: 'retouch', label: '精修图库', folders: [
    { key: 'source', label: '原图', uploadEnabled: true, generatedArchiveEnabled: false },
    { key: 'template', label: '模板', uploadEnabled: true, generatedArchiveEnabled: true },
    { key: 'effect', label: '效果图', uploadEnabled: false, generatedArchiveEnabled: true, saveAsTemplateEnabled: true },
  ] },
  { key: 'brand', label: '茶馆文创库', folders: [
    { key: 'illustration', label: '插画资产', uploadEnabled: true, generatedArchiveEnabled: false },
    { key: 'product-effect', label: '产品效果', uploadEnabled: false, generatedArchiveEnabled: true },
    { key: 'graphic-effect', label: '平面效果', uploadEnabled: false, generatedArchiveEnabled: true },
  ] },
  { key: 'script', label: '短剧库', folders: [
    { key: 'scene', label: '场景资产', uploadEnabled: true, generatedArchiveEnabled: true },
    { key: 'character', label: '人物资产', uploadEnabled: true, generatedArchiveEnabled: true },
    { key: 'prop', label: '道具资产', uploadEnabled: true, generatedArchiveEnabled: true },
  ] },
  { key: 'text', label: '文本库', folders: [
    { key: 'retouch-prompt', label: '精修提示词', textType: 'retouch_prompt' },
    { key: 'brand-prompt', label: '文创提示词', textType: 'brand_prompt' },
    { key: 'script', label: '短剧剧本', textType: 'script' },
    { key: 'storyboard-prompt', label: '分镜提示词', textType: 'storyboard_prompt' },
  ] },
]

export const libraryFor = key => ASSET_LIBRARIES.find(library => library.key === key) || null
export const folderFor = (libraryKey, folderKey) => libraryFor(libraryKey)?.folders.find(folder => folder.key === folderKey) || null
export const validAssetFolder = (libraryKey, folderKey) => Boolean(folderFor(libraryKey, folderKey))

export const defaultLocationForAsset = asset => {
  if (validAssetFolder(asset?.libraryKey, asset?.folderKey)) return { libraryKey: asset.libraryKey, folderKey: asset.folderKey }
  const space = asset?.assetSpace || asset?.workspace
  if (space === 'script') return { libraryKey: 'script', folderKey: ['scene', 'character', 'prop'].includes(asset?.videoAssetType) ? asset.videoAssetType : 'scene' }
  if (space === 'brand') return { libraryKey: 'brand', folderKey: asset?.metadata?.brandPhase === 'graphic-effect' || asset?.brandPhase === 'graphic-effect' ? 'graphic-effect' : asset?.category === 'uploaded' ? 'illustration' : 'product-effect' }
  return { libraryKey: 'retouch', folderKey: asset?.folderType === 'template' ? 'template' : asset?.folderType === 'ai-temp' || asset?.category === 'generated' ? 'effect' : 'source' }
}

export const locationsForAsset = asset => {
  const locations = Array.isArray(asset?.locations) ? asset.locations.filter(location => validAssetFolder(location.libraryKey, location.folderKey)) : []
  const defaultLocation = defaultLocationForAsset(asset)
  return locations.length ? locations : [defaultLocation]
}

export const hasLocation = (asset, libraryKey, folderKey) => locationsForAsset(asset).some(location => location.libraryKey === libraryKey && location.folderKey === folderKey)

export const defaultGeneratedLocation = (workspace, brandPhase = '') => workspace === 'brand'
  ? { libraryKey: 'brand', folderKey: brandPhase === 'graphic-effect' ? 'graphic-effect' : 'product-effect' }
  : { libraryKey: 'retouch', folderKey: 'effect' }
