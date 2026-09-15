import { useEffect, useMemo, useRef, useState } from 'react'
import ScriptEditor from './components/ScriptEditor'
import ApiSettings from './components/ApiSettings'
import {
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenText,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileImage,
  FolderOpen,
  Home,
  ImagePlus,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react'
import RippleDistortion from './components/RippleDistortion/RippleDistortion'
import LiveRetouch from './components/LiveRetouch'
import { CLOUD_ASSETS } from './data/cloudAssets'

const NAV_ITEMS = [
  { id: 'home', label: '工作台', icon: Home },
  { id: 'retouch', label: '产品精修', icon: WandSparkles },
  { id: 'brand', label: '品牌创作', icon: Palette },
  { id: 'script', label: '短剧脚本', icon: BookOpenText },
  { id: 'assets', label: '资产库', icon: FolderOpen },
]

const DEMO_PHOTOS = [
  { id: 'americano', name: '冰美式', meta: '3024 × 4032 · 18.2 MB', tone: 'amber', status: '待处理' },
  { id: 'cocktail', name: '暮色特调', meta: '3648 × 5472 · 22.6 MB', tone: 'rose', status: '待处理' },
  { id: 'latte', name: '桂花拿铁', meta: '3024 × 4032 · 16.8 MB', tone: 'cream', status: '待处理' },
  { id: 'bottle', name: '山茶气泡饮', meta: '4000 × 6000 · 25.4 MB', tone: 'green', status: '待处理' },
]


const CREATION_CARDS = [
  {
    id: 'retouch',
    eyebrow: '高频任务',
    title: '产品精修',
    copy: '从小样确认到批量处理，保护杯型、标签与饮品质感。',
    icon: WandSparkles,
    accent: 'forest',
    meta: '本周 36 张',
  },
  {
    id: 'brand',
    eyebrow: '视觉表达',
    title: '品牌创作',
    copy: '组合产品图、文案与参考素材，快速探索品牌物料方向。',
    icon: Palette,
    accent: 'clay',
    meta: '3 个草稿',
  },
  {
    id: 'script',
    eyebrow: '内容策划',
    title: '短剧脚本',
    copy: '从对标洞察到可拍脚本，让创意落在真实茶馆场景里。',
    icon: BookOpenText,
    accent: 'ink',
    meta: '2 个待确认',
  },
]

function Login({ onLogin }) {
  return (
    <main className="login-page">
      <div className="login-background" aria-hidden="true">
        <RippleDistortion
          src="/assets/login-cafe-bar.png"
          brushSize={100}
          strength={0.1}
          swirl={0.45}
          rings={2}
          spread={3.6}
          fade={2.8}
          spacing={24}
          dispersion={0.006}
          glint={0.18}
          tint="#d6a570"
          tintAmount={0.08}
          highlightColor="#f5dfbd"
          grayscale={false}
          quality="medium"
        />
      </div>
      <div className="login-shade" aria-hidden="true" />
      <header className="login-header">
        <div className="brand-lockup brand-lockup--light">
          <span className="brand-mark"><Sparkles size={19} /></span>
          <span>叁花工作室</span>
        </div>
        <span className="login-header-note">日咖夜酒 · 专属创作空间</span>
      </header>

      <section className="login-hero" aria-label="产品介绍">
        <span className="kicker kicker--light">AI CREATIVE STUDIO</span>
        <h1>昼夜流转，灵感不息。</h1>
        <p>从一杯咖啡的光影，到一杯特调的故事。</p>
      </section>

      <form className="login-card login-card--glass" onSubmit={(event) => { event.preventDefault(); onLogin() }}>
        <div className="login-card-heading">
          <div>
            <h2>欢迎回来</h2>
            <p>登录你的专属创作工作台</p>
          </div>
          <span className="demo-pill"><span /> 演示模式</span>
        </div>

        <div className="login-fields">
          <label>
            <div className="input-shell">
              <Mail size={17} />
              <span className="input-label">账号</span>
              <input type="email" defaultValue="designer@sanhua.demo" aria-label="账号" />
            </div>
          </label>
          <label>
            <div className="input-shell">
              <LockKeyhole size={17} />
              <span className="input-label">密码</span>
              <input type="password" defaultValue="creative-demo" aria-label="密码" />
            </div>
          </label>
        </div>

        <div className="login-options">
          <label><input type="checkbox" defaultChecked /> <span>保持登录</span></label>
          <button type="button">遇到问题？</button>
        </div>

        <button className="primary-button primary-button--wide login-submit" type="submit">
          进入演示工作台 <ArrowUpRight size={18} />
        </button>
        <p className="demo-disclaimer"><ShieldCheck size={15} /> 演示环境不会上传或保存真实客户素材</p>
      </form>

      <footer className="login-footer">
        <span>产品精修</span><i /> <span>品牌创作</span><i /> <span>短剧脚本</span>
      </footer>
    </main>
  )
}

function Sidebar({ page, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark"><Sparkles size={18} /></span>
        <span>叁花</span>
      </div>
      <nav className="main-nav" aria-label="主导航">
        <span className="nav-caption">创作空间</span>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? 'nav-item is-active' : 'nav-item'}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === 'script' && <i className="nav-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className={page === 'settings' ? 'nav-item is-active' : 'nav-item'} onClick={() => onNavigate('settings')}><Settings size={18} /><span>管理设置</span></button>
      </div>
    </aside>
  )
}

function Topbar({ timeMode, onToggleTimeMode, onLogout }) {
  const isNight = timeMode === 'night'
  return (
    <header className="topbar">
      <button className="scope-switcher" aria-label={isNight ? '切换为日咖模式' : '切换为夜酒模式'} onClick={onToggleTimeMode}>
        <span className="scope-icon">{isNight ? '夜' : '光'}</span>
        <span><small>当前模式</small><strong>{isNight ? '夜酒空间' : '日咖空间'}</strong></span>
        <ChevronDown size={16} />
      </button>
      <div className="top-actions">
        <span className="demo-tag">演示数据</span>
        <button className="icon-button" aria-label="帮助"><CircleHelp size={19} /></button>
        <button className="icon-button notification-button" aria-label="消息"><MessageSquareText size={19} /><i /></button>
        <div className="top-profile" aria-label="当前设计师">
          <span className="avatar">林</span>
          <span><strong>林设计</strong><small>设计师</small></span>
        </div>
        <button className="icon-button logout-button" aria-label="退出演示账号" onClick={onLogout} title="退出演示账号"><LogOut size={18} /></button>
      </div>
    </header>
  )
}

function HomePage({ onNavigate }) {
  return (
    <div className="page-content home-page">
      <nav className="capability-tabs glass-card" aria-label="创作入口">
        {CREATION_CARDS.map(({ id, eyebrow, title, copy, icon: Icon, accent, meta }) => (
          <button className={`capability-tab capability-tab--${accent}`} key={id} onClick={() => onNavigate(id)} aria-label={`打开${title}工具`}>
            <Icon size={16} />
            <span>{title}</span>
            <small>{eyebrow}</small>
          </button>
        ))}
      </nav>

      <aside className="dashboard-rail">
        <section className="glass-card weekly-card">
          <span className="kicker">WEEKLY FLOW</span>
          <div className="weekly-orbit"><strong>41</strong><small>件作品</small></div>
          <p>本周创作效率</p>
          <div className="weekly-progress"><div><i style={{ width: '72%' }} /></div><small>较上周多 8 件</small></div>
        </section>

        <section className="glass-card task-panel dashboard-tasks">
          <div className="section-heading"><div><span className="kicker">TASKS</span><h2>需要确认</h2></div><span className="task-count">3</span></div>
          <div className="task-item"><span className="task-symbol"><FileImage size={18} /></span><span><strong>5 张精修小样</strong><small>等待确认</small></span></div>
          <div className="task-item"><span className="task-symbol task-symbol--clay"><BookOpenText size={18} /></span><span><strong>脚本第一集</strong><small>等待审阅</small></span></div>
          <button className="task-item task-link" aria-label="查看每日爆款视频内容" onClick={() => onNavigate('script')}><span className="task-symbol"><Sparkles size={18} /></span><span><strong>每日爆款视频内容</strong><small>点击查看</small></span><ArrowUpRight size={15} /></button>
        </section>
      </aside>

      <section className="home-stage">
        <div className="stage-status glass-card"><Sparkles size={15} /><span>3 个助手已就绪</span></div>
        <div className="welcome-block">
          <span className="kicker">THURSDAY · SEPTEMBER 10</span>
          <h1>今天想创作什么？</h1>
          <p>从一张照片或一个想法开始，让叁花的故事继续生长。</p>
          <button className="stage-action" onClick={() => onNavigate('retouch')} aria-label="进入产品精修">
            <ArrowUpRight size={17} /> 开始产品精修
          </button>
        </div>
        <div className="stage-caption"><span>叁花工作室</span><small>日咖夜酒 · 创作现场</small></div>
      </section>

      <section className="glass-card recent-panel home-recent">
          <div className="section-heading">
            <div><span className="kicker">PICK UP WHERE YOU LEFT OFF</span><h2>继续创作</h2></div>
            <button className="text-button">查看全部 <ArrowUpRight size={15} /></button>
          </div>
          <div className="recent-list">
            <button className="recent-item" onClick={() => onNavigate('retouch')}>
              <span className="thumb thumb--coffee"><i>J&N</i></span>
              <span className="recent-copy"><strong>秋季新品饮品精修</strong><small>产品精修 · 12 张图片</small><em><Clock3 size={13} /> 18 分钟前自动保存</em></span>
              <span className="status status--waiting">待确认</span>
              <ArrowUpRight size={17} />
            </button>
            <button className="recent-item">
              <span className="thumb thumb--poster"><i>秋<br />日</i></span>
              <span className="recent-copy"><strong>秋日茶会系列海报</strong><small>品牌创作 · 社媒物料</small><em><Clock3 size={13} /> 昨天自动保存</em></span>
              <span className="status status--draft">草稿</span>
              <ArrowUpRight size={17} />
            </button>
          </div>
      </section>
    </div>
  )
}

function ProductPhoto({ photo, selected, onToggle, processed }) {
  return (
    <article className={selected ? 'photo-card is-selected' : 'photo-card'}>
      <div className={`photo-visual photo-visual--${photo.tone}`}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`选择 ${photo.name}`}
        />
        <span className="photo-badge">{processed ? '演示结果' : photo.status}</span>
        <div className="drink-scene" aria-hidden="true"><i /><b /></div>
      </div>
      <div className="photo-info">
        <span><strong>{photo.name}</strong><small>{photo.meta}</small></span>
        <button aria-label={`${photo.name}更多操作`}><MoreHorizontal size={17} /></button>
      </div>
    </article>
  )
}

function RetouchPage() {
  const [selected, setSelected] = useState(new Set())
  const [sampleGenerated, setSampleGenerated] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [compare, setCompare] = useState(58)
  const [assistantOpen, setAssistantOpen] = useState(true)
  const photoGridRef = useRef(null)
  const dragScroll = useRef(null)
  const selectedCount = selected.size

  const startCanvasDrag = event => {
    if (event.pointerType !== 'mouse' || event.target.closest('button, input, textarea, a')) return
    const grid = photoGridRef.current
    if (!grid) return
    dragScroll.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: grid.scrollLeft,
      top: grid.scrollTop,
    }
    grid.setPointerCapture(event.pointerId)
    grid.classList.add('is-dragging')
  }

  const moveCanvasDrag = event => {
    const drag = dragScroll.current
    const grid = photoGridRef.current
    if (!drag || !grid || drag.pointerId !== event.pointerId) return
    grid.scrollLeft = drag.left - (event.clientX - drag.x)
    grid.scrollTop = drag.top - (event.clientY - drag.y)
  }

  const stopCanvasDrag = event => {
    const grid = photoGridRef.current
    if (!grid || !dragScroll.current) return
    if (grid.hasPointerCapture?.(event.pointerId)) grid.releasePointerCapture(event.pointerId)
    dragScroll.current = null
    grid.classList.remove('is-dragging')
  }

  const togglePhoto = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
    setSampleGenerated(false)
  }

  const generateSample = () => {
    if (!selectedCount || processing) return
    setProcessing(true)
    window.setTimeout(() => {
      setProcessing(false)
      setSampleGenerated(true)
    }, 760)
  }

  return (
    <div className="retouch-page">
      <div className="workspace-header">
        <div>
          <span className="breadcrumb">产品精修 <i>/</i> 新建任务</span>
          <h1>产品精修</h1>
          <p>先确认小样，再放心批量</p>
        </div>
        <div className="header-actions">
          <button className="quiet-button"><Clock3 size={16} /> 历史版本</button>
          <button className="icon-button"><MoreHorizontal size={18} /></button>
        </div>
      </div>

      <div className={assistantOpen ? 'retouch-layout' : 'retouch-layout is-assistant-closed'}>
        <main className="canvas-area">
          <div className="canvas-toolbar">
            <div>
              <button className="secondary-button"><Upload size={16} /> 添加图片</button>
              <span>{selectedCount ? `已选择 ${selectedCount} 张` : '选择图片开始处理'}</span>
            </div>
            <div className="toolbar-icons"><button><Layers3 size={17} /></button><button><ArrowLeftRight size={17} /></button></div>
          </div>

          {sampleGenerated ? (
            <section className="comparison-stage" aria-label="小样比较">
              <div className="comparison-heading"><span><BadgeCheck size={17} /> 小样已生成</span><small>演示结果</small></div>
              <div className="before-after">
                <div className="comparison-image comparison-image--before"><span>原图</span><div className="hero-drink" /></div>
                <div className="comparison-image comparison-image--after" style={{ clipPath: `inset(0 0 0 ${compare}%)` }}><span>精修后</span><div className="hero-drink" /></div>
                <i className="compare-line" style={{ left: `${compare}%` }}><b><ArrowLeftRight size={16} /></b></i>
                <input aria-label="前后对比" type="range" min="12" max="88" value={compare} onChange={(event) => setCompare(event.target.value)} />
              </div>
              <div className="result-actions">
                <button className="secondary-button" onClick={() => setSampleGenerated(false)}><RefreshCw size={16} /> 调整方案</button>
                <button className="primary-button">确认并处理剩余图片 <ArrowUpRight size={17} /></button>
              </div>
            </section>
          ) : (
            <section
              ref={photoGridRef}
              className={processing ? 'photo-grid is-processing' : 'photo-grid'}
              aria-label="待处理图片，可上下左右滑动"
              tabIndex="0"
              onPointerDown={startCanvasDrag}
              onPointerMove={moveCanvasDrag}
              onPointerUp={stopCanvasDrag}
              onPointerCancel={stopCanvasDrag}
            >
              <button className="upload-card"><span><ImagePlus size={24} /></span><strong>添加产品照片</strong><small>支持 JPG、PNG，演示不实际上传</small></button>
              {DEMO_PHOTOS.map((photo) => (
                <ProductPhoto key={photo.id} photo={photo} selected={selected.has(photo.id)} onToggle={() => togglePhoto(photo.id)} />
              ))}
            </section>
          )}
        </main>

        <aside className={assistantOpen ? 'assistant-panel' : 'assistant-panel is-collapsed'}>
          <div className="assistant-title">
            <span className="assistant-avatar"><Sparkles size={18} /></span>
            <span><strong>精修助手</strong><small><i /> 已就绪</small></span>
            <button
              className="assistant-toggle"
              type="button"
              aria-label={assistantOpen ? '收起精修助手' : '展开精修助手'}
              aria-expanded={assistantOpen}
              onClick={() => setAssistantOpen(open => !open)}
            >
              {assistantOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
          </div>
          <div className="assistant-body" aria-hidden={!assistantOpen} inert={assistantOpen ? undefined : ''}>
            <div className="assistant-message">
              <p>{sampleGenerated ? '小样已经完成。我保留了杯型、标签与液体边缘，并提升了主体亮度。拖动中央滑杆查看变化。' : '选择几张代表性照片，我会先分析光线、构图和需要保护的商品细节。'}</p>
            </div>
            <div className="context-card">
              <span className="context-label">当前任务上下文</span>
              <div><FileImage size={17} /><span><strong>{selectedCount || 0} 张图片</strong><small>{selectedCount ? '已进入本次处理范围' : '尚未选择'}</small></span></div>
              <div><ShieldCheck size={17} /><span><strong>商品保护</strong><small>杯型 · 标签 · 饮品边缘</small></span></div>
            </div>
            <div className="recipe-block">
              <div className="recipe-heading"><strong>精修要求</strong><span>演示配方</span></div>
              <textarea defaultValue="提亮主体，校正暖色偏色；清理桌面细小污点，保留自然反光与饮品质感。" aria-label="精修要求" />
              <div className="protection-chips"><span>保护标签</span><span>保持杯型</span><span>自然质感</span></div>
            </div>
          </div>
          <div className="assistant-footer" aria-hidden={!assistantOpen} inert={assistantOpen ? undefined : ''}>
            <div><span>预计消耗</span><strong>{selectedCount ? `${selectedCount} 次演示处理` : '选择图片后显示'}</strong></div>
            <button className="primary-button primary-button--wide" disabled={!selectedCount || sampleGenerated || processing} onClick={generateSample}>
              {processing ? <LoaderCircle className="spin-icon" size={17} /> : <Sparkles size={17} />}
              {processing ? '正在生成小样…' : sampleGenerated ? '小样已生成' : '生成小样'}
            </button>
            <small>当前为演示流程，不会调用真实模型或产生费用</small>
          </div>
        </aside>
      </div>
    </div>
  )
}

const CREATIVE_CASES = {
  brand: {
    title: '品牌创作',
    subtitle: '从品牌气质出发，组合产品图、文案与社媒视觉。',
    action: '新建品牌项目',
    icon: Palette,
    cases: [
      { id: 'autumn-menu', title: '茶山云雾香器', kind: '茶文化香器', status: '待确认', tone: 'menu', summary: '以云雾茶山为灵感的陶瓷香器与空间陈列', progress: '8 个版式' },
      { id: 'coffee-launch', title: '茶纹手账礼盒', kind: '茶文化文具', status: '已完成', tone: 'coffee', summary: '手账、茶叶书签与印章组成的品牌文具系列', progress: '12 张物料' },
      { id: 'night-cocktail', title: '山行便携茶具', kind: '旅行茶具', status: '草稿', tone: 'cocktail', summary: '适合城市漫游与山野出行的便携茶具视觉', progress: '6 张提案' },
      { id: 'gift-set', title: '叁花茶文化礼赠', kind: '文化礼赠', status: '进行中', tone: 'gift', summary: '茶罐、香囊、手作杯与插画卡组成的文化礼盒', progress: '3 套方向' },
    ],
  },
  script: {
    title: '短剧脚本',
    subtitle: '把茶馆里的人与事，整理成可拍摄的分集故事。',
    action: '新建短剧项目',
    icon: BookOpenText,
    cases: [
      { id: 'letters', title: '《00后掌柜整顿老茶馆》', kind: '逆袭轻喜剧', status: '第 1 集', tone: 'letters', summary: '00 后女孩接手亏损茶馆，用直播把老手艺做成全城爆款。', progress: '8 / 12 场' },
      { id: 'closing-time', title: '《穿成茶馆老板后我爆单了》', kind: '穿越爽剧', status: '人物小传', tone: 'closing', summary: '现代运营人意外穿进旧茶馆，靠新品和奇招一路翻盘。', progress: '4 位角色' },
      { id: 'first-cup', title: '《前任在我茶馆办婚礼》', kind: '情感反转', status: '已定稿', tone: 'firstcup', summary: '一场包场婚宴，让茶馆老板与失联多年的旧人再次相遇。', progress: '3 分钟' },
    ],
  },
}

function CreativeCasesPage({ type }) {
  const [editor, setEditor] = useState(null)
  const [toolbarTab, setToolbarTab] = useState(0)
  const [brandPrompt, setBrandPrompt] = useState('为叁花茶馆设计一张日光茶饮品牌海报，保留叁花 Logo，突出茶汤与留白。')
  const [brandPlan, setBrandPlan] = useState('')
  const [brandImage, setBrandImage] = useState('')
  const [brandBusy, setBrandBusy] = useState(false)
  const [brandError, setBrandError] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [scriptPrompt, setScriptPrompt] = useState('围绕茶馆真实空间写一个 3 分钟短剧开场：一位年轻掌柜用一杯新茶解决老顾客之间的误会。')
  const [scriptPlan, setScriptPlan] = useState('')
  const [drafts, setDrafts] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('script-drafts') || '[]'); return Array.isArray(saved) ? saved : [] } catch { return [] } })
  const config = CREATIVE_CASES[type]
  const [activeId, setActiveId] = useState(config.cases[0].id)
  const activeCase = config.cases.find(item => item.id === activeId)
  const Icon = config.icon
  async function assetDataUrl(url) {
    const response = await fetch(url)
    const blob = await response.blob()
    return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob) })
  }
  async function createBrandPlan() {
    setBrandBusy(true); setBrandError('')
    try {
      const response = await fetch('/api/v1/agent-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: 'brand', requirements: `${brandPrompt}\n引用素材：${selectedAsset?.name || '未选择'}`, assets: selectedAsset ? [selectedAsset.id] : [] }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '设计助手暂不可用')
      setBrandPlan(value.plan || '')
    } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) }
  }
  async function generateBrandImage() {
    setBrandBusy(true); setBrandError('')
    try {
      const source = selectedAsset ? await assetDataUrl(selectedAsset.url) : ''
      const body = source ? { type: 'edit', model: 'gpt-image-2', prompt: brandPlan || brandPrompt, images: [source] } : { type: 'image', model: 'gpt-image-2', prompt: brandPlan || brandPrompt, size: '1024x1024' }
      const response = await fetch('/api/tokenspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '品牌图片生成失败')
      const output = value.data?.data?.[0]
      setBrandImage(output?.b64_json ? `data:image/png;base64,${output.b64_json}` : output?.url || '')
      if (!output?.b64_json && !output?.url) throw new Error('模型未返回图片')
    } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) }
  }

  return (
    <div className="showcase-page">
      <header className="workspace-header">
        <div><span className="breadcrumb">创作工作台 <i>/</i> 案例库</span><h1>{config.title}</h1><p>{config.subtitle}</p></div>
        <button className="primary-button" onClick={() => type === 'script' && setEditor({})}><Sparkles size={16} /> {config.action}</button>
      </header>
      <div className="showcase-layout">
        <main className="showcase-main">
          <div className="showcase-toolbar glass-card"><div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>{(type === 'script' ? ['资产库', '剧本库', '视频生成'] : ['素材创作', '产品库']).map((label, index) => <button key={label} type="button" className={toolbarTab === index ? 'primary-button' : 'secondary-button'} style={{ whiteSpace: 'nowrap', flexShrink: 0, minHeight: 36, padding: '8px 12px' }} aria-pressed={toolbarTab === index} onClick={() => setToolbarTab(index)}>{index === 0 && <Icon size={17} />}{label}</button>)}</div><small>{config.cases.length} 个项目 · 点击查看详情</small></div>
          {type === 'brand' && toolbarTab === 0 && <div className="brand-agent-card glass-card"><div><span className="kicker">DESIGN ASSISTANT · gpt-image-2-prompt-engine</span><p>输入物料用途、尺寸和必须出现的文字，先生成 3 个方向和结构化图片提示词，再确认执行。VI 约束未配置。</p></div><div className="asset-picker"><strong>仅引用品牌资产</strong><div>{CLOUD_ASSETS.filter(asset => asset.category === 'brand').map(asset => <button key={asset.id} className={selectedAsset?.id === asset.id ? 'asset-thumb is-selected' : 'asset-thumb'} onClick={() => setSelectedAsset(asset)}><img src={asset.url} alt={asset.name} /><small>{asset.name}</small></button>)}</div></div><textarea value={brandPrompt} onChange={event => setBrandPrompt(event.target.value)} aria-label="品牌创作需求" /><div className="brand-agent-actions"><button className="secondary-button" disabled={brandBusy || !brandPrompt.trim()} onClick={createBrandPlan}>{brandBusy ? '正在规划…' : '生成创意方向'}</button>{brandPlan && <button className="primary-button" disabled={brandBusy} onClick={generateBrandImage}>{brandBusy ? '正在生成…' : '确认并生成小样'}</button>}</div>{brandPlan && <div className="brand-plan"><strong>设计助手计划</strong><p>{brandPlan}</p></div>}{brandImage && <img className="brand-generated-image" src={brandImage} alt="品牌创作生成结果" />}{brandError && <p className="retouch-error" role="alert">{brandError}</p>}</div>}
          {type === 'script' && toolbarTab === 0 && <div className="brand-agent-card glass-card"><div><span className="kicker">编导助手 · 茶馆场景 Skill</span><p>从短剧专属场景资产发起创作，脚本计划会绑定真实场景，不虚构不存在的区域和道具。</p></div><div className="asset-picker"><strong>仅引用短剧资产</strong><div>{CLOUD_ASSETS.filter(asset => asset.category === 'script').slice(0, 6).map(asset => <button key={asset.id} className={selectedAsset?.id === asset.id ? 'asset-thumb is-selected' : 'asset-thumb'} onClick={() => setSelectedAsset(asset)}><img src={asset.url} alt={asset.name} /><small>{asset.name}</small></button>)}</div></div><textarea value={scriptPrompt} onChange={event => setScriptPrompt(event.target.value)} aria-label="短剧脚本需求" /><button className="primary-button" disabled={brandBusy || !scriptPrompt.trim()} onClick={async () => { setBrandBusy(true); setBrandError(''); try { const response = await fetch('/api/v1/agent-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: 'script', requirements: `${scriptPrompt}\n场景素材：${selectedAsset?.name || '茶馆场景待选择'}`, assets: selectedAsset ? [selectedAsset.id] : [] }) }); const value = await response.json(); if (!response.ok) throw new Error(value.error || '编导助手暂不可用'); setScriptPlan(value.plan || '') } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) } }}>{brandBusy ? '正在分析并写作…' : '生成脚本大纲'}</button>{scriptPlan && <div className="brand-plan"><strong>可拍摄脚本计划</strong><p>{scriptPlan}</p></div>}{brandError && <p className="retouch-error" role="alert">{brandError}</p>}</div>}
          {toolbarTab === 0 && <div className="legacy-case-cache" aria-hidden="true">{config.cases.map((item, index) => <span key={item.id}>{item.title}{index === 0 && <span>{item.title}</span>}</span>)}</div>}
          {toolbarTab === 2 && <p role="status">{type === 'script' ? '视频生成入口已预留，生成服务尚未接入。' : '效果渲染入口已预留，生成服务尚未接入。'}</p>}
          {type === 'brand' && toolbarTab === 1 ? <section className="product-library-panel glass-card" aria-label="品牌产品库"><h2>品牌成品与设计方案</h2>{brandImage && <article><img src={brandImage} alt="已自动保存的品牌成品" /><div><strong>已自动保存到品牌创作 / 产品库</strong><small>可继续调整、生成变体或下载</small></div></article>}<div className="library-case-list">{config.cases.map(item => <article key={item.id}><span className={`case-visual case-visual--${item.tone}`} /><div><strong>{item.title}</strong><small>{item.kind} · {item.status}</small></div></article>)}</div></section> : ((type === 'script' && toolbarTab === 1) ? <section className={`case-grid case-grid--${type}`} aria-label={`${config.title}剧本库`}>
            {type === 'script' && drafts.map(draft => <button className="case-card" key={draft.id} onClick={() => setEditor(draft)}><span className="case-copy"><small>本机草稿 · 点击编辑</small><strong>{draft.title}</strong><em>{draft.summary}</em><span>{draft.kind}</span></span></button>)}
            {config.cases.map(item => (
              <button key={item.id} className={activeId === item.id ? 'case-card is-active' : 'case-card'} onClick={() => setActiveId(item.id)}>
                <span className={`case-visual case-visual--${item.tone}`}><i>{item.kind}</i></span>
                <span className="case-copy"><small>{item.status}</small><strong>{item.title}</strong><em>{item.summary}</em><span>{item.progress}<ArrowUpRight size={15} /></span></span>
              </button>
            ))}
          </section> : null)}
        </main>
        {((type === 'brand' && toolbarTab === 1) || (type === 'script' && toolbarTab === 1)) && <aside className="case-inspector glass-card">
          <span className="case-inspector-icon"><Icon size={20} /></span>
          <span className="kicker">SELECTED CASE</span>
          <h2>{activeCase.title}</h2>
          <p>{activeCase.summary}</p>
          <div className="case-facts"><span><small>类型</small><strong>{activeCase.kind}</strong></span><span><small>当前进度</small><strong>{activeCase.progress}</strong></span><span><small>状态</small><strong>{activeCase.status}</strong></span></div>
          <button className="primary-button primary-button--wide" onClick={() => type === 'script' && setEditor({ title: activeCase.title, kind: activeCase.kind, summary: activeCase.summary })}>以此案例开始 <ArrowUpRight size={16} /></button>
        </aside>}
      </div>
      {editor && <ScriptEditor initial={editor} onClose={() => setEditor(null)} onSave={values => { const item = { ...values, id: editor.id || crypto.randomUUID() }; const next = [item, ...drafts.filter(draft => draft.id !== item.id)]; localStorage.setItem('script-drafts', JSON.stringify(next)); setDrafts(next) }} />}
    </div>
  )
}

function AssetLibraryPage({ onNavigate }) {
  const [category, setCategory] = useState('coffee')
  const matches = asset => category === 'coffee' ? asset.id.startsWith('coffee-') : category === 'brand' ? asset.category === 'brand' : asset.category === 'script'
  const visible = CLOUD_ASSETS.filter(matches)
  return <div className="page-content asset-library-page">
    <header className="workspace-header"><div><span className="breadcrumb">创作工作台 / 云端资产</span><h1>资产库</h1><p>按业务归属管理咖啡场景、茶馆文创和短剧场景素材。</p></div><span className="connection-note">云端资产 · {CLOUD_ASSETS.length} 项</span></header>
    <div className="showcase-toolbar glass-card asset-toolbar"><div>{[['coffee', '咖啡店'], ['brand', '茶馆文创'], ['script', '短剧']].map(([id, label]) => <button key={id} className={category === id ? 'primary-button' : 'secondary-button'} onClick={() => setCategory(id)}>{label}</button>)}</div><small>{visible.length} 项素材</small></div>
    <section className="asset-grid" aria-label="云端资产列表">
      {visible.map(asset => <article className="asset-card glass-card" key={asset.id}><img src={asset.url} alt={asset.name} loading="lazy" /><div><span><strong>{asset.name}</strong><small>{asset.group}</small></span><button className="secondary-button" onClick={() => onNavigate(asset.category === 'script' ? 'script' : asset.category === 'brand' ? 'brand' : 'retouch')}>{asset.category === 'script' ? '用于写剧本' : asset.category === 'brand' ? '用于创作' : '用于精修'}</button></div></article>)}
    </section>
  </div>
}

function PlaceholderPage({ type }) {
  const item = useMemo(() => CREATION_CARDS.find((entry) => entry.id === type), [type])
  const Icon = item?.icon || FolderOpen
  return (
    <div className="page-content placeholder-page">
      <span className={`large-symbol creation-card--${item?.accent || 'forest'}`}><Icon size={30} /></span>
      <span className="kicker">A 层流程占位</span>
      <h1>{item?.title || '素材库'}</h1>
      <p>{item?.copy || '统一管理产品照片、品牌素材和茶馆场景资料。'}</p>
      <div className="placeholder-note"><Sparkles size={18} /> 首个开发切片聚焦产品精修，这个板块将在下一切片接入交互流程。</div>
    </div>
  )
}

export default function App({ initialAuthenticated = false, initialPage = 'home', demoRetouch = false }) {
  useEffect(() => {
    const wheel = event => {
      if (!event.shiftKey || event.ctrlKey || event.defaultPrevented) return
      let el = event.target instanceof Element ? event.target : null
      while (el && el !== document.body) {
        if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX)) {
          event.preventDefault()
          el.scrollLeft += (event.deltaX || event.deltaY) * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? el.clientWidth : 1)
          return
        }
        el = el.parentElement
      }
    }
    document.addEventListener('wheel', wheel, { passive: false })
    return () => document.removeEventListener('wheel', wheel)
  }, [])
  const previewParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const previewPage = previewParams.get('preview')
  const validPreviewPage = ['home', 'retouch', 'brand', 'script', 'assets', 'settings'].includes(previewPage) ? previewPage : null
  const [authenticated, setAuthenticated] = useState(initialAuthenticated || Boolean(validPreviewPage))
  const [page, setPage] = useState(validPreviewPage || initialPage)
  const [timeMode, setTimeMode] = useState(previewParams.get('theme') === 'night' ? 'night' : 'day')

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />

  return (
    <div className={`app-shell time-${timeMode}`}>
      <Sidebar page={page} onNavigate={setPage} />
      <div className="app-main">
        <Topbar timeMode={timeMode} onToggleTimeMode={() => setTimeMode(mode => mode === 'day' ? 'night' : 'day')} onLogout={() => { setAuthenticated(false); setPage('home') }} />
        <div className="page-transition" key={page}>
          {page === 'home' && <HomePage onNavigate={setPage} />}
          {page === 'retouch' && (demoRetouch ? <RetouchPage /> : <LiveRetouch />)}
          {page === 'brand' && <CreativeCasesPage type="brand" />}
          {page === 'script' && <CreativeCasesPage type="script" />}
          {page === 'assets' && <AssetLibraryPage onNavigate={setPage} />}
          {page === 'settings' && <ApiSettings />}
        </div>
      </div>
    </div>
  )
}
