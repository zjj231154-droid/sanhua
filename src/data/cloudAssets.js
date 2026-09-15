export const CLOUD_ASSETS = [
  ...Array.from({ length: 7 }, (_, index) => ({ id: `coffee-${index + 1}`, name: `咖啡场景 ${index + 1}`, category: 'retouch', group: '咖啡店场景', url: `/cloud-assets/retouch/coffee-scene/coffee-${String(index + 1).padStart(2, '0')}.jpg` })),
  ...Array.from({ length: 12 }, (_, index) => ({ id: `teahouse-${index + 1}`, name: `茶馆场景 ${index + 1}`, category: 'retouch', group: '茶馆场景', url: `/cloud-assets/retouch/teahouse-scene/teahouse-${String(index + 1).padStart(2, '0')}.jpg` })),
  ...Array.from({ length: 12 }, (_, index) => ({ id: `script-teahouse-${index + 1}`, name: `茶馆场景 ${index + 1}`, category: 'script', group: '短剧场景', url: `/cloud-assets/retouch/teahouse-scene/teahouse-${String(index + 1).padStart(2, '0')}.jpg` })),
  { id: 'brand-1', name: '茉语轻岚', category: 'brand', group: '品牌文创', url: '/cloud-assets/brand/identity/brand-01.jpg' },
  { id: 'brand-2', name: '叁花茶馆贴纸', category: 'brand', group: '品牌文创', url: '/cloud-assets/brand/identity/brand-02.png' },
  { id: 'brand-3', name: '叁花热水袋图案', category: 'brand', group: '品牌文创', url: '/cloud-assets/brand/identity/brand-03.png' },
  { id: 'brand-4', name: '叁花 Logo', category: 'brand', group: '品牌文创', url: '/cloud-assets/brand/identity/brand-04.png' },
  { id: 'brand-5', name: '叁花原创物料', category: 'brand', group: '品牌文创', url: '/cloud-assets/brand/identity/brand-05.png' },
  { id: 'brand-6', name: '线上茶叶包装', category: 'brand', group: '品牌文创', url: '/cloud-assets/brand/identity/brand-06.png' },
]
