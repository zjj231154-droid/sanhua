import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ScriptEditor from './components/ScriptEditor'
import ApiSettings from './components/ApiSettings'
import {
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  BookOpenText,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileImage,
  FolderOpen,
  Home,
  ImagePlus,
  Layers3,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Palette,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import RippleDistortion from './components/RippleDistortion/RippleDistortion'
import LiveRetouch from './components/LiveRetouch'
import ImageViewer from './components/ImageViewer'
import CachedImage from './components/CachedImage'
import { CLOUD_ASSETS } from './data/cloudAssets'

const NAV_ITEMS = [
  { id: 'home', label: '工作台', icon: Home },
  { id: 'retouch', label: '产品精修', icon: WandSparkles, children: [['one-click', '一键修图'], ['gallery', '图库'], ['assistant', '精修助手'], ['tasks', '任务记录']] },
  { id: 'brand', label: '品牌创作', icon: Palette, children: [['create', '素材创作'], ['library', '产品库'], ['prompts', '提示词记录']] },
  { id: 'script', label: '短剧脚本', icon: BookOpenText, children: [['create', '脚本创作'], ['library', '剧本库'], ['video', '视频生成'], ['versions', '版本记录']] },
  { id: 'assets', label: '资产库', icon: FolderOpen, children: [['images', '图片'], ['video', '视频'], ['audio', '音频'], ['text', '文本'], ['generated', 'AI 成果'], ['trash', '回收站']] },
]

const DEFAULT_SUB_ROUTE = { home: '', retouch: 'one-click', brand: 'create', script: 'create', assets: 'images', settings: '' }

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

function Sidebar({ page, subRoute, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark"><img src="/logo.svg" alt="" onError={event => { event.currentTarget.style.display = 'none' }} /></span>
        <span>叁花</span>
      </div>
      <nav className="main-nav" aria-label="主导航">
        <span className="nav-caption">创作空间</span>
        {NAV_ITEMS.map(({ id, label, icon: Icon, children }) => <div className="nav-group" key={id}>
          <button className={page === id ? 'nav-item is-active' : 'nav-item'} onClick={() => onNavigate(id)} aria-expanded={page === id && Boolean(children)}>
            <span className="nav-icon"><Icon size={18} strokeWidth={2} /></span><span>{label}</span>{id === 'script' && <i className="nav-dot" />}{children && <ChevronDown className="nav-chevron" size={15} />}
          </button>
          {page === id && children && <div className="nav-submenu" aria-label={`${label}子菜单`}>
            {children.map(([route, childLabel]) => <button key={route} className={subRoute === route ? 'nav-subitem is-active' : 'nav-subitem'} onClick={() => onNavigate(id, route)}>{childLabel}</button>)}
          </div>}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <button className={page === 'settings' ? 'nav-item is-active' : 'nav-item'} onClick={() => onNavigate('settings')}><Settings size={18} /><span>管理设置</span></button>
      </div>
    </aside>
  )
}

export function TaskProgress() {
  const [open, setOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({})
  const [widgetPosition, setWidgetPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sanhua-task-progress-position') || '{}')
      return Number.isFinite(saved.right) && Number.isFinite(saved.bottom) ? { right: saved.right, bottom: saved.bottom } : {}
    } catch { return {} }
  })
  const [dragging, setDragging] = useState(false)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [error, setError] = useState('')
  const [completedToast, setCompletedToast] = useState(null)
  const previousStatuses = useRef(new Map())
  const hasLoadedStatuses = useRef(false)
  const triggerRef = useRef(null)
  const dragStart = useRef(null)
  const suppressClick = useRef(false)
  const load = async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const response = await fetch('/api/v1/tasks')
      const value = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : '任务状态暂不可用，请稍后重试')
      const nextTasks = Array.isArray(value.tasks) ? value.tasks.slice(0, 12) : []
      if (hasLoadedStatuses.current) {
        const completed = nextTasks.find(task => previousStatuses.current.get(task.id) !== 'completed' && task.status === 'completed')
        if (completed) setCompletedToast(completed)
      }
      previousStatuses.current = new Map(nextTasks.map(task => [task.id, task.status]))
      hasLoadedStatuses.current = true
      setTasks(nextTasks)
      setError('')
    } catch (err) { setError(err.message) }
    finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => {
    load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!completedToast) return undefined
    const timer = setTimeout(() => setCompletedToast(null), 3000)
    return () => clearTimeout(timer)
  }, [completedToast])
  const active = tasks.filter(task => ['queued', 'running', 'waiting_user'].includes(task.status))
  const status = task => task.status === 'completed' ? '已完成' : task.status === 'failed' ? '失败' : task.status === 'cancelled' ? '已取消' : task.status === 'waiting_user' ? '等待确认' : task.status === 'queued' ? '排队中' : '运行中'
  const togglePopover = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (open) { setOpen(false); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const right = `${Math.max(12, window.innerWidth - rect.right)}px`
      setPopoverPosition(rect.top > 32 && rect.top < window.innerHeight / 2
        ? { top: `${Math.max(12, rect.bottom + 10)}px`, right }
        : { bottom: `${Math.max(12, window.innerHeight - rect.top + 10)}px`, right })
    }
    setOpen(true)
  }
  const startDragging = event => {
    if (event.button !== 0) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.bottom,
      width: rect.width,
      height: rect.height,
      moved: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const dragWidget = event => {
    const start = dragStart.current
    if (!start) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) start.moved = true
    if (!start.moved) return
    setDragging(true)
    setWidgetPosition({
      right: Math.max(12, Math.min(window.innerWidth - start.width - 12, start.right - deltaX)),
      bottom: Math.max(12, Math.min(window.innerHeight - start.height - 12, start.bottom - deltaY)),
    })
  }
  const stopDragging = event => {
    const start = dragStart.current
    if (!start) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (start.moved) {
      suppressClick.current = true
      setWidgetPosition(current => {
        localStorage.setItem('sanhua-task-progress-position', JSON.stringify(current))
        return current
      })
    }
    dragStart.current = null
    setDragging(false)
  }
  const dismissTask = async task => {
    const previous = tasks
    setRemovingId(task.id)
    setTasks(current => current.filter(item => item.id !== task.id))
    try {
      const response = await fetch(`/api/v1/tasks?id=${encodeURIComponent(task.id)}`, { method: 'DELETE' })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '删除任务失败')
    } catch (err) {
      setTasks(previous)
      setError(err.message)
    } finally { setRemovingId('') }
  }
  const progressPopover = <section className="task-progress-popover task-progress-popover--portal" style={popoverPosition} aria-label="后台任务进度"><header><div><strong>后台任务</strong><small>{active.length ? `${active.length} 个任务正在运行` : '当前没有运行中的任务'}</small></div><div><button className="icon-button" disabled={refreshing} onClick={() => load(true)} aria-label="刷新任务进度"><RefreshCw className={refreshing ? 'spin-icon' : ''} size={16} /></button><button className="icon-button" onClick={() => setOpen(false)} aria-label="关闭任务进度"><X size={17} /></button></div></header>{loading && <p className="task-progress-empty">正在读取任务…</p>}{error && <p className="task-progress-error">{error}</p>}{!loading && !error && !tasks.length && <p className="task-progress-empty">暂无后台任务。提交图片或脚本计划后，进度会在这里持续更新。</p>}<div className="task-progress-list">{tasks.map(task => { const finished = ['completed', 'failed', 'cancelled'].includes(task.status); return <article key={task.id} className={`task-progress-item task-status--${task.status}`}><div><strong>{task.workspace === 'retouch' ? '产品精修' : task.workspace === 'brand' ? '品牌创作' : task.workspace === 'script' ? '短剧脚本' : '视频生成'}</strong><span>{status(task)} · {task.stage || '等待服务响应'}</span></div>{finished && <button className="task-dismiss-button" disabled={removingId === task.id} onClick={() => dismissTask(task)} aria-label={`删除任务 ${String(task.id).slice(0, 8)}`}><X size={15} /></button>}<b>{Number(task.progress || 0)}%</b><i><em style={{ width: `${Math.max(0, Math.min(100, Number(task.progress || 0)))}%` }} /></i><small>任务 {String(task.id).slice(0, 8)} · 更新于 {task.updatedAt ? new Date(task.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '刚刚'}</small></article> })}</div></section>
  return <div className="task-progress-menu task-progress-menu--widget" style={widgetPosition}>
    <button ref={triggerRef} className={`task-progress-button${open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`} aria-label="查看后台任务进度" aria-expanded={open} onPointerDown={startDragging} onPointerMove={dragWidget} onPointerUp={stopDragging} onPointerCancel={stopDragging} onMouseDown={startDragging} onMouseMove={dragWidget} onMouseUp={stopDragging} onClick={togglePopover} title="按住可拖动"><ListChecks size={18} /><span>任务进度</span><b>{active.length}</b></button>
    {open && createPortal(progressPopover, document.body)}
    {completedToast && <div className="task-complete-toast" role="status"><CheckCircle2 size={19} /><span><strong>{completedToast.workspace === 'retouch' ? '产品精修' : completedToast.workspace === 'brand' ? '品牌创作' : completedToast.workspace === 'script' ? '短剧脚本' : '视频生成'}任务已完成</strong><small>结果已保存到对应资产库</small></span><button onClick={() => setCompletedToast(null)} aria-label="关闭完成提醒"><X size={16} /></button></div>}
  </div>
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
          <button className="task-item task-link" onClick={() => onNavigate('retouch')}><span className="task-symbol"><FileImage size={18} /></span><span><strong>5 张精修小样</strong><small>等待确认</small></span><ArrowUpRight size={15} /></button>
          <button className="task-item task-link" onClick={() => onNavigate('script')}><span className="task-symbol task-symbol--clay"><BookOpenText size={18} /></span><span><strong>脚本第一集</strong><small>等待审阅</small></span><ArrowUpRight size={15} /></button>
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
            <button className="text-button" onClick={() => onNavigate('assets')}>查看全部 <ArrowUpRight size={15} /></button>
          </div>
          <div className="recent-list">
            <button className="recent-item" onClick={() => onNavigate('retouch')}>
              <span className="thumb thumb--coffee"><i>J&N</i></span>
              <span className="recent-copy"><strong>秋季新品饮品精修</strong><small>产品精修 · 12 张图片</small><em><Clock3 size={13} /> 18 分钟前自动保存</em></span>
              <span className="status status--waiting">待确认</span>
              <ArrowUpRight size={17} />
            </button>
            <button className="recent-item" onClick={() => onNavigate('brand')}>
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

const MERCH_MATERIALS = {
  '冰箱贴': ['亚克力：通透轻盈，适合插画和图形', '木质：温润自然，适合国风纹样', '陶瓷：雅致有器物感，适合山水书法', '金属珐琅：精致耐用，有收藏感'],
  '杯垫': ['原色纸浆板：天然纤维和吸水纹理', '吸水陶瓷：器物感强，适合茶文化', '木质：温润、有自然木纹', '软木：轻便实用、成本友好'],
  '书签': ['黄铜蚀刻：细节稳定，有收藏感', '木质：温润、适合激光雕刻', '厚卡纸：印刷表现细腻', 'PET：轻透现代，适合图形素材'],
  '帆布袋': ['棉帆布：耐用，适合丝网或数码印花', '棉麻：天然、东方感更强', '厚磅涤棉：颜色稳定，适合批量生产'],
  '马克杯 / 茶杯': ['陶瓷釉面：适合热转印或釉上彩', '磨砂陶瓷：质感克制，适合新中式', '不锈钢保温杯：适合 UV 彩印'],
  '礼盒包装': ['特种纸：适合烫金、压凹凸', '灰板裱纸：结构稳定，可量产', '竹木盒：温润，有礼赠感'],
}

function materialHintsFor(product) {
  const value = product.toLowerCase()
  if (/杯|瓶|壶|盘|碟/.test(product)) return MERCH_MATERIALS['马克杯 / 茶杯']
  if (/纸|本|卡|票|包装/.test(product)) return ['特种纸：适合烫金、压凹凸', '灰板裱纸：结构稳定，可量产', '棉浆纸：细腻、适合高品质印刷', 'PET：轻透耐用，适合透明工艺']
  if (/布|袋|巾|衣/.test(product)) return MERCH_MATERIALS['帆布袋']
  if (/扇|竹/.test(product)) return ['竹骨 + 宣纸：传统且可量产', '竹骨 + 绢布：色彩细腻，有礼赠感', '木质扇骨 + 丝绸：更具收藏质感']
  if (/金属|徽章|胸针/.test(product)) return ['金属烤漆：细节稳定，适合图形', '仿珐琅：色彩精致，有收藏感', '黄铜蚀刻：纹样细节清晰，可量产']
  return ['亚克力：通透轻盈，适合图形素材', '陶瓷：雅致、有器物感', '木质：温润自然，适合国风设计', '金属珐琅：精致耐用，有收藏感']
}

export function DisabledReasonTooltip({ reason, children }) {
  return <span className="disabled-reason" data-reason={reason || undefined} tabIndex={reason ? 0 : undefined}>{children}{reason && <span role="tooltip">{reason}</span>}</span>
}

export function WorkflowStepper({ steps, activeStep, onStep }) {
  return <ol className="workflow-stepper" aria-label="文创设计步骤">
    {steps.map((label, index) => {
      const stepNo = index + 1
      const complete = stepNo < activeStep
      const current = stepNo === activeStep
      return <li key={label} className={current ? 'is-active' : complete ? 'is-done' : 'is-pending'}>
        <button type="button" disabled={!complete && !current} onClick={() => complete && onStep(stepNo)} aria-current={current ? 'step' : undefined}><b>{complete ? '✓' : stepNo}</b><span>{label}</span></button>
      </li>
    })}
  </ol>
}

export function BrandMerchWorkflow({ assets, selectedAsset, onSelectAsset, busy, plan, image, error, onPlan, onGenerate, onViewImage }) {
  const [step, setStep] = useState(1)
  const [product, setProduct] = useState('')
  const [material, setMaterial] = useState('')
  const [size, setSize] = useState('')
  const [brief, setBrief] = useState('')
  const [upload, setUpload] = useState(null)
  const [imageName, setImageName] = useState('')
  const [originalBrandPlan, setOriginalBrandPlan] = useState('')
  const [editableBrandPrompt, setEditableBrandPrompt] = useState('')
  const [customProducts, setCustomProducts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sanhua-custom-products') || '[]').slice(0, 10) } catch { return [] }
  })
  const [customProductInput, setCustomProductInput] = useState('')
  const asset = upload || selectedAsset
  const materials = MERCH_MATERIALS[product] || materialHintsFor(product)
  const clearPrompt = () => { setOriginalBrandPlan(''); setEditableBrandPrompt(''); setImageName('') }
  const clearAfterProduct = () => { setMaterial(''); setSize(''); setUpload(null); onSelectAsset(null); clearPrompt() }
  const clearAfterMaterial = () => { setSize(''); setUpload(null); onSelectAsset(null); clearPrompt() }
  const clearAfterAsset = () => clearPrompt()
  const selectUpload = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => { const item = { id: `upload-${Date.now()}`, name: file.name, url: reader.result, category: 'brand', local: true }; setUpload(item); onSelectAsset(item); clearAfterAsset() }
    reader.readAsDataURL(file)
  }
  const addCustomProduct = () => {
    const value = customProductInput.trim()
    if (!value || value.length > 40) return
    const next = [value, ...customProducts.filter(item => item !== value)].slice(0, 10)
    setCustomProducts(next)
    localStorage.setItem('sanhua-custom-products', JSON.stringify(next))
    setProduct(value); clearAfterProduct(); setCustomProductInput('')
  }
  const createPlan = async () => {
    const nextPlan = await onPlan(`中式文创周边设计需求\n产品类型：${product}\n可量产材质：${material}\n真实尺寸：${size}\n创作补充：${brief || '按品牌素材的核心视觉进行适配'}\n引用素材：${asset?.name || '未选择'}\n参考素材 ID：${asset?.id || '未选择'}\n必须还原参考图核心视觉：主体造型、主要构图、关键色彩、品牌/IP/书法/图形特征、装饰元素、氛围和材质观感。`)
    if (nextPlan) { setOriginalBrandPlan(nextPlan); setEditableBrandPrompt(nextPlan); setStep(5) }
  }
  useEffect(() => {
    if (plan && !originalBrandPlan) { setOriginalBrandPlan(plan); setEditableBrandPrompt(plan) }
  }, [plan, originalBrandPlan])
  return <div className="brand-agent-card glass-card brand-merch-workflow">
    <div><span className="kicker">中式文创周边设计 · 五步工作流</span><p>每一步完成后才能进入下一步。提示词规划由 UseGoodAI 推理模型完成，确认后才调用图片模型。</p></div>
    <WorkflowStepper steps={['产品', '材质', '尺寸', '素材', '提示词']} activeStep={step} onStep={setStep} />
    <div className={step > 1 ? 'brand-workspace-canvas is-active' : 'brand-workspace-canvas'}>
      {step > 1 && <aside className="brand-canvas-preview" aria-label="品牌创作实时预览"><span className="kicker">实时预览</span><strong>{product || '选择产品'}</strong><small>{material || '等待选择材质'} · {size || '待填写尺寸'}</small>{asset ? <CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /> : <span className="canvas-placeholder">选择素材后将在此展示参考构图</span>}<p>{brief || '补充设计需求后，这里会同步显示创作摘要。'}</p></aside>}
      <div className="brand-workspace-form">
    {step === 1 && <section><strong>想做哪一种中式文创周边？</strong><div className="merch-options">{[...Object.keys(MERCH_MATERIALS), ...customProducts.filter(item => !Object.keys(MERCH_MATERIALS).includes(item))].map(item => <button key={item} aria-pressed={product === item} className={product === item ? 'secondary-button is-selected' : 'secondary-button'} onClick={() => { if (product === item) { setProduct(''); clearAfterProduct() } else { setProduct(item); clearAfterProduct() } }}>{product === item && '✓ 已选 · '}{item}</button>)}</div><label className="merch-custom-field">添加自定义产品标签（回车保存）<input value={customProductInput} onChange={event => setCustomProductInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomProduct() } }} placeholder="例如：香牌、折扇、丝巾、手机壳" aria-label="自定义文创产品类型" /></label>{product && <p className="selection-summary">当前产品：{product}。下一步会据此更新可量产材质建议。</p>}<DisabledReasonTooltip reason={!product.trim() ? '请先选择或填写产品类型' : ''}><button className="primary-button" disabled={!product.trim()} onClick={() => setStep(2)}>下一步：选择材质</button></DisabledReasonTooltip></section>}
    {step === 2 && <section><strong>{product}适合以下可量产材质</strong><div className="merch-options merch-options--stack">{materials.map(item => <button key={item} aria-pressed={material === item} className={material === item ? 'secondary-button is-selected' : 'secondary-button'} onClick={() => { if (material === item) { setMaterial(''); clearAfterMaterial() } else { setMaterial(item); clearAfterMaterial() } }}>{material === item && '✓ 已选 · '}{item}</button>)}</div><label className="merch-custom-field">或自行填写材质与工艺<input value={materials.includes(material) ? '' : material} onChange={event => { setMaterial(event.target.value); clearAfterMaterial() }} placeholder="例如：竹骨 + 绢布，UV 彩印" aria-label="自定义文创材质" /></label>{material && <p className="selection-summary">当前材质：{material}。最终提示词会据此写入真实质感和生产工艺。</p>}<div className="brand-agent-actions"><button className="secondary-button" onClick={() => setStep(1)}>上一步</button><button className="primary-button" disabled={!material.trim()} onClick={() => setStep(3)}>下一步：确认尺寸</button></div></section>}
    {step === 3 && <section><strong>填写真实产品尺寸</strong><input value={size} onChange={event => { setSize(event.target.value); clearPrompt() }} placeholder="例如 90 × 90 mm" aria-label="文创产品尺寸" />{size && <p className="selection-summary">当前尺寸：{size}。最终效果图会标注对应的 REAL SIZE。</p>}<p>尺寸会写入效果图提案的 REAL SIZE 标注。</p><div className="brand-agent-actions"><button className="secondary-button" onClick={() => setStep(2)}>上一步</button><button className="primary-button" disabled={!size.trim()} onClick={() => setStep(4)}>下一步：选择素材</button></div></section>}
    {step === 4 && <section><strong>选择或上传视觉素材</strong><div className="asset-picker"><div>{assets.map(item => <button key={item.id} aria-pressed={asset?.id === item.id} className={asset?.id === item.id ? 'asset-thumb is-selected' : 'asset-thumb'} onClick={() => { if (asset?.id === item.id) { setUpload(null); onSelectAsset(null); clearAfterAsset() } else { setUpload(null); onSelectAsset(item); clearAfterAsset() } }}><CachedImage asset={item} src={item.previewUrl || item.thumbnailUrl || item.url} alt={item.name} /><small>{asset?.id === item.id ? `✓ 已选 · ${item.name}` : item.name}</small></button>)}</div></div><label className="secondary-button merch-upload">上传图片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectUpload} /></label>{asset && <p className="asset-selected">已选择参考素材：{asset.name}。将强制写入参考图还原提示词。</p>}<textarea value={brief} onChange={event => { setBrief(event.target.value); clearPrompt() }} aria-label="文创补充要求" placeholder="可补充文案、风格、必须保留或禁止出现的元素" /><div className="brand-agent-actions"><button className="secondary-button" onClick={() => setStep(3)}>上一步</button><button className="primary-button" disabled={!asset || busy} onClick={createPlan}>{busy ? '正在生成提示词…' : '生成最终提示词'}</button></div></section>}
    {step === 5 && <section><strong>UseGoodAI 推理输出 · 可执行提示词</strong>{editableBrandPrompt ? <div className="brand-plan"><textarea value={editableBrandPrompt} onChange={event => setEditableBrandPrompt(event.target.value)} aria-label="品牌最终提示词" /><small>{editableBrandPrompt === originalBrandPlan ? '原始提示词由 UseGoodAI 生成' : '已修改 · 出图将使用当前内容'}</small></div> : <p role="status">正在由推理模型整理产品、材质、尺寸与素材约束…</p>}<label className="merch-custom-field">生成图片名称<input value={imageName} maxLength="160" onChange={event => setImageName(event.target.value)} placeholder={`例如：${product || '茶猫'}${product ? '-正面方案' : '冰箱贴-正面方案'}`} aria-label="生成图片名称" /></label><p className="selection-summary">产品：{product} · 材质：{material} · 尺寸：{size} · 参考图：{asset?.name || '未选择'}</p><div className="brand-agent-actions"><button className="secondary-button" disabled={busy} onClick={() => { clearPrompt(); setStep(4) }}>返回修改</button><button className="primary-button" disabled={busy || !editableBrandPrompt.trim()} onClick={() => onGenerate(imageName, editableBrandPrompt, originalBrandPlan)}>{busy ? '正在生成效果图…' : '确认并生成效果图'}</button></div>{image && <div className="brand-result-preview"><button className="brand-generated-preview" onClick={() => onViewImage(image)}><img className="brand-generated-image" src={image.url} alt="中式文创效果图，点击查看大图" /><small>点击放大查看</small></button><a className="secondary-button" href={`/api/v1/assets/${image.id}/download`} download={image.downloadName || image.name}><Download size={15} />下载原图</a></div>}{error && <p className="retouch-error" role="alert">{error}</p>}</section>}
      </div>
    </div>
  </div>
}

function CreativeCasesPage({ type, initialRoute = '' }) {
  const [editor, setEditor] = useState(null)
  const [toolbarTab, setToolbarTab] = useState(0)
  const [brandPrompt, setBrandPrompt] = useState('为叁花茶馆设计一张日光茶饮品牌海报，保留叁花 Logo，突出茶汤与留白。')
  const [brandPlan, setBrandPlan] = useState('')
  const [brandImage, setBrandImage] = useState('')
  const [brandAssets, setBrandAssets] = useState([])
  const [brandBusy, setBrandBusy] = useState(false)
  const [brandError, setBrandError] = useState('')
  const [viewerImage, setViewerImage] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [scriptPrompt, setScriptPrompt] = useState('围绕茶馆真实空间写一个 3 分钟短剧开场：一位年轻掌柜用一杯新茶解决老顾客之间的误会。')
  const [scriptPlan, setScriptPlan] = useState('')
  const [scripts, setScripts] = useState([])
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [scriptsError, setScriptsError] = useState('')
  const [videoDuration, setVideoDuration] = useState('180')
  const [videoStatus, setVideoStatus] = useState('')
  const [videoReady, setVideoReady] = useState(false)
  const config = CREATIVE_CASES[type]
  const [activeId, setActiveId] = useState(config.cases[0].id)
  useEffect(() => {
    const routeIndex = type === 'brand'
      ? { create: 0, library: 1, prompts: 0 }[initialRoute]
      : { create: 0, library: 1, video: 2, versions: 1 }[initialRoute]
    if (Number.isInteger(routeIndex)) setToolbarTab(routeIndex)
  }, [initialRoute, type])
  const refreshBrandAssets = async () => {
    if (type !== 'brand') return
    try {
      const response = await fetch('/api/v1/assets?workspace=brand')
      if (!response.ok) return
      const value = await response.json()
      setBrandAssets(Array.isArray(value.assets) ? value.assets : [])
    } catch {}
  }
  const refreshScripts = async () => {
    if (type !== 'script') return
    setScriptsLoading(true); setScriptsError('')
    try {
      const response = await fetch('/api/v1/scripts')
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '剧本库暂时不可用')
      setScripts(Array.isArray(value.scripts) ? value.scripts : [])
    } catch (error) { setScriptsError(error.message || '剧本库读取失败') } finally { setScriptsLoading(false) }
  }
  useEffect(() => { refreshBrandAssets(); refreshScripts() }, [type])
  const activeScript = scripts.find(item => item.id === activeId)
  const activeCase = config.cases.find(item => item.id === activeId) || config.cases[0]
  const Icon = config.icon
  const requestScript = async (url, options = {}) => {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
    const value = await response.json()
    if (!response.ok) throw new Error(value.error || '剧本保存失败')
    return value
  }
  const openScriptConfirmation = (plan, taskId) => {
    setScriptPlan(plan)
    setEditor({ pendingConfirmation: true, sourceTaskId: taskId, title: '待确认茶馆短剧计划', kind: '短剧故事规划', summary: scriptPrompt, outline: plan })
  }
  const persistScript = async values => {
    const body = JSON.stringify({ ...values, sourceAssetIds: selectedAsset ? [selectedAsset.id] : [] })
    const value = editor?.id
      ? await requestScript(`/api/v1/scripts/${editor.id}`, { method: 'PATCH', body })
      : await requestScript('/api/v1/scripts', { method: 'POST', body })
    setScripts(current => [value.script, ...current.filter(item => item.id !== value.script.id)])
    setActiveId(value.script.id)
    setScriptPlan(values.outline)
    if (editor?.pendingConfirmation) {
      setToolbarTab(1)
      if (editor.sourceTaskId) {
        fetch('/api/v1/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editor.sourceTaskId, status: 'completed', progress: 100, stage: '剧本计划已确认' }) }).catch(() => {})
      }
    }
    return value.script
  }
  const autoSaveScript = async values => {
    if (!editor?.id) return null
    const value = await requestScript(`/api/v1/scripts/${editor.id}`, { method: 'PATCH', body: JSON.stringify(values) })
    setScripts(current => [value.script, ...current.filter(item => item.id !== value.script.id)])
    return value.script
  }
  const validateVideo = async () => {
    setVideoStatus('正在校验视频任务…'); setVideoReady(false); setScriptsError('')
    try {
      const script = scripts.find(item => item.id === activeId) || scripts[0]
      const response = await fetch('/api/v1/video-tasks/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: script?.id, scriptVersionId: script?.currentVersionId, sceneAssetIds: selectedAsset ? [selectedAsset.id] : [], shotPlan: script?.outline || scriptPlan, durationSeconds: Number(videoDuration) }),
      })
      const value = await response.json()
      if (!response.ok) throw new Error(Array.isArray(value.missing) ? `请补齐：${value.missing.join('、')}` : value.error || '视频校验失败')
      setVideoReady(Boolean(value.ready))
      setVideoStatus(value.ready ? `校验通过。${value.notice || '视频模型未接入，创建后会标记为模拟任务。'}` : `请补齐：${value.missing.join('、')}`)
    } catch (error) { setVideoStatus(error.message || '视频校验失败') }
  }
  const createVideoTask = async () => {
    setVideoStatus('正在创建视频任务…')
    try {
      const script = scripts.find(item => item.id === activeId) || scripts[0]
      const response = await fetch('/api/v1/video-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scriptId: script?.id, scriptVersionId: script?.currentVersionId, sceneAssetIds: selectedAsset ? [selectedAsset.id] : [], shotPlan: script?.outline || scriptPlan, durationSeconds: Number(videoDuration) }) })
      const value = await response.json()
      if (!response.ok) throw new Error(Array.isArray(value.missing) ? `请补齐：${value.missing.join('、')}` : value.error || '视频任务创建失败')
      setVideoStatus(`${value.notice} 任务 ID：${value.task.id.slice(0, 8)}`)
      setVideoReady(false)
    } catch (error) { setVideoStatus(error.message || '视频任务创建失败') }
  }
  async function createBrandPlan(requirements = brandPrompt) {
    setBrandBusy(true); setBrandError(''); setBrandPlan(''); setBrandImage('')
    try {
      const response = await fetch('/api/v1/agent-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: 'brand', requirements, assets: selectedAsset ? [selectedAsset.id] : [], reference_asset_ids: selectedAsset ? [selectedAsset.id] : [], restore_reference_image: Boolean(selectedAsset) }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '设计助手暂不可用')
      const plan = value.plan || ''
      setBrandPlan(plan)
      return plan
    } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) }
  }
  async function generateBrandImage(requestedName = '', editablePrompt = brandPlan, originalPlan = brandPlan) {
    setBrandBusy(true); setBrandError('')
    try {
      const finalPrompt = String(editablePrompt || '').trim()
      if (!finalPrompt) throw new Error('提示词不能为空')
      const body = { workspace: 'brand', model: 'gpt-image-2', prompt: finalPrompt, count: 1, size: '1024x1024', title: '品牌创作', requestedName, promptSummary: finalPrompt.slice(0, 800), sourceAssetIds: selectedAsset ? [selectedAsset.id] : [], referenceAssetIds: selectedAsset ? [selectedAsset.id] : [], metadata: { originalPlan: String(originalPlan || '').slice(0, 12000), finalPrompt } }
      const response = await fetch('/api/v1/image-batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '品牌图片生成失败')
      const output = value.assets?.[0]
      if (!output?.url) throw new Error('模型结果未能完成资产归档')
      setBrandImage(output)
      setBrandAssets(current => [output, ...current.filter(asset => asset.id !== output.id)])
    } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) }
  }
  const generateScriptPlan = async () => {
    setBrandBusy(true); setBrandError('')
    try {
      const response = await fetch('/api/v1/agent-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: 'script', requirements: `${scriptPrompt}\n场景素材：${selectedAsset?.name || '茶馆场景待选择'}`, assets: selectedAsset ? [selectedAsset.id] : [] }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '编导助手暂不可用')
      openScriptConfirmation(value.plan || '', value.id || value.task?.id)
    } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) }
  }
  const appendScriptInspiration = suggestion => setScriptPrompt(current => `${current.trim()}${current.trim() ? '\n' : ''}${suggestion}`)

  return (
    <div className="showcase-page">
      <header className="workspace-header">
        <div><span className="breadcrumb">创作工作台 <i>/</i> 案例库</span><h1>{config.title}</h1><p>{config.subtitle}</p></div>
        <button className="primary-button" onClick={() => type === 'script' && setEditor({})}><Sparkles size={16} /> {config.action}</button>
      </header>
      <div className="showcase-layout">
        <main className="showcase-main">
          <div className="showcase-toolbar glass-card"><div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>{(type === 'script' ? ['资产库', '剧本库', '视频生成'] : ['素材创作', '产品库']).map((label, index) => <button key={label} type="button" className={toolbarTab === index ? 'primary-button' : 'secondary-button'} style={{ whiteSpace: 'nowrap', flexShrink: 0, minHeight: 36, padding: '8px 12px' }} aria-pressed={toolbarTab === index} onClick={() => setToolbarTab(index)}>{index === 0 && <Icon size={17} />}{label}</button>)}</div><small>{config.cases.length} 个项目 · 点击查看详情</small></div>
          {type === 'brand' && toolbarTab === 0 && <BrandMerchWorkflow assets={CLOUD_ASSETS.filter(asset => asset.category === 'brand')} selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} busy={brandBusy} plan={brandPlan} image={brandImage} error={brandError} onPlan={createBrandPlan} onGenerate={generateBrandImage} onViewImage={setViewerImage} />}
          {type === 'script' && toolbarTab === 0 && <div className="brand-agent-card glass-card script-workspace"><div><span className="kicker">编导助手 · 茶馆场景 Skill</span><p>从短剧专属场景资产发起创作，脚本计划会绑定真实场景，不虚构不存在的区域和道具。</p></div><div className="asset-picker"><strong>仅引用短剧资产</strong><div>{CLOUD_ASSETS.filter(asset => asset.category === 'script').slice(0, 6).map(asset => <button key={asset.id} className={selectedAsset?.id === asset.id ? 'asset-thumb is-selected' : 'asset-thumb'} onClick={() => setSelectedAsset(asset)}><img src={asset.url} alt={asset.name} /><small>{asset.name}</small></button>)}</div></div><div className="script-workspace-grid"><div className="script-input-panel"><label>短剧创作需求<textarea value={scriptPrompt} onChange={event => setScriptPrompt(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && scriptPrompt.trim() && !brandBusy) { event.preventDefault(); generateScriptPlan() } }} aria-label="短剧脚本需求" placeholder="描述人物、冲突、场景与时长" /></label><div className="script-inspiration" aria-label="创作灵感">{['加入人物冲突', '加入反转', '绑定真实茶馆空间', '强化开场钩子', '控制在 3 分钟内'].map(item => <button type="button" key={item} className="secondary-button" onClick={() => appendScriptInspiration(item)}>{item}</button>)}</div><DisabledReasonTooltip reason={!scriptPrompt.trim() ? '请先填写短剧创作需求' : ''}><button className="primary-button" disabled={brandBusy || !scriptPrompt.trim()} onClick={generateScriptPlan}>{brandBusy ? '正在分析并写作…' : '生成脚本大纲'}</button></DisabledReasonTooltip><small>按 Ctrl + Enter 或 Command + Enter 快速提交</small></div>{scriptPrompt.trim() && <aside className="script-preview-canvas" aria-label="短剧实时预览"><span className="kicker">实时预览画布</span><article><strong>剧情概要</strong><p>{scriptPrompt.slice(0, 88)}{scriptPrompt.length > 88 ? '…' : ''}</p></article><div><article><strong>角色设定</strong><p>掌柜、老顾客与来访者将围绕一个真实冲突展开。</p></article><article><strong>茶馆场景</strong><p>{selectedAsset?.name || '选择场景素材后将绑定真实空间。'}</p></article></div><article><strong>分镜预览</strong><p>开场钩子 → 人物对峙 → 茶饮转机 → 结尾反转</p></article></aside>}</div>{brandError && <p className="retouch-error" role="alert">{brandError}</p>}</div>}
          {toolbarTab === 0 && <div className="legacy-case-cache" aria-hidden="true">{config.cases.map((item, index) => <span key={item.id}>{item.title}{index === 0 && <span>{item.title}</span>}</span>)}</div>}
          {type === 'script' && toolbarTab === 2 && <section className="video-validation-panel glass-card" aria-label="视频生成前置校验"><div><span className="kicker">视频任务校验</span><h2>从已保存剧本版本发起</h2><p>先检查剧本版本、场景资产、分镜说明与预计时长。当前未接入视频模型时只会创建可追踪的模拟任务。</p></div><label>预计时长（秒）<input type="number" min="1" max="1800" value={videoDuration} onChange={event => { setVideoDuration(event.target.value); setVideoReady(false) }} /></label><p>当前剧本：{scripts.find(item => item.id === activeId)?.title || scripts[0]?.title || '未选择已保存剧本'}。场景素材：{selectedAsset?.name || '未选择'}。</p><div className="brand-agent-actions"><button className="primary-button" disabled={scriptsLoading || !scripts.length} onClick={validateVideo}>{scriptsLoading ? '正在读取剧本…' : '校验视频任务'}</button><button className="secondary-button" disabled={!videoReady} title={!videoReady ? '请先通过前置校验' : undefined} onClick={createVideoTask}>创建模拟任务</button></div>{videoStatus && <p className="video-validation-status" role="status">{videoStatus}</p>}</section>}
          {type === 'brand' && toolbarTab === 1 ? <section className="product-library-panel glass-card" aria-label="品牌产品库"><h2>品牌成品与设计方案</h2><div className="product-library-grid">{brandAssets.map(asset => <article key={asset.id}><button className="brand-generated-preview" onClick={() => setViewerImage(asset)}><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /><small>点击放大查看</small></button><div><strong>{asset.name}</strong><small>{new Date(asset.createdAt || Date.now()).toLocaleDateString('zh-CN')} · {asset.model || 'gpt-image-2'} · 引用 {asset.referenceAssetIds?.length || asset.sourceAssetIds?.length || 0} 项素材</small><span className="brand-card-actions"><a className="secondary-button" href={`/api/v1/assets/${asset.id}/download`} download={asset.downloadName || asset.name}><Download size={15} />下载</a><button className="secondary-button" aria-label={`重命名 ${asset.name}`} onClick={async () => { const nextName = window.prompt('输入新的图片名称', asset.name); if (!nextName?.trim()) return; const response = await fetch(`/api/v1/assets/${asset.id}/name`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: nextName }) }); const value = await response.json(); if (!response.ok) { setBrandError(value.error || '重命名失败'); return }; setBrandAssets(current => current.map(item => item.id === asset.id ? { ...item, ...value.asset } : item)); }}><Pencil size={15} />重命名</button></span></div></article>)}</div>{!brandAssets.length && <p>暂无已归档的品牌成品。确认生成后会自动保存在这里。</p>}</section> : ((type === 'script' && toolbarTab === 1) ? <section className={`case-grid case-grid--${type}`} aria-label={`${config.title}剧本库`}>
            {scriptsLoading && <p role="status">正在读取云端剧本库…</p>}
            {!scriptsLoading && scripts.map(script => <button className={activeId === script.id ? 'case-card is-active' : 'case-card'} key={script.id} onClick={() => { setActiveId(script.id); setEditor(script) }}><span className="case-copy"><small>云端剧本 · {script.versionCount || 1} 个版本</small><strong>{script.title}</strong><em>{script.summary || '尚未填写故事梗概'}</em><span>{script.kind || '未分类'} · 更新于 {new Date(script.updatedAt).toLocaleDateString('zh-CN')}</span></span></button>)}
            {!scriptsLoading && !scripts.length && <div className="empty-state"><p>暂无云端剧本。新建后会自动持久化并支持版本恢复。</p><button className="primary-button" onClick={() => setEditor({})}>新建剧本</button></div>}
            {scriptsError && <p className="retouch-error" role="alert">{scriptsError}</p>}
          </section> : null)}
        </main>
        {((type === 'brand' && toolbarTab === 1) || (type === 'script' && toolbarTab === 1)) && <aside className="case-inspector glass-card">
          <span className="case-inspector-icon"><Icon size={20} /></span>
          <span className="kicker">{type === 'script' ? 'CLOUD SCRIPT' : 'SELECTED CASE'}</span>
          <h2>{activeScript?.title || activeCase.title}</h2>
          <p>{activeScript?.summary || activeCase.summary}</p>
          <div className="case-facts"><span><small>类型</small><strong>{activeScript?.kind || activeCase.kind}</strong></span><span><small>{type === 'script' ? '版本' : '当前进度'}</small><strong>{type === 'script' ? `v${activeScript?.versionCount || 1}` : activeCase.progress}</strong></span><span><small>状态</small><strong>{activeScript?.status || activeCase.status}</strong></span></div>
          <button className="primary-button primary-button--wide" onClick={() => type === 'script' && setEditor(activeScript || { title: activeCase.title, kind: activeCase.kind, summary: activeCase.summary })}>{activeScript ? '编辑云端剧本' : '以此案例开始'} <ArrowUpRight size={16} /></button>
        </aside>}
      </div>
      {editor && <ScriptEditor initial={editor} onClose={() => setEditor(null)} onSave={persistScript} onAutoSave={autoSaveScript} onListVersions={async id => (await requestScript(`/api/v1/scripts/${id}/versions`)).versions || []} onSaveVersion={async (values, changeNote) => { const result = await requestScript(`/api/v1/scripts/${editor.id}/versions`, { method: 'POST', body: JSON.stringify({ ...values, changeNote }) }); setScripts(current => [result.script, ...current.filter(item => item.id !== result.script.id)]); return result }} onRestoreVersion={async versionId => { const result = await requestScript(`/api/v1/scripts/${editor.id}/restore-version`, { method: 'POST', body: JSON.stringify({ versionId }) }); setScripts(current => [result.script, ...current.filter(item => item.id !== result.script.id)]); setEditor(result.script); return result.script }} />}
      {viewerImage && <ImageViewer src={typeof viewerImage === 'string' ? viewerImage : viewerImage.url} alt={typeof viewerImage === 'string' ? '中式文创效果图' : viewerImage.name} downloadUrl={typeof viewerImage === 'string' ? viewerImage : `/api/v1/assets/${viewerImage.id}/download`} downloadName={typeof viewerImage === 'string' ? undefined : viewerImage.downloadName || viewerImage.name} onClose={() => setViewerImage('')} />}
    </div>
  )
}

function AssetLibraryPage({ onNavigate, initialCategory = 'images' }) {
  const [category, setCategory] = useState(initialCategory)
  const [storedAssets, setStoredAssets] = useState([])
  const [query, setQuery] = useState('')
  const [viewerAsset, setViewerAsset] = useState(null)
  useEffect(() => {
    let active = true
    fetch('/api/v1/assets').then(async response => {
      if (!response.ok) return
      const value = await response.json()
      if (!active) return
      const assets = Array.isArray(value.assets) ? value.assets.filter(asset => asset.id && (asset.url || asset.thumbnailUrl)).map(asset => ({
        ...asset,
        url: asset.url || asset.thumbnailUrl,
        category: asset.assetSpace === 'brand' ? 'brand-generated' : 'retouch-generated',
        group: asset.assetSpace === 'brand' ? '品牌创作成果' : '云端精修结果',
      })) : []
      setStoredAssets(assets)
    }).catch(() => {})
    return () => { active = false }
  }, [])
  useEffect(() => setCategory(initialCategory), [initialCategory])
  const allAssets = [...storedAssets, ...CLOUD_ASSETS.filter(asset => !storedAssets.some(item => item.id === asset.id)).map(asset => ({ ...asset, isDemo: true }))]
  const matches = asset => category === 'images' ? Boolean(asset.url || asset.thumbnailUrl) : category === 'brand' ? asset.category === 'brand' : category === 'script' ? asset.category === 'script' : category === 'generated' ? asset.category.endsWith('-generated') : false
  const visible = allAssets.filter(matches).filter(asset => !query.trim() || `${asset.name} ${asset.group} ${asset.assetSpace || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="page-content asset-library-page">
    <header className="workspace-header"><div><span className="breadcrumb">创作工作台 / 云端资产</span><h1>资产库</h1><p>按业务归属管理咖啡场景、茶馆文创、短剧场景和 AI 创作成果。</p></div><span className="connection-note">云端资产 · {allAssets.length} 项</span></header>
    <div className="showcase-toolbar glass-card asset-toolbar"><div>{[['images', '图片'], ['brand', '茶馆文创'], ['script', '短剧'], ['generated', 'AI 成果']].map(([id, label]) => <button key={id} className={category === id ? 'primary-button' : 'secondary-button'} onClick={() => setCategory(id)}>{label}</button>)}</div><label className="asset-search"><span className="sr-only">搜索资产</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称、业务或来源" aria-label="搜索资产" /></label><small>{visible.length} 项素材</small></div>
    <section className="asset-grid" aria-label="云端资产列表">
      {visible.map(asset => <article className="asset-card glass-card" key={asset.id}><button className="asset-image-button" onClick={() => setViewerAsset(asset)} aria-label={`查看 ${asset.name}`}><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /></button><div><span><strong>{asset.name}</strong><small>{asset.isDemo ? `${asset.group} · 演示素材` : asset.group}</small></span><span className="asset-card-actions">{!asset.isDemo && <a className="secondary-button" href={`/api/v1/assets/${asset.id}/download`} download={asset.downloadName || asset.name} aria-label={`下载 ${asset.name}`}><Download size={15} /></a>}<button className="secondary-button" onClick={() => onNavigate(asset.category === 'script' ? 'script' : asset.category === 'brand' || asset.assetSpace === 'brand' ? 'brand' : 'retouch')}>{asset.category === 'script' ? '用于写剧本' : asset.category === 'brand' || asset.assetSpace === 'brand' ? '用于创作' : '用于精修'}</button></span></div></article>)}
    </section>
    {!visible.length && <p className="empty-state">未找到匹配资产，请调整搜索词或分类。</p>}
    {viewerAsset && <ImageViewer src={viewerAsset.url} alt={viewerAsset.name} downloadUrl={viewerAsset.isDemo ? viewerAsset.url : `/api/v1/assets/${viewerAsset.id}/download`} downloadName={viewerAsset.downloadName || viewerAsset.name} onClose={() => setViewerAsset(null)} />}
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
  const [subRoute, setSubRoute] = useState(DEFAULT_SUB_ROUTE[validPreviewPage || initialPage] || '')
  const [timeMode, setTimeMode] = useState(previewParams.get('theme') === 'night' ? 'night' : 'day')

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />

  const navigate = (nextPage, nextSubRoute = DEFAULT_SUB_ROUTE[nextPage] || '') => { setPage(nextPage); setSubRoute(nextSubRoute) }
  return (
    <div className={`app-shell time-${timeMode}`}>
      <Sidebar page={page} subRoute={subRoute} onNavigate={navigate} />
      <div className="app-main">
        <Topbar timeMode={timeMode} onToggleTimeMode={() => setTimeMode(mode => mode === 'day' ? 'night' : 'day')} onLogout={() => { setAuthenticated(false); navigate('home') }} />
        <div className="page-transition" key={page}>
          {page === 'home' && <HomePage onNavigate={navigate} />}
          {page === 'retouch' && (demoRetouch ? <RetouchPage /> : <LiveRetouch initialTab={subRoute === 'gallery' ? 'gallery' : 'one-click'} focusAssistant={subRoute === 'assistant'} />)}
          {page === 'brand' && <CreativeCasesPage type="brand" initialRoute={subRoute} />}
          {page === 'script' && <CreativeCasesPage type="script" initialRoute={subRoute} />}
          {page === 'assets' && <AssetLibraryPage onNavigate={navigate} initialCategory={subRoute} />}
          {page === 'settings' && <ApiSettings />}
        </div>
      </div>
      <TaskProgress />
    </div>
  )
}
