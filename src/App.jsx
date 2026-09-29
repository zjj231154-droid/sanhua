import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ScriptEditor from './components/ScriptEditor'
import ApiSettings from './components/ApiSettings'
import UserProfile from './components/UserProfile'
import {
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Copy,
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileImage,
  Film,
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
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  Trash2,
  X,
} from 'lucide-react'
import RippleDistortion from './components/RippleDistortion/RippleDistortion'
import LiveRetouch from './components/LiveRetouch'
import ImageViewer from './components/ImageViewer'
import GeneratedArchiveDialog from './components/GeneratedArchiveDialog'
import CachedImage from './components/CachedImage'
import { CLOUD_ASSETS } from './data/cloudAssets'

const NAV_ITEMS = [
  { id: 'home', label: '工作台', icon: Home },
  { id: 'retouch', label: '产品精修', icon: WandSparkles, children: [['one-click', '一键修图'], ['gallery', '图库'], ['tasks', '任务记录']] },
  { id: 'brand', label: '品牌创作', icon: Palette, children: [['create', '素材创作'], ['library', '产品库'], ['prompts', '提示词记录']] },
  { id: 'script', label: '短剧脚本', icon: BookOpenText, children: [['create', '脚本创作'], ['library', '剧本库'], ['video', '视频生成'], ['versions', '版本记录']] },
  { id: 'assets', label: '资产库', icon: FolderOpen, children: [['retouch', '精修图库'], ['brand', '茶馆文创库'], ['script', '短剧库'], ['video-library', '视频库'], ['text', '文本库'], ['generated', 'AI 成果']] },
]

const DEFAULT_SUB_ROUTE = { home: '', retouch: 'one-click', brand: 'create', script: 'create', assets: 'retouch', settings: '', profile: '' }

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

function Login({ onLogin, previewOnly = false }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', workspaceName: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const update = key => event => setForm(current => ({ ...current, [key]: event.target.value }))
  const submit = async event => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (previewOnly) { onLogin({}); return }
      const response = await fetch(mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const value = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(value.hint || value.error || '无法登录，请稍后重试。')
      onLogin(value)
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
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

      <form className="login-card login-card--glass" noValidate={previewOnly} onSubmit={submit}>
        <div className="login-card-heading">
          <div>
            <h2>{mode === 'login' ? '欢迎回来' : '创建工作台'}</h2>
            <p>{mode === 'login' ? '登录你的专属创作工作台' : '创建独立账号与第一个私有工作空间'}</p>
          </div>
        </div>

        <div className="login-fields">
          {mode === 'register' && <><label>
            <div className="input-shell"><span className="input-label">姓名</span><input value={form.name} onChange={update('name')} maxLength={80} aria-label="姓名" required /></div>
          </label><label>
            <div className="input-shell"><span className="input-label">工作台</span><input value={form.workspaceName} onChange={update('workspaceName')} maxLength={100} aria-label="工作台名称" placeholder="例如：叁花品牌组" /></div>
          </label></>}
          <label>
            <div className="input-shell">
              <Mail size={17} />
              <span className="input-label">账号</span>
              <input type="email" value={form.email} onChange={update('email')} autoComplete="email" aria-label="账号" required />
            </div>
          </label>
          <label>
            <div className="input-shell">
              <LockKeyhole size={17} />
              <span className="input-label">密码</span>
              <input type="password" value={form.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={10} aria-label="密码" required />
            </div>
          </label>
        </div>

        <div className="login-options">
          <span>{mode === 'register' ? '密码至少 10 位' : '安全会话将在 14 天后自动失效'}</span>
          <button type="button" onClick={() => { setMode(current => current === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? '创建账号' : '已有账号，登录'}</button>
        </div>

        <button className="primary-button primary-button--wide login-submit" type="submit">
          {busy ? '正在验证…' : previewOnly ? '进入演示工作台' : mode === 'login' ? '登录工作台' : '创建并进入工作台'} <ArrowUpRight size={18} />
        </button>
        <p className="demo-disclaimer"><ShieldCheck size={15} /> 账号、工作空间与素材均由服务端隔离；个人密钥仅加密保存。</p>
        {message && <p className="login-error" role="alert">{message}</p>}
      </form>

      <footer className="login-footer">
        <span>产品精修</span><i /> <span>品牌创作</span><i /> <span>短剧脚本</span>
      </footer>
    </main>
  )
}

function Sidebar({ page, subRoute, onNavigate }) {
  const [expandedPage, setExpandedPage] = useState(() => NAV_ITEMS.some(item => item.id === page && item.children) ? page : null)
  useEffect(() => {
    setExpandedPage(NAV_ITEMS.some(item => item.id === page && item.children) ? page : null)
  }, [page])
  const toggleSection = id => {
    if (page === id) {
      setExpandedPage(current => current === id ? null : id)
      return
    }
    setExpandedPage(id)
    onNavigate(id)
  }
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark"><img src="/logo.svg" alt="" onError={event => { event.currentTarget.style.display = 'none' }} /></span>
        <span>叁花</span>
      </div>
      <nav className="main-nav" aria-label="主导航">
        <span className="nav-caption">创作空间</span>
        {NAV_ITEMS.map(({ id, label, icon: Icon, children }) => {
          const isExpanded = expandedPage === id
          return <div className="nav-group" key={id}>
          <button className={page === id ? 'nav-item is-active' : 'nav-item'} onClick={() => toggleSection(id)} aria-expanded={children ? isExpanded : undefined} aria-controls={children ? `nav-submenu-${id}` : undefined}>
            <span className="nav-icon"><Icon size={18} strokeWidth={2} /></span><span>{label}</span>{page === id && <i className="nav-dot" aria-hidden="true" />}{children && <ChevronDown className="nav-chevron" size={15} />}
          </button>
          {isExpanded && children && <div className="nav-submenu" id={`nav-submenu-${id}`} aria-label={`${label}子菜单`}>
            {children.map(([route, childLabel]) => <button key={route} className={subRoute === route ? 'nav-subitem is-active' : 'nav-subitem'} onClick={() => onNavigate(id, route)}>{childLabel}</button>)}
          </div>}
        </div>
        })}
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
  const lastVideoSyncAt = useRef(0)
  const triggerRef = useRef(null)
  const dragStart = useRef(null)
  const suppressClick = useRef(false)
  const load = async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      let response = await fetch('/api/v1/tasks')
      let value = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : '任务状态暂不可用，请稍后重试')
      let nextTasks = Array.isArray(value.tasks) ? value.tasks.slice(0, 12) : []
      const hasActiveVideo = nextTasks.some(task => task.workspace === 'video' && ['queued', 'running'].includes(task.status))
      if (hasActiveVideo && Date.now() - lastVideoSyncAt.current >= 8000) {
        lastVideoSyncAt.current = Date.now()
        await fetch('/api/v1/video-tasks').catch(() => null)
        response = await fetch('/api/v1/tasks')
        value = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : '任务状态暂不可用，请稍后重试')
        nextTasks = Array.isArray(value.tasks) ? value.tasks.slice(0, 12) : []
      }
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

function Topbar({ timeMode, onToggleTimeMode, onLogout, session, onSwitchWorkspace, onOpenProfile }) {
  const isNight = timeMode === 'night'
  return (
    <header className="topbar">
      <button className="scope-switcher" aria-label={isNight ? '切换为日咖模式' : '切换为夜酒模式'} onClick={onToggleTimeMode}>
        <span className="scope-icon">{isNight ? '夜' : '光'}</span>
        <span><small>当前模式</small><strong>{isNight ? '夜酒空间' : '日咖空间'}</strong></span>
        <ChevronDown size={16} />
      </button>
      <div className="top-actions">
        <button className="icon-button" aria-label="帮助"><CircleHelp size={19} /></button>
        <button className="icon-button notification-button" aria-label="消息"><MessageSquareText size={19} /><i /></button>
        <button className="top-profile" aria-label="当前设计师" onClick={onOpenProfile} title="账户设置">
          <span className="avatar">{session?.user?.avatarUrl ? <img src={session.user.avatarUrl} alt="" /> : (session?.user?.name || '林').slice(0, 1)}</span>
          <span><strong>{session?.user?.name || '林设计'}</strong><small>{session?.workspace?.name || '独立工作台'}</small></span>
        </button>
        {session?.workspaces?.length > 1 && <select className="workspace-select" value={session.workspace?.id || ''} onChange={event => onSwitchWorkspace?.(event.target.value)} aria-label="切换工作空间">{session.workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role}</option>)}</select>}
        <button className="icon-button logout-button" aria-label="退出演示账号" onClick={onLogout} title="退出账号"><LogOut size={18} /></button>
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

const RECORD_TYPE_LABELS = { retouch_prompt: '精修提示词', brand_prompt: '文创提示词', script: '短剧剧本', storyboard_prompt: '分镜提示词', retouch_plan: '精修计划', retouch_final_prompt: '最终提示词', brand_plan: '设计计划', brand_final_prompt: '最终提示词', script_outline: '脚本大纲', script_version: '剧本版本', video_prompt: '视频提示词' }

function PromptRecordPage({ workspace, title, description, filters = [], onReuse, initialFilter = 'all' }) {
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { setActiveFilter(initialFilter) }, [initialFilter])
  const includeDeleted = activeFilter === 'deleted'
  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ limit: '40' })
      if (workspace || activeFilter.startsWith('workspace:')) params.set('workspace', workspace || activeFilter.slice('workspace:'.length))
      if (includeDeleted) params.set('includeDeleted', 'true')
      if (activeFilter !== 'all' && !includeDeleted && !activeFilter.startsWith('workspace:')) params.set('recordType', activeFilter)
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/v1/text-records?${params}`)
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '文本记录暂时无法读取')
      setRecords((value.records || []).filter(record => includeDeleted ? record.status === 'deleted' : record.status !== 'deleted'))
    } catch (reason) { const message = reason.message || '文本记录读取失败'; setError(message === 'SANHUA_ASSETS_NOT_CONFIGURED' ? '云端文本库尚未配置，部署后绑定存储卷即可启用持久化记录。' : message) } finally { setLoading(false) }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, query ? 300 : 0); return () => window.clearTimeout(timer) }, [workspace, activeFilter, query])
  const mutate = async (record, method, body, action) => {
    setBusyId(record.id); setError('')
    try {
      const response = await fetch(`/api/v1/text-records/${record.id}${action === 'restore' ? '/restore' : ''}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '操作未完成')
      setNotice(action === 'delete' ? '已移入回收站' : action === 'restore' ? '已恢复记录' : '已更新记录')
      await load()
    } catch (reason) { setError(reason.message || '操作失败，可重试') } finally { setBusyId('') }
  }
  const copy = async record => {
    setBusyId(record.id)
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(record.content)
      else throw new Error('当前浏览器不支持复制')
      setNotice('已复制完整文本')
    } catch (reason) { setError(reason.message || '复制失败') } finally { setBusyId('') }
  }
  return <section className="prompt-record-page page-content">
    <header className="workspace-header"><div><span className="breadcrumb">创作工作台 / 文本记录</span><h1>{title}</h1><p>{description}</p></div><span className="connection-note">云端文本记录</span></header>
    <div className="prompt-record-toolbar glass-card"><div className="record-filter-tabs">{[['all', '全部'], ...filters, ['deleted', '已删除']].map(([id, label]) => <button key={id} className={activeFilter === id ? 'primary-button' : 'secondary-button'} onClick={() => setActiveFilter(id)}>{label}</button>)}</div><label className="asset-search"><span className="sr-only">搜索文本记录</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、摘要或全文" aria-label="搜索文本记录" /></label></div>
    {notice && <p className="record-notice" role="status">{notice}</p>}{error && <p className="retouch-error" role="alert">{error}</p>}
    <div className="prompt-record-list" aria-label="文本记录列表">{loading && <p role="status">正在读取云端文本记录…</p>}{!loading && records.map(record => <article className="prompt-record-card glass-card" key={record.id}><header><span><b>{RECORD_TYPE_LABELS[record.recordType] || record.recordType}</b><small>{record.workspace === 'retouch' ? '产品精修' : record.workspace === 'brand' ? '品牌创作' : record.workspace === 'video' ? '视频生成' : '短剧脚本'}</small></span><time>{new Date(record.updatedAt || record.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></header><h2>{record.title}</h2><p>{record.summary || record.content}</p><footer><span>{record.model || '手动记录'} · 任务 {record.sourceTaskId ? record.sourceTaskId.slice(0, 8) : '—'}</span><div><details><summary>查看全文</summary><pre>{record.content}</pre></details><button className="secondary-button" disabled={busyId === record.id} onClick={() => void copy(record)}><Copy size={14} />复制</button>{record.status === 'deleted' ? <button className="secondary-button" disabled={busyId === record.id} onClick={() => void mutate(record, 'POST', null, 'restore')}><RotateCcw size={14} />恢复</button> : <><button className="secondary-button" disabled={busyId === record.id} onClick={() => { const next = window.prompt('重命名文本记录', record.title); if (next?.trim()) void mutate(record, 'PATCH', { title: next.trim() }, 'rename') }}><Pencil size={14} />重命名</button><button className="secondary-button" disabled={busyId === record.id} onClick={() => onReuse?.(record)}><RefreshCw size={14} />复用</button><button className="secondary-button record-delete" disabled={busyId === record.id} onClick={() => void mutate(record, 'DELETE', null, 'delete')}><Trash2 size={14} />删除</button></>}</div></footer></article>)}{!loading && !records.length && <p className="empty-state">暂无提示词记录，完成一次生成后会自动出现在这里。</p>}</div>
  </section>
}

function VideoWorkbench({ scripts, activeId, scriptPlan }) {
  const [assets, setAssets] = useState([]); const [assetType, setAssetType] = useState('scene'); const [pickerOpen, setPickerOpen] = useState(false)
  const [refs, setRefs] = useState({ scene: [], character: [], prop: [] }); const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState('8'); const [ratio, setRatio] = useState('9:16'); const [resolution, setResolution] = useState('720p'); const [status, setStatus] = useState(''); const [creating, setCreating] = useState(false); const [tasks, setTasks] = useState([]); const [playingTask, setPlayingTask] = useState(null); const mentionPending = useRef(false)
  useEffect(() => { let active = true; fetch('/api/v1/assets?workspace=script&usableFor=video&limit=80&includeLegacy=true').then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value.assets || [] }).then(value => { if (active) setAssets(value) }).catch(() => { if (active) setAssets(CLOUD_ASSETS.filter(item => item.category === 'script').map(item => ({ ...item, assetSpace: 'script', assetType: 'image', videoAssetType: 'scene', usableFor: ['script', 'video'], isDemo: true }))) }); return () => { active = false } }, [])
  useEffect(() => { let active = true; const load = () => fetch('/api/v1/video-tasks').then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value.tasks || [] }).then(value => { if (active) setTasks(value) }).catch(() => {}); void load(); const timer = window.setInterval(load, 8000); return () => { active = false; window.clearInterval(timer) } }, [])
  const activeScript = scripts.find(item => item.id === activeId) || scripts[0]
  const selected = Object.values(refs).flat(); const filtered = assets.filter(asset => asset.videoAssetType === assetType)
  const toggle = asset => {
    const type = ['scene', 'character', 'prop'].includes(asset.videoAssetType) ? asset.videoAssetType : assetType
    const isSelected = refs[type].some(item => item.id === asset.id)
    if (!isSelected && selected.length >= 9) { setStatus('Seedance 单次最多引用 9 张图片，请先移除一张参考图。'); return }
    if (isSelected) setPrompt(current => current.split(`@${asset.name}`).join(''))
    if (!isSelected && mentionPending.current) {
      setPrompt(current => current.endsWith('@') ? `${current.slice(0, -1)}@${asset.name}` : `${current}${current.trim() ? ' ' : ''}@${asset.name}`)
      mentionPending.current = false
    }
    setRefs(current => ({ ...current, [type]: current[type].some(item => item.id === asset.id) ? current[type].filter(item => item.id !== asset.id) : [...current[type], asset] }))
  }
  const missing = !activeScript ? '请先确认并保存剧本与分镜提示词' : !refs.scene.length ? '请至少添加一张场景资产' : (prompt.trim() || activeScript.outline || scriptPlan).length < 12 ? '请输入不少于 12 字的视频提示词' : ''
  const create = async () => { if (missing || creating) return; setCreating(true); setStatus('正在校验视频任务…'); const body = { scriptId: activeScript.id, scriptVersionId: activeScript.currentVersionId, videoPrompt: prompt.trim() || activeScript.outline || scriptPlan, shotPlan: activeScript.outline || scriptPlan, durationSeconds: Number(duration), aspectRatio: ratio, resolution, assetRefs: Object.fromEntries(Object.entries(refs).map(([key, value]) => [key, value.map(item => item.id)])) }; try { const checked = await fetch('/api/v1/video-tasks/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const validation = await checked.json(); if (!checked.ok) throw new Error(validation.hint || `请补齐：${(validation.missing || []).join('、')}`); setStatus('正在创建 Seedance 视频任务…'); const response = await fetch('/api/v1/video-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const value = await response.json(); if (!response.ok) throw new Error(value.hint || value.error || '视频任务创建失败'); setTasks(current => [value.task, ...current]); setStatus(`${value.notice} 任务 ID：${value.task.id.slice(0, 8)}；分镜提示词已归档。`) } catch (reason) { setStatus(reason.message || '视频任务创建失败') } finally { setCreating(false) } }
  const addMention = () => { mentionPending.current = true; setPrompt(current => current.endsWith('@') ? current : `${current}${current.trim() ? ' ' : ''}@`); setPickerOpen(true) }
  return <section className="video-workbench" aria-label="视频生成工作台">
    <header><span className="kicker">SEEDANCE VIDEO</span><h2>视频生成</h2><p>输入或点击 @ 可引用已上传的短剧素材；被选中的图片会作为真实参考内容发送给模型。</p></header>
    <div className="seedance-composer">
      <div className="seedance-input-row"><button type="button" className="seedance-add-button" onClick={() => setPickerOpen(true)} aria-label="从短剧库添加图片"><ImagePlus size={22} /><small>参考内容</small></button><div className="seedance-conversation" aria-label="Seedance 对话输入框"><div className="seedance-inline-mentions">{selected.length ? selected.map((asset, index) => <span key={asset.id} className="seedance-reference" title={`将作为 [Image${index + 1}] 实际发送给视频模型`}><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt="" /><b>@{asset.name}</b><small>[Image{index + 1}]</small><button aria-label={`移除 ${asset.name}`} onClick={() => toggle(asset)}>×</button></span>) : <span className="seedance-mention-hint">输入 @ 或点击下方 @，即可把已上传素材嵌入对话框并发送给模型。</span>}</div><textarea value={prompt} onChange={event => { const next = event.target.value; setPrompt(next); if (next.endsWith('@')) { mentionPending.current = true; setPickerOpen(true) } }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void create() } }} placeholder="描述镜头、动作和运镜；@素材名 会作为参考图随任务发送。" aria-label="视频生成提示词" /></div></div>
      <footer><button className="secondary-button" onClick={() => setPickerOpen(true)}><ImagePlus size={15} />添加图片</button><span>Seedance 2.0 · 全能参考 · 最多 9 张</span><select value={ratio} onChange={event => setRatio(event.target.value)} aria-label="画面比例"><option>9:16</option><option>16:9</option><option>1:1</option></select><select value={resolution} onChange={event => setResolution(event.target.value)} aria-label="视频分辨率"><option>480p</option><option>720p</option><option>1080p</option></select><label>{duration}s<input type="range" min="4" max="15" value={duration} onChange={event => setDuration(event.target.value)} /></label><button className="seedance-at-button" onClick={addMention} aria-label="引用已上传素材" title="引用已上传素材">@</button><button className="seedance-submit" disabled={Boolean(missing) || creating} title={missing || undefined} onClick={() => void create()}>{creating ? '提交中…' : '生成视频 ↑'}</button></footer>
      {status && <p className="video-validation-status" role="status">{status}</p>}
    </div>
    {pickerOpen && <div className="asset-picker-modal" role="presentation"><section className="asset-picker-dialog" role="dialog" aria-modal="true" aria-label="从短剧库添加图片"><header className="asset-picker-heading"><div><strong>从短剧库添加图片</strong><small>选择后会写入 @素材名，并作为真实图片参考发送给 Seedance。</small></div><button className="icon-button" onClick={() => setPickerOpen(false)} aria-label="关闭短剧资产选择"><X size={18} /></button></header><div className="record-filter-tabs">{[['scene', '场景资产'], ['character', '角色资产'], ['prop', '道具资产']].map(([id, label]) => <button key={id} className={assetType === id ? 'primary-button' : 'secondary-button'} onClick={() => setAssetType(id)}>{label}</button>)}</div><div className="asset-picker-grid">{filtered.map(asset => <button key={asset.id} className={refs[assetType].some(item => item.id === asset.id) ? 'asset-select-card is-selected' : 'asset-select-card'} onClick={() => toggle(asset)}><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /><span>{asset.name}</span><small>{asset.createdBy || '短剧库资产'}</small></button>)}{!filtered.length && <p className="asset-picker-loading">暂无{assetType === 'scene' ? '场景' : assetType === 'character' ? '角色' : '道具'}资产。</p>}</div><footer className="asset-picker-footer"><span>已添加 {selected.length} / 9 项参考资产</span><button className="primary-button" onClick={() => setPickerOpen(false)}>完成添加</button></footer></section></div>}
    {tasks.length > 0 && <section className="video-task-results"><h3>视频结果</h3>{tasks.map(task => <article key={task.id}>{task.providerVideoUrl && <video muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true" onPlay={event => event.currentTarget.pause()} src={task.providerVideoUrl} />}<div><b>镜头 {task.id.slice(0, 8)}</b><span>{task.stage} · {task.durationSeconds} 秒 · {task.aspectRatio}</span><small>引用 {Object.values(task.assetRefs || {}).flat().length} 项资产{task.providerTaskId ? ` · 上游任务 ${task.providerTaskId}` : ''}</small></div>{task.providerVideoUrl && <button className="secondary-button" onClick={() => setPlayingTask(task)}><Film size={15} />打开视频</button>}</article>)}</section>}
    {playingTask && <VideoPlayerDialog task={playingTask} onClose={() => setPlayingTask(null)} />}
  </section>
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

const BRAND_WORKFLOW_STEPS = {
  product: ['产品', '材质', '尺寸', '素材', '提示词'],
  graphic: ['素材', '二创方向', '输出形式', '保留与画幅', '提示词'],
}

const BOX_PRODUCT_PATTERN = /礼盒|包装|盒/

const GRAPHIC_DIRECTIONS = ['原画延展', '构图再设计', '提炼成纹样', '系列化设计', '配色改版', '动作延展', '场景延展', '道具延展', '四季 / 节气延展']
const GRAPHIC_SERIES = ['同主题不同场景', '四季系列', '二十四节气', '茶生活系列', '情绪系列', '生活方式系列', '装饰画系列', '城市文化系列']
const GRAPHIC_OUTPUTS = ['单张延展插画', '四张独立插画', '四宫格', '系列海报', '方形文创图', '连续纹样', '一组纹样单元']
const GRAPHIC_RATIOS = ['1:1', '4:5', '4:3', '3:2', '16:9', '9:16']

async function imageAssetToDataUrl(asset) {
  const source = asset?.url || asset?.previewUrl || asset?.thumbnailUrl
  if (!source) throw new Error('请先选择参考图')
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(source)) return source
  const response = await fetch(source)
  if (!response.ok) throw new Error('参考图读取失败，请重新选择')
  const blob = await response.blob()
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('参考图必须是 PNG、JPG 或 WebP')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('参考图读取失败，请重新选择'))
    reader.readAsDataURL(blob)
  })
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

export function BrandMerchWorkflow({ assets, selectedAsset, onSelectAsset, busy, plan, image, error, onPlan, onGenerate, onViewImage, onArchive }) {
  const [mode, setMode] = useState('')
  const [step, setStep] = useState(1)
  const [product, setProduct] = useState('')
  const [material, setMaterial] = useState('')
  const [size, setSize] = useState('')
  const [brief, setBrief] = useState('')
  const [graphicDirection, setGraphicDirection] = useState('')
  const [graphicSeries, setGraphicSeries] = useState('')
  const [graphicOutput, setGraphicOutput] = useState('')
  const [graphicPreserve, setGraphicPreserve] = useState('')
  const [graphicRatio, setGraphicRatio] = useState('')
  const [upload, setUpload] = useState(null)
  const [imageName, setImageName] = useState('')
  const [originalBrandPlan, setOriginalBrandPlan] = useState('')
  const [editableBrandPrompt, setEditableBrandPrompt] = useState('')
  const [originalDielinePlan, setOriginalDielinePlan] = useState('')
  const [editableDielinePrompt, setEditableDielinePrompt] = useState('')
  const [dielineImage, setDielineImage] = useState(null)
  const [dielineConfirmed, setDielineConfirmed] = useState(false)
  const [boxDielineChoice, setBoxDielineChoice] = useState('')
  const [customProducts, setCustomProducts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sanhua-custom-products') || '[]').slice(0, 10) } catch { return [] }
  })
  const [customProductInput, setCustomProductInput] = useState('')
  const asset = upload || selectedAsset
  const materials = MERCH_MATERIALS[product] || materialHintsFor(product)
  const clearPrompt = () => { setOriginalBrandPlan(''); setEditableBrandPrompt(''); setOriginalDielinePlan(''); setEditableDielinePrompt(''); setDielineImage(null); setDielineConfirmed(false); setImageName('') }
  const clearAfterProduct = () => { setMaterial(''); setSize(''); setBoxDielineChoice(''); clearPrompt() }
  const clearAfterMaterial = () => { setSize(''); clearPrompt() }
  const clearAfterAsset = () => clearPrompt()
  const clearGraphicAfterAsset = () => { setGraphicDirection(''); setGraphicSeries(''); setGraphicOutput(''); setGraphicPreserve(''); setGraphicRatio(''); clearPrompt() }
  const chooseMode = nextMode => {
    if (nextMode === mode) return
    setMode(nextMode); setStep(1); setProduct(''); setMaterial(''); setSize(''); setBoxDielineChoice(''); setBrief('')
    setGraphicDirection(''); setGraphicSeries(''); setGraphicOutput(''); setGraphicPreserve(''); setGraphicRatio('')
    setUpload(null); clearPrompt()
  }
  const selectUpload = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => { const item = { id: `upload-${Date.now()}`, name: file.name, url: reader.result, category: 'brand', local: true }; setUpload(item); onSelectAsset(item); mode === 'graphic' ? clearGraphicAfterAsset() : clearAfterAsset() }
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
  const createDielinePlan = async () => {
    const nextPlan = await onPlan(`中式文创产品刀版图需求\n流程阶段：产品刀版图\n结构状态：概念结构示意（当前未接入包装结构 Harness，非生产级 SVG/刀模）\n产品类型：${product}\n可量产材质：${material}\n真实尺寸：${size}\n创作补充：${brief || '按品牌素材的核心视觉进行适配'}\n引用素材：${asset?.name || '未选择'}\n参考素材 ID：${asset?.id || '未选择'}\n必须严格参考参考图：主体造型、主要构图、关键色彩、品牌/IP/书法/图形特征、装饰元素、氛围和材质观感均为不可偏离的视觉基准。刀版图仅用于工艺与结构沟通，需明确标注“概念刀版示意，生产前由厂家/CAD 校核”。`)
    if (nextPlan) { setOriginalDielinePlan(nextPlan); setEditableDielinePrompt(nextPlan); setDielineImage(null); setDielineConfirmed(false); setStep(6) }
  }
  const generateDieline = async () => {
    const result = await onGenerate(`${product || '文创产品'}-刀版图`, editableDielinePrompt, originalDielinePlan, { phase: 'dieline', sourceAsset: asset })
    if (result) { setDielineImage(result); setDielineConfirmed(false) }
  }
  const confirmDielineAndCreateProductPlan = async () => {
    setDielineConfirmed(true)
    const nextPlan = await onPlan(`中式文创周边产品效果图需求\n流程阶段：产品效果图\n刀版图状态：已生成并经用户确认\n刀版图资产：${dielineImage?.id || '已确认'}\n产品类型：${product}\n可量产材质：${material}\n真实尺寸：${size}\n创作补充：${brief || '按品牌素材的核心视觉进行适配'}\n引用素材：${asset?.name || '未选择'}\n参考素材 ID：${asset?.id || '未选择'}\n必须严格参考参考图，作为唯一视觉基准：必须还原主体造型、主要构图、关键色彩、品牌/IP/书法/图形特征、装饰元素、氛围和材质观感；不得只做风格参考、不得替换主体、不得重新设计角色或品牌识别元素。效果图中的结构与已确认刀版图必须一致。`)
    if (nextPlan) { setOriginalBrandPlan(nextPlan); setEditableBrandPrompt(nextPlan); setStep(7) }
  }
  const createProductPlan = async () => {
    const isBox = BOX_PRODUCT_PATTERN.test(product)
    const nextPlan = await onPlan(`中式文创产品效果图需求\n流程阶段：产品效果图\n产品路径：${isBox ? '盒型/包装（不生成新刀版）' : '非盒型文创周边'}\n刀版意向：${isBox ? '不需要，仅做包装效果图' : '不适用'}\n产品类型：${product}\n可量产材质：${material}\n真实尺寸：${size}\n创作补充：${brief || '按品牌素材的核心视觉进行适配'}\n引用素材：${asset?.name || '未选择'}\n参考素材 ID：${asset?.id || '未选择'}\n必须严格参考参考图，作为唯一视觉基准：还原主体造型、主要构图、关键色彩、品牌/IP/书法/图形特征、装饰元素、氛围和材质观感；不得只做风格参考、不得替换主体、不得重新设计角色或品牌识别元素。输出 2–3 个同设计一致视图，右上角 REAL SIZE、右下角 DESIGN CONCEPT。`)
    if (nextPlan) { setOriginalBrandPlan(nextPlan); setEditableBrandPrompt(nextPlan); setStep(isBox ? 6 : 5) }
  }
  const createGraphicPlan = async () => {
    const nextPlan = await onPlan(`品牌平面二次创作需求\n创作模式：平面二创\n二创方向：${graphicDirection}\n系列方向：${graphicDirection === '系列化设计' ? graphicSeries : '不适用'}\n输出形式：${graphicOutput}\n必须保留元素：${graphicPreserve || '保留原素材核心主体、画风、关键色彩与可识别元素'}\n画幅比例：${graphicRatio}\n引用素材：${asset?.name || '未选择'}\n参考素材 ID：${asset?.id || '未选择'}\n如果参考图包含明确角色或 IP，必须以原图为唯一视觉基准，严格锁定脸型、比例、五官、毛色、花纹、标志性色块和核心识别特征；只允许变化动作、场景、道具、季节、构图和氛围，不得重画成相似的新角色。`)
    if (nextPlan) { setOriginalBrandPlan(nextPlan); setEditableBrandPrompt(nextPlan); setStep(5) }
  }
  const graphicMode = mode === 'graphic'
  const isBoxProduct = BOX_PRODUCT_PATTERN.test(product)
  const needsBoxDieline = isBoxProduct && boxDielineChoice === 'need'
  const productSteps = !isBoxProduct ? BRAND_WORKFLOW_STEPS.product : needsBoxDieline ? ['产品', '材质', '刀版意向', '尺寸', '素材', '刀版确认', '效果图'] : ['产品', '材质', '刀版意向', '尺寸', '素材', '提示词']
  const summary = graphicMode
    ? `方向：${graphicDirection || '待选择'} · 输出：${graphicOutput || '待选择'} · 画幅：${graphicRatio || '待选择'} · 参考图：${asset?.name || '未选择'}`
    : `产品：${product} · 材质：${material} · 尺寸：${size} · 参考图：${asset?.name || '未选择'}`
  const selectAsset = item => {
    if (asset?.id === item.id) { setUpload(null); onSelectAsset(null); graphicMode ? clearGraphicAfterAsset() : clearAfterAsset() }
    else { setUpload(null); onSelectAsset(item); graphicMode ? clearGraphicAfterAsset() : clearAfterAsset() }
  }
  const assetStep = (title, onBack, onContinue, continueLabel) => <section className="brand-step-card"><strong>{title}</strong><div className="asset-picker"><div>{assets.map(item => <button key={item.id} aria-pressed={asset?.id === item.id} className={asset?.id === item.id ? 'asset-thumb is-selected' : 'asset-thumb'} onClick={() => selectAsset(item)}><CachedImage asset={item} src={item.previewUrl || item.thumbnailUrl || item.url} alt={item.name} /><small>{asset?.id === item.id ? `✓ 已选 · ${item.name}` : item.name}</small></button>)}</div></div><label className="secondary-button merch-upload">上传图片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectUpload} /></label>{asset && <p className="asset-selected">已选择参考素材：{asset.name}。会作为唯一视觉基准写入提示词。</p>}{!graphicMode && <textarea value={brief} onChange={event => { setBrief(event.target.value); clearPrompt() }} aria-label="文创补充要求" placeholder="可补充文案、风格、必须保留或禁止出现的元素" />}<div className="brand-step-actions"><button className="secondary-button" onClick={onBack}>上一步</button><button className="next-step-button" disabled={!asset || busy} onClick={onContinue}>{busy ? '正在生成提示词…' : continueLabel}</button></div></section>
  return <div className="brand-agent-card glass-card brand-merch-workflow">
    <div><span className="kicker">中式文创设计平台 · Skill v4.0</span><p>按对话逐步确认产品与材质；仅盒型包装在选择新刀版后进入结构确认，非盒型不强制刀版。</p></div>
    <div className="brand-mode-picker" role="group" aria-label="品牌创作方式">
      <button type="button" className={mode === 'product' ? 'brand-mode-card is-selected' : 'brand-mode-card'} aria-label="选择做产品工作流" aria-pressed={mode === 'product'} onClick={() => chooseMode('product')}><Layers3 size={20} /><span><strong>做产品</strong><small>把插画、纹样或 IP 落地为可量产文创周边</small></span></button>
      <button type="button" className={mode === 'graphic' ? 'brand-mode-card is-selected' : 'brand-mode-card'} aria-label="选择做平面工作流" aria-pressed={mode === 'graphic'} onClick={() => chooseMode('graphic')}><FileImage size={20} /><span><strong>做平面</strong><small>基于原图延展插画、纹样或 IP 系列视觉</small></span></button>
    </div>
    {mode && <><WorkflowStepper steps={graphicMode ? BRAND_WORKFLOW_STEPS.graphic : productSteps} activeStep={step} onStep={setStep} />
    <div className={step > 1 ? `brand-workspace-canvas is-active${mode === 'product' && step === 4 ? ' is-material-step' : ''}${mode === 'product' && needsBoxDieline && step === 6 ? ' is-dieline-step' : ''}` : 'brand-workspace-canvas'}>
      {step > 1 && <aside className="brand-canvas-preview" aria-label="品牌创作实时预览"><span className="kicker">实时预览</span><strong>{graphicMode ? graphicOutput || '平面视觉延展' : product || '选择产品'}</strong><small>{graphicMode ? graphicDirection || '等待选择二创方向' : material || '等待选择材质'} · {graphicMode ? graphicRatio || '待填写画幅' : size || '待填写尺寸'}</small>{asset ? <CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /> : <span className="canvas-placeholder">选择素材后将在此展示参考构图</span>}<p>{graphicMode ? graphicPreserve || '原图的核心主体、画风与识别元素会在此流程中被锁定。' : brief || '补充设计需求后，这里会同步显示创作摘要。'}</p></aside>}
      <div className="brand-workspace-form">
        {!graphicMode && step === 1 && <section className="brand-step-card dialog-step"><p className="dialog-step-label">现在进入第一步：选择文创产品。</p><strong>你想设计哪种文创周边？</strong><div className="dialog-choice-list">{[...Object.keys(MERCH_MATERIALS), '丝巾', '钥匙扣', '徽章', ...customProducts.filter(item => !Object.keys(MERCH_MATERIALS).includes(item))].filter((item, index, list) => list.indexOf(item) === index).map(item => <label key={item} className={product === item ? 'is-selected' : ''}><input type="radio" name="merch-product" checked={product === item} onChange={() => { setProduct(item); clearAfterProduct() }} />{item}</label>)}</div><label className="merch-custom-field">其他产品（回车保存）<input value={customProductInput} onChange={event => setCustomProductInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomProduct() } }} placeholder="例如：香牌、折扇、手机壳" aria-label="自定义文创产品类型" /></label><div className="brand-step-actions"><button className="next-step-button" aria-label="下一步：选择材质" disabled={!product.trim()} onClick={() => setStep(2)}>下一步</button></div></section>}
        {!graphicMode && step === 2 && <section className="brand-step-card dialog-step"><p className="dialog-step-label">产品已确定：<b>{product}</b>。现在选择可生产材质。</p><strong>哪种材质更符合你的设计？</strong><div className="dialog-choice-list">{materials.map(item => <label key={item} className={material === item ? 'is-selected' : ''}><input type="radio" name="merch-material" checked={material === item} onChange={() => { setMaterial(item); clearAfterMaterial() }} />{item}</label>)}</div><label className="merch-custom-field">或自行填写材质与工艺<input value={materials.includes(material) ? '' : material} onChange={event => { setMaterial(event.target.value); clearAfterMaterial() }} placeholder="例如：竹骨 + 绢布，UV 彩印" aria-label="自定义文创材质" /></label><div className="brand-step-actions"><button className="secondary-button" onClick={() => setStep(1)}>上一步</button><button className="next-step-button" disabled={!material.trim()} onClick={() => setStep(3)}>下一步</button></div></section>}
        {!graphicMode && isBoxProduct && step === 3 && <section className="brand-step-card dialog-step"><p className="dialog-step-label">材质已确定：<b>{material}</b>。</p><strong>是否需要同步生成盒型刀版图？</strong><div className="dialog-choice-list"><label className={boxDielineChoice === 'need' ? 'is-selected' : ''}><input type="radio" name="box-dieline" checked={boxDielineChoice === 'need'} onChange={() => { setBoxDielineChoice('need'); clearPrompt() }} />需要，先生成概念结构图并确认</label><label className={boxDielineChoice === 'skip' ? 'is-selected' : ''}><input type="radio" name="box-dieline" checked={boxDielineChoice === 'skip'} onChange={() => { setBoxDielineChoice('skip'); clearPrompt() }} />不需要，只生成包装效果图</label></div><small>当前未接入包装结构 Harness；“需要”将生成概念结构示意，非生产级 SVG/刀模。</small><div className="brand-step-actions"><button className="secondary-button" onClick={() => setStep(2)}>上一步</button><button className="next-step-button" disabled={!boxDielineChoice} onClick={() => setStep(4)}>下一步</button></div></section>}
        {!graphicMode && step === (isBoxProduct ? 4 : 3) && <section className="brand-step-card dialog-step"><p className="dialog-step-label">现在确认真实产品尺寸。</p><strong>请填写成品尺寸</strong><input value={size} onChange={event => { setSize(event.target.value); clearPrompt() }} placeholder={isBoxProduct ? '例如 外尺寸 180 × 120 × 60 mm' : '例如 90 × 90 mm'} aria-label="文创产品尺寸" />{isBoxProduct && <small>盒型尺寸请标明内尺寸或外尺寸；未提供内装物、内托或盒型时，后续提示词会保留为待厂家确认项。</small>}<div className="brand-step-actions"><button className="secondary-button" onClick={() => setStep(isBoxProduct ? 3 : 2)}>上一步</button><button className="next-step-button" disabled={!size.trim()} onClick={() => setStep(isBoxProduct ? 5 : 4)}>下一步</button></div></section>}
        {!graphicMode && !isBoxProduct && step === 4 && assetStep('选择或上传原始视觉素材', () => setStep(3), createProductPlan, '生成效果图提示词 →')}
        {!graphicMode && isBoxProduct && step === 5 && assetStep('选择或上传包装视觉素材', () => setStep(4), needsBoxDieline ? createDielinePlan : createProductPlan, needsBoxDieline ? '生成概念刀版图提示词 →' : '生成效果图提示词 →')}
        {!graphicMode && needsBoxDieline && step === 6 && <section className="brand-step-card"><strong>确认概念刀版图 / 工艺结构示意</strong><p>这不是生产级 SVG 或刀模；未接入结构 Harness 时，量产前必须由厂家或 CAD 校核。确认后才会生成包装效果图。</p>{editableDielinePrompt ? <div className="brand-plan"><textarea value={editableDielinePrompt} onChange={event => { setEditableDielinePrompt(event.target.value); setDielineImage(null); setDielineConfirmed(false) }} aria-label="文创刀版图提示词" /></div> : <p role="status">正在整理结构与工艺约束…</p>}<div className="brand-agent-actions"><button className="secondary-button" disabled={busy} onClick={() => setStep(5)}>返回修改素材</button><button className="primary-button" disabled={busy || !editableDielinePrompt.trim()} onClick={generateDieline}>{busy ? '正在生成概念刀版图…' : '生成概念刀版图'}</button></div>{dielineImage && <div className="brand-result-preview"><button className="brand-generated-preview" onDoubleClick={() => onViewImage(dielineImage)} title="双击放大查看"><img className="brand-generated-image" src={dielineImage.url} alt="包装概念刀版图，双击查看大图" /><small>双击放大查看</small></button><button className="primary-button" disabled={busy} onClick={confirmDielineAndCreateProductPlan}>{busy ? '正在生成效果图提示词…' : '刀版确认，生成效果图提示词 →'}</button></div>}{error && <p className="retouch-error" role="alert">{error}</p>}</section>}
        {graphicMode && step === 1 && assetStep('选择或上传要二次创作的原始素材', () => chooseMode(''), () => setStep(2), '下一步：选择二创方向 →')}
        {graphicMode && step === 2 && <section className="brand-step-card"><strong>想往哪个方向进行二次创作？</strong><div className="merch-options">{GRAPHIC_DIRECTIONS.map(item => <button key={item} aria-pressed={graphicDirection === item} className={graphicDirection === item ? 'secondary-button is-selected' : 'secondary-button'} onClick={() => { setGraphicDirection(graphicDirection === item ? '' : item); setGraphicSeries(''); setGraphicOutput(''); setGraphicPreserve(''); setGraphicRatio(''); clearPrompt() }}>{graphicDirection === item && '✓ 已选 · '}{item}</button>)}</div>{graphicDirection === '系列化设计' && <><strong className="brand-subquestion">想做哪一种系列？</strong><div className="merch-options">{GRAPHIC_SERIES.map(item => <button key={item} aria-pressed={graphicSeries === item} className={graphicSeries === item ? 'secondary-button is-selected' : 'secondary-button'} onClick={() => { setGraphicSeries(graphicSeries === item ? '' : item); clearPrompt() }}>{graphicSeries === item && '✓ 已选 · '}{item}</button>)}</div></>}<div className="brand-step-actions"><button className="secondary-button" onClick={() => setStep(1)}>上一步</button><button className="next-step-button" disabled={!graphicDirection || (graphicDirection === '系列化设计' && !graphicSeries)} onClick={() => setStep(3)}>下一步：选择输出形式 →</button></div></section>}
        {graphicMode && step === 3 && <section className="brand-step-card"><strong>希望最终输出成什么形式？</strong><div className="merch-options">{GRAPHIC_OUTPUTS.map(item => <button key={item} aria-pressed={graphicOutput === item} className={graphicOutput === item ? 'secondary-button is-selected' : 'secondary-button'} onClick={() => { setGraphicOutput(graphicOutput === item ? '' : item); clearPrompt() }}>{graphicOutput === item && '✓ 已选 · '}{item}</button>)}</div><div className="brand-step-actions"><button className="secondary-button" onClick={() => setStep(2)}>上一步</button><button className="next-step-button" disabled={!graphicOutput} onClick={() => setStep(4)}>下一步：锁定保留元素 →</button></div></section>}
        {graphicMode && step === 4 && <section className="brand-step-card"><strong>锁定必须保留的元素与画幅</strong><p>若素材包含明确 IP 角色，角色的脸型、比例、五官、毛色、花纹及标志性特征会自动锁定，只允许延展动作、场景、道具和构图。</p><textarea value={graphicPreserve} onChange={event => { setGraphicPreserve(event.target.value); clearPrompt() }} aria-label="平面创作必须保留元素" placeholder="例如：猫咪主体、竹桌茶具、竹叶、水墨线稿、留白构图" /><strong className="brand-subquestion">选择画幅比例</strong><div className="merch-options">{GRAPHIC_RATIOS.map(item => <button key={item} aria-pressed={graphicRatio === item} className={graphicRatio === item ? 'secondary-button is-selected' : 'secondary-button'} onClick={() => { setGraphicRatio(graphicRatio === item ? '' : item); clearPrompt() }}>{graphicRatio === item && '✓ 已选 · '}{item}</button>)}</div><div className="brand-step-actions"><button className="secondary-button" onClick={() => setStep(3)}>上一步</button><button className="next-step-button" disabled={!graphicPreserve.trim() || !graphicRatio || busy} onClick={createGraphicPlan}>{busy ? '正在生成提示词…' : '生成最终提示词 →'}</button></div></section>}
        {(graphicMode ? step === 5 : (!isBoxProduct && step === 5) || (isBoxProduct && !needsBoxDieline && step === 6) || (needsBoxDieline && step === 7)) && <section className="brand-step-card"><strong>UseGoodAI 推理输出 · {graphicMode ? '平面视觉' : '产品效果图'}提示词</strong>{editableBrandPrompt ? <div className="brand-plan"><textarea value={editableBrandPrompt} onChange={event => setEditableBrandPrompt(event.target.value)} aria-label="品牌最终提示词" /><small>{editableBrandPrompt === originalBrandPlan ? '原始提示词由 UseGoodAI 生成' : '已修改 · 出图将使用当前内容'}</small></div> : <p role="status">正在由推理模型整理已确认的约束…</p>}<label className="merch-custom-field">生成图片名称<input value={imageName} maxLength="160" onChange={event => setImageName(event.target.value)} placeholder={`例如：${graphicMode ? graphicOutput || '茶猫系列视觉' : product || '茶猫'}-设计方案`} aria-label="生成图片名称" /></label><p className="selection-summary">{summary}</p>{needsBoxDieline && <p className="selection-summary">已确认概念刀版图：{dielineImage?.name || '未确认'}。效果图会严格参考原图并遵循该结构。</p>}<div className="brand-agent-actions"><button className="secondary-button" disabled={busy} onClick={() => setStep(graphicMode ? 4 : needsBoxDieline ? 6 : isBoxProduct ? 5 : 4)}>返回修改</button><button className="primary-button" disabled={busy || !editableBrandPrompt.trim() || (needsBoxDieline && (!dielineConfirmed || !dielineImage))} onClick={() => onGenerate(imageName, editableBrandPrompt, originalBrandPlan, { phase: graphicMode ? 'graphic-effect' : 'product-effect', sourceAsset: asset, dielineImage: needsBoxDieline ? dielineImage : null, dielineRequired: needsBoxDieline, dielineConfirmed: graphicMode || !needsBoxDieline || dielineConfirmed, dielineAssetId: needsBoxDieline ? dielineImage?.id || '' : '' })}>{busy ? '正在生成效果图…' : '确认并生成效果图'}</button></div>{image && <div className="brand-result-preview"><button className="brand-generated-preview" onDoubleClick={() => onViewImage(image)} title="双击放大查看"><img className="brand-generated-image" src={image.url} alt="品牌创作效果图，双击查看大图" /><small>双击放大查看</small></button><button className="primary-button" onClick={() => onArchive?.(image)}>保存到资产库</button><a className="secondary-button" href={`/api/v1/assets/${image.id}/download`} download={image.downloadName || image.name}><Download size={15} />下载原图</a></div>}{error && <p className="retouch-error" role="alert">{error}</p>}</section>}
      </div>
    </div></>}
  </div>
}

function ScriptAssetUnitPicker({ selectedScene, selectedCharacter, selectedProp, onSelectScene, onSelectCharacter, onSelectProp }) {
  const [activeType, setActiveType] = useState('')
  const [remoteAssets, setRemoteAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadingType, setUploadingType] = useState('')
  const [error, setError] = useState('')
  const unitDefinitions = [
    { id: 'scene', label: '场景资产', description: '绑定真实茶馆空间', selected: selectedScene, select: onSelectScene },
    { id: 'character', label: '角色资产', description: '选择出场人物参考', selected: selectedCharacter, select: onSelectCharacter },
    { id: 'prop', label: '道具资产', description: '选择关键物件参考', selected: selectedProp, select: onSelectProp },
  ]
  const activeUnit = unitDefinitions.find(item => item.id === activeType)
  const sceneFallback = useMemo(() => CLOUD_ASSETS.filter(asset => asset.category === 'script').slice(0, 6).map(asset => ({ ...asset, videoAssetType: 'scene', isDemo: true })), [])
  useEffect(() => {
    if (!activeType) return undefined
    let cancelled = false
    setLoading(true); setError('')
    fetch('/api/v1/assets?workspace=script&limit=80&includeLegacy=true')
      .then(async response => {
        const value = await response.json()
        if (!response.ok) throw new Error(value.error || '资产库读取失败')
        return Array.isArray(value.assets) ? value.assets : []
      })
      .then(assets => { if (!cancelled) setRemoteAssets(assets) })
      .catch(reason => { if (!cancelled) { setRemoteAssets([]); setError(reason.message || '资产库暂时不可用') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeType])
  const shownAssets = useMemo(() => {
    const typedAssets = remoteAssets.filter(asset => asset.videoAssetType === activeType)
    if (activeType !== 'scene') return typedAssets
    const knownIds = new Set(sceneFallback.map(asset => asset.id))
    return [...sceneFallback, ...typedAssets.filter(asset => !knownIds.has(asset.id))]
  }, [activeType, remoteAssets, sceneFallback])
  const openPicker = type => setActiveType(type)
  const chooseAsset = asset => {
    activeUnit?.select(asset)
    setActiveType('')
  }
  const uploadLocalAsset = async (event, type) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const invalid = files.find(file => !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024)
    if (invalid) {
      setError('仅支持 15MB 以内的 PNG、JPG、WebP 图片')
      return
    }
    setUploadingType(type); setError('')
    try {
      const uploaded = []; const failed = []
      for (const file of files) {
        try {
          const image = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(new Error('图片读取失败'))
            reader.readAsDataURL(file)
          })
          const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
          const response = await fetch(`/api/assets/script-assets/${type}-${Date.now()}-${uploaded.length}.${extension}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, workspace: 'script', name: file.name, videoAssetType: type, usableFor: ['script', 'video'], tags: ['短剧', type === 'scene' ? '场景' : type === 'character' ? '角色' : '道具'] }),
          })
          const value = await response.json()
          if (!response.ok || !value.asset) throw new Error(value.error || '上传失败')
          uploaded.push({ ...value.asset, url: value.url, previewUrl: value.url, thumbnailUrl: value.url })
        } catch (reason) { failed.push(`${file.name}${reason.message ? `（${reason.message}）` : ''}`) }
      }
      if (uploaded.length) {
        setRemoteAssets(current => [...uploaded, ...current.filter(asset => !uploaded.some(item => item.id === asset.id))])
        unitDefinitions.find(unit => unit.id === type)?.select(uploaded[0])
      }
      if (failed.length) setError(`已上传 ${uploaded.length}/${files.length} 张；失败：${failed.join('、')}`)
      else if (uploaded.length) setActiveType('')
    } catch (reason) { setError(reason.message || '上传失败，请稍后重试') } finally { setUploadingType('') }
  }
  return <>
    <section className="script-asset-units" aria-label="短剧资产分类">
      {unitDefinitions.map(unit => <div className="script-asset-unit-wrap" key={unit.id}><button type="button" className={unit.selected ? 'script-asset-unit is-selected' : 'script-asset-unit'} onClick={() => openPicker(unit.id)} aria-label={`选择${unit.label}`}>
        <FolderOpen size={19} /><span><strong>{unit.label}</strong><small>{unit.selected ? `已选：${unit.selected.name}` : unit.description}</small></span><span className="script-asset-unit-action">选择图片</span>
      </button><label className="script-asset-upload"><Upload size={13} />{uploadingType === unit.id ? '正在上传…' : '批量本地上传'}<input type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label={`批量上传${unit.label}图片`} disabled={Boolean(uploadingType)} onChange={event => uploadLocalAsset(event, unit.id)} /></label></div>)}
    </section>
    {activeUnit && <div className="asset-picker-modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setActiveType('') }}>
      <section className="asset-picker-dialog" role="dialog" aria-modal="true" aria-label={`${activeUnit.label}图片库`}>
        <header className="asset-picker-heading"><div><strong>{activeUnit.label}图片库</strong><small>{activeType === 'scene' ? '场景沿用原有短剧茶馆素材，也可选择云端场景资产。' : `从云端资产库选择${activeUnit.label.replace('资产', '')}参考。`}</small></div><button type="button" className="icon-button" aria-label="关闭图片库" onClick={() => setActiveType('')}><X size={18} /></button></header>
        <div className="asset-picker-grid">
          {loading && <p className="asset-picker-loading">正在读取云端图片库…</p>}
          {!loading && shownAssets.map(asset => <button key={asset.id} type="button" className={activeUnit.selected?.id === asset.id ? 'asset-select-card is-selected' : 'asset-select-card'} onClick={() => chooseAsset(asset)}>
            <CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /><span>{asset.name}</span><small>{asset.isDemo ? '短剧场景素材' : '云端资产'}</small><b className="asset-selection-index">已选</b>
          </button>)}
          {!loading && !shownAssets.length && <p className="asset-picker-loading">暂无{activeUnit.label}。请先在资产库上传并标记为{activeUnit.label.replace('资产', '')}。</p>}
        </div>
        <footer className="asset-picker-footer"><span>{error ? error : `点击图片即可选为${activeUnit.label}；也可在上方卡片直接本地上传。`}</span><button type="button" className="secondary-button" onClick={() => setActiveType('')}>取消</button></footer>
      </section>
    </div>}
  </>
}

function ScriptCreationFlow({ stage, prompt, setPrompt, plan, setPlan, seedancePrompt, setSeedancePrompt, busy, saveBusy, selectedScene, selectedCharacter, selectedProp, onGenerate, onConfirmStory, onSave, onOpenImport, onImportFile, importInputRef, onIdea, onOpenVideo }) {
  const preview = <aside className="script-preview-canvas" aria-label="短剧实时预览"><span className="kicker">已确认生产上下文</span><article><strong>剧情概要</strong><p>{(plan || prompt).slice(0, 150)}{(plan || prompt).length > 150 ? '…' : ''}</p></article><div><article><strong>角色设定</strong><p>{selectedCharacter?.name || '请从角色资产中选择人物参考。'}</p></article><article><strong>茶馆场景</strong><p>{selectedScene?.name || '请从场景资产中选择真实空间。'}</p></article></div><article><strong>关键道具</strong><p>{selectedProp?.name || '未指定关键道具。'}</p></article></aside>
  if (stage === 'confirm-story') return <div className="script-workspace-grid"><div className="script-input-panel"><span className="kicker">第二步 · 确认剧本与角色</span><label>剧本规划<textarea value={plan} onChange={event => setPlan(event.target.value)} aria-label="待确认剧本规划" /></label><p className="selection-summary">角色参考：{selectedCharacter?.name || '未选择'}；场景：{selectedScene?.name || '未选择'}。</p><div className="script-outline-actions"><button className="secondary-button" onClick={() => { setPlan(''); }}>重新规划</button><button className="primary-button" disabled={!plan.trim() || !selectedCharacter} onClick={onConfirmStory}>确认剧本与角色，生成 Seedance 提示词</button></div><small>确认后才会进入视频分镜提示词阶段；未选择角色时不能继续。</small></div>{preview}</div>
  if (stage === 'confirm-seedance') return <div className="script-workspace-grid"><div className="script-input-panel"><span className="kicker">第三步 · 确认 Seedance 提示词</span><label>Seedance 2.0 视频提示词<textarea value={seedancePrompt} onChange={event => setSeedancePrompt(event.target.value)} aria-label="Seedance 视频提示词" /></label><p className="selection-summary">提示词仅引用已确认的场景、角色和道具；可继续编辑镜头、动作和声音约束。</p><div className="script-outline-actions"><button className="secondary-button" onClick={onConfirmStory}>重新生成提示词</button><button className="primary-button" disabled={!seedancePrompt.trim() || saveBusy} onClick={onSave}>{saveBusy ? '正在保存…' : '确认并保存到剧本库'}</button></div><small>保存后会分别归档「短剧剧本」和「分镜提示词」，再进入视频生成。</small></div>{preview}</div>
  if (stage === 'saved') return <div className="script-workspace-grid"><div className="script-input-panel"><span className="kicker">已保存 · 剧本库</span><h2>剧本与分镜提示词已分别归档</h2><p>可以在剧本库查看剧本正文，在文本记录查看 Seedance 分镜提示词；视频生成只会读取已确认的资产与提示词。</p><div className="script-outline-actions"><button className="secondary-button" onClick={() => setPlan('')}>新建下一部剧本</button><button className="primary-button" onClick={onOpenVideo}>进入视频生成</button></div></div>{preview}</div>
  return <div className="script-workspace-grid"><div className="script-input-panel"><span className="kicker">第一步 · 定剧本与角色</span><label>短剧创作需求<textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && prompt.trim() && !busy) { event.preventDefault(); onGenerate() } }} aria-label="短剧脚本需求" placeholder="描述人物、冲突、场景与时长" /></label><div className="script-inspiration" aria-label="创作灵感">{['加入人物冲突', '加入反转', '绑定真实茶馆空间', '强化开场钩子', '控制在 3 分钟内'].map(item => <button type="button" key={item} className="secondary-button" onClick={() => onIdea(item)}>{item}</button>)}</div><div className="script-outline-actions"><DisabledReasonTooltip reason={!prompt.trim() ? '请先填写短剧创作需求' : ''}><button className="primary-button" disabled={busy || !prompt.trim()} onClick={onGenerate}>{busy ? '正在规划剧本…' : '生成待确认剧本'}</button></DisabledReasonTooltip><button type="button" className="secondary-button" onClick={onOpenImport}><Upload size={15} />本地导入剧本</button><input ref={importInputRef} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" aria-label="选择本地剧本文件" onChange={onImportFile} /></div><small>先选定场景和角色，再生成待确认剧本。支持 TXT、Markdown 导入。</small></div>{preview}</div>
}

function CreativeCasesPage({ type, initialRoute = '', incomingContext = null, onIncomingContextConsumed }) {
  const [editor, setEditor] = useState(null)
  const [toolbarTab, setToolbarTab] = useState(0)
  const [brandPrompt, setBrandPrompt] = useState('为叁花茶馆设计一张日光茶饮品牌海报，保留叁花 Logo，突出茶汤与留白。')
  const [brandPlan, setBrandPlan] = useState('')
  const [brandImage, setBrandImage] = useState('')
  const [brandAssets, setBrandAssets] = useState([])
  const [archiveRequest, setArchiveRequest] = useState(null)
  const [brandBusy, setBrandBusy] = useState(false)
  const [brandError, setBrandError] = useState('')
  const [viewerImage, setViewerImage] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [selectedBrandAssetId, setSelectedBrandAssetId] = useState('')
  const [selectedCharacterAsset, setSelectedCharacterAsset] = useState(null)
  const [selectedPropAsset, setSelectedPropAsset] = useState(null)
  const [scriptPrompt, setScriptPrompt] = useState('围绕茶馆真实空间写一个 3 分钟短剧开场：一位年轻掌柜用一杯新茶解决老顾客之间的误会。')
  const [scriptStage, setScriptStage] = useState('definition')
  const [seedancePrompt, setSeedancePrompt] = useState('')
  const [scriptSaveBusy, setScriptSaveBusy] = useState(false)
  const scriptImportInputRef = useRef(null)
  const [scriptPlan, setScriptPlan] = useState('')
  const [scripts, setScripts] = useState([])
  const [scriptRecords, setScriptRecords] = useState([])
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [scriptsError, setScriptsError] = useState('')
  const [videoDuration, setVideoDuration] = useState('180')
  const [videoStatus, setVideoStatus] = useState('')
  const [videoReady, setVideoReady] = useState(false)
  const config = CREATIVE_CASES[type]
  const [activeId, setActiveId] = useState(config.cases[0].id)
  const [contextNotice, setContextNotice] = useState('')
  useEffect(() => {
    const routeIndex = type === 'brand'
      ? { create: 0, library: 1, prompts: 2 }[initialRoute]
      : { create: 0, library: 1, video: 2, versions: 3 }[initialRoute]
    if (Number.isInteger(routeIndex)) setToolbarTab(routeIndex)
  }, [initialRoute, type])
  useEffect(() => {
    if (!incomingContext || incomingContext.target !== type) return
    setToolbarTab(0)
    if (incomingContext.asset?.id) {
      setSelectedAsset(incomingContext.asset)
      if (type === 'script') setContextNotice(`已将「${incomingContext.asset.name || '素材'}」带入短剧创作`)
      if (type === 'brand') setContextNotice(`已将「${incomingContext.asset.name || '素材'}」带入品牌创作`)
    }
    if (type === 'script' && incomingContext.record?.content) {
      setScriptPrompt(incomingContext.record.content)
      setContextNotice(`已载入「${incomingContext.record.title || '短剧文本'}」到脚本编辑区`)
    }
    onIncomingContextConsumed?.()
  }, [incomingContext?.createdAt, incomingContext?.target, type])
  const refreshBrandAssets = async () => {
    if (type !== 'brand') return
    try {
      const response = await fetch('/api/v1/assets?workspace=brand')
      if (!response.ok) return
      const value = await response.json()
      const nextAssets = Array.isArray(value.assets) ? value.assets : []
      setBrandAssets(nextAssets)
      setSelectedBrandAssetId(current => nextAssets.some(asset => asset.id === current) ? current : nextAssets[0]?.id || '')
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
      const recordsResponse = await fetch('/api/v1/text-records?workspace=script&limit=80')
      const recordsValue = await recordsResponse.json()
      if (recordsResponse.ok) setScriptRecords((recordsValue.records || []).filter(record => record.status !== 'deleted'))
    } catch (error) { setScriptsError(error.message || '剧本库读取失败') } finally { setScriptsLoading(false) }
  }
  const scriptPartsFor = script => ({
    script: scriptRecords.find(record => record.scriptId === script.id && record.recordType === 'script'),
    storyboard: scriptRecords.find(record => record.scriptId === script.id && record.recordType === 'storyboard_prompt'),
  })
  useEffect(() => { refreshBrandAssets(); refreshScripts() }, [type])
  const activeScript = scripts.find(item => item.id === activeId)
  const activeCase = config.cases.find(item => item.id === activeId) || config.cases[0]
  const selectedBrandAsset = brandAssets.find(asset => asset.id === selectedBrandAssetId) || brandAssets[0] || null
  const selectedBrandPhase = selectedBrandAsset?.metadata?.brandPhase || ((selectedBrandAsset?.name || '').includes('刀版') ? 'dieline' : 'effect')
  const selectedBrandType = selectedBrandPhase === 'dieline' ? '概念刀版图' : '品牌设计成品'
  const selectedBrandDesign = String(selectedBrandAsset?.promptSummary || selectedBrandAsset?.finalPrompt || selectedBrandAsset?.originalPlan || '选择一个案例后，会在这里显示本次设计的核心内容、参考素材与可继续创作的方向。').replace(/\s+/g, ' ').slice(0, 280)
  const Icon = config.icon
  const requestScript = async (url, options = {}) => {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
    const value = await response.json()
    if (!response.ok) throw new Error(value.error || '剧本保存失败')
    return value
  }
  const archiveText = async input => {
    const response = await fetch('/api/v1/text-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    if (!response.ok) throw new Error('文本归档失败')
    return response.json()
  }
  const persistScript = async values => {
    const sourceAssetIds = [selectedAsset, selectedCharacterAsset, selectedPropAsset].filter(Boolean).map(asset => asset.id)
    const body = JSON.stringify({ ...values, sourceAssetIds })
    const value = editor?.id
      ? await requestScript(`/api/v1/scripts/${editor.id}`, { method: 'PATCH', body })
      : await requestScript('/api/v1/scripts', { method: 'POST', body })
    setScripts(current => [value.script, ...current.filter(item => item.id !== value.script.id)])
    setActiveId(value.script.id)
    setScriptPlan(values.outline)
    await archiveText({ workspace: 'script', sourceModule: 'script.records', recordType: 'script', title: value.script.title || '短剧脚本大纲', content: values.outline || values.content || values.summary, contentFormat: 'markdown', sourceAssetIds, scriptId: value.script.id, scriptVersionId: value.script.currentVersionId })
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
  async function generateBrandImage(requestedName = '', editablePrompt = brandPlan, originalPlan = brandPlan, options = {}) {
    setBrandBusy(true); setBrandError('')
    try {
      const finalPrompt = String(editablePrompt || '').trim()
      if (!finalPrompt) throw new Error('提示词不能为空')
      const phase = options.phase || 'graphic-effect'
      const sourceAsset = options.sourceAsset || selectedAsset
      if (!sourceAsset) throw new Error('请先选择参考图')
      if (phase === 'product-effect' && options.dielineRequired && (!options.dielineConfirmed || !options.dielineImage?.id)) throw new Error('已选择生成新刀版图，请先生成并确认刀版图')
      const referenceAssets = [sourceAsset, options.dielineImage].filter(Boolean)
      const images = await Promise.all(referenceAssets.map(imageAssetToDataUrl))
      const strictReference = '【严格参考图硬约束】第一张参考图是唯一视觉基准，必须还原主体造型、主要构图、关键色彩、品牌/IP/书法/图形特征、装饰元素、氛围和材质观感；不得只做风格参考、不得替换主体、不得重新设计角色或品牌识别元素。'
      const body = { workspace: 'brand', prompt: `${finalPrompt}\n\n${strictReference}`, images, count: 1, size: '1024x1024', title: phase === 'dieline' ? '文创刀版图' : '品牌创作效果图', requestedName, promptSummary: finalPrompt.slice(0, 800), sourceAssetIds: sourceAsset.id ? [sourceAsset.id] : [], referenceAssetIds: referenceAssets.map(asset => asset.id).filter(Boolean), metadata: { originalPlan: String(originalPlan || '').slice(0, 12000), finalPrompt, brandPhase: phase, strictReference: true, dielineRequired: Boolean(options.dielineRequired), dielineConfirmed: Boolean(options.dielineConfirmed), dielineAssetId: options.dielineAssetId || options.dielineImage?.id || '' } }
      const response = await fetch('/api/v1/image-batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '品牌图片生成失败')
      const output = value.assets?.[0]
      if (!output?.url) throw new Error('模型结果未能完成资产归档')
      setBrandImage(output)
      setBrandAssets(current => [output, ...current.filter(asset => asset.id !== output.id)])
      setArchiveRequest(output)
      return output
    } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) }
  }
  const generateScriptPlan = async () => {
    setBrandBusy(true); setBrandError('')
    try {
      const sourceAssets = [selectedAsset, selectedCharacterAsset, selectedPropAsset].filter(Boolean)
      const response = await fetch('/api/v1/agent-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: 'script', requirements: `${scriptPrompt}\n场景素材：${selectedAsset?.name || '茶馆场景待选择'}\n角色素材：${selectedCharacterAsset?.name || '待选择'}\n道具素材：${selectedPropAsset?.name || '待选择'}`, assets: sourceAssets.map(asset => asset.id) }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '编导助手暂不可用')
      const plan = value.plan || ''
      setScriptPlan(plan)
      setScriptStage('confirm-story')
      setContextNotice('剧本规划已生成。请确认剧本与角色设定后，再生成 Seedance 视频提示词。')
    } catch (error) { setBrandError(error.message) } finally { setBrandBusy(false) }
  }
  const appendScriptInspiration = suggestion => setScriptPrompt(current => `${current.trim()}${current.trim() ? '\n' : ''}${suggestion}`)
  const confirmStoryAndCharacter = () => {
    if (!scriptPlan.trim()) { setBrandError('请先生成剧本规划'); return }
    if (!selectedCharacterAsset) { setBrandError('请先选择角色资产，再确认角色设定'); return }
    const scene = selectedAsset?.name || '已确认场景'
    const character = selectedCharacterAsset.name
    const prop = selectedPropAsset?.name || '无指定道具'
    setSeedancePrompt(`【Seedance 2.0 视频提示词】\n9:16 竖屏，8 秒，单镜头连续叙事。\n场景：${scene}；角色：${character}；关键道具：${prop}。\n剧情依据：${scriptPlan.slice(0, 800)}\n镜头：从茶馆空间中景缓慢推进至角色表情与动作，保持角色外观、服装、场景陈设与参考图一致；动作自然，人物数量不新增，不切换地点。\n声音：保留茶馆环境氛围，不生成字幕、乱码、水印或额外文字。\n负面约束：不改变已确认角色身份、脸部、服装、关键道具和空间结构；不使用未引用素材。`)
    setScriptStage('confirm-seedance')
    setBrandError('')
  }
  const saveConfirmedScript = async () => {
    if (!scriptPlan.trim() || !seedancePrompt.trim() || scriptSaveBusy) return
    setScriptSaveBusy(true); setBrandError('')
    try {
      const saved = await persistScript({ title: `${selectedCharacterAsset?.name || '茶馆'}短剧`, kind: '短剧剧本', summary: scriptPrompt.slice(0, 240), outline: scriptPlan, content: scriptPlan })
      const sourceAssetIds = [selectedAsset, selectedCharacterAsset, selectedPropAsset].filter(Boolean).map(asset => asset.id)
      const records = [
        { workspace: 'script', sourceModule: 'script.seedance', recordType: 'storyboard_prompt', title: `${saved.title || '短剧'} · Seedance 分镜提示词`, content: seedancePrompt, contentFormat: 'prompt', sourceAssetIds, scriptId: saved.id, scriptVersionId: saved.currentVersionId },
      ]
      const responses = await Promise.all(records.map(input => fetch('/api/v1/text-records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })))
      if (responses.some(response => !response.ok)) throw new Error('剧本已保存，但文本归档失败，请在文本记录中重试')
      setScriptStage('saved')
      setContextNotice('已保存剧本与 Seedance 分镜提示词。现在可以进入视频生成，并从短剧库添加参考资产。')
    } catch (reason) { setBrandError(reason.message || '保存剧本失败，请重试') } finally { setScriptSaveBusy(false) }
  }
  const importLocalScript = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setBrandError('剧本文件不能超过 2MB'); return }
    if (!/\.(txt|md)$/i.test(file.name) && !['text/plain', 'text/markdown'].includes(file.type)) { setBrandError('仅支持 TXT 或 Markdown 剧本文件'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result || '').trim()
      if (!content) { setBrandError('导入的剧本内容为空'); return }
      setScriptPrompt(content)
      setScriptPlan('')
      setSeedancePrompt('')
      setScriptStage('definition')
      setBrandError('')
      setContextNotice(`已导入「${file.name}」，内容已填入创作需求，可继续生成脚本大纲。`)
    }
    reader.onerror = () => setBrandError('剧本读取失败，请重新选择')
    reader.readAsText(file)
  }
  const startFromBrandCase = () => {
    if (!selectedBrandAsset) return
    setSelectedAsset(selectedBrandAsset)
    setToolbarTab(0)
    setContextNotice(`已选中「${selectedBrandAsset.name || '设计案例'}」。请选择做平面生成海报，或做产品生成效果图。`)
  }

  return (
    <div className="showcase-page">
      <header className="workspace-header">
        <div><span className="breadcrumb">创作工作台 <i>/</i> 案例库</span><h1>{config.title}</h1><p>{config.subtitle}</p></div>
        <button className="primary-button" onClick={() => type === 'script' && setEditor({})}><Sparkles size={16} /> {config.action}</button>
      </header>
      <div className="showcase-layout">
        <main className="showcase-main">
          <div className="showcase-toolbar glass-card"><div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>{(type === 'script' ? ['资产库', '剧本库', '视频生成', '文本记录'] : ['素材创作', '产品库', '提示词记录']).map((label, index) => <button key={label} type="button" className={toolbarTab === index ? 'primary-button' : 'secondary-button'} style={{ whiteSpace: 'nowrap', flexShrink: 0, minHeight: 36, padding: '8px 12px' }} aria-pressed={toolbarTab === index} onClick={() => setToolbarTab(index)}>{index === 0 && <Icon size={17} />}{label}</button>)}</div><small>{config.cases.length} 个项目 · 点击查看详情</small></div>
          {type === 'brand' && toolbarTab === 0 && <><BrandMerchWorkflow assets={CLOUD_ASSETS.filter(asset => asset.category === 'brand')} selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} busy={brandBusy} plan={brandPlan} image={brandImage} error={brandError} onPlan={createBrandPlan} onGenerate={generateBrandImage} onViewImage={setViewerImage} onArchive={setArchiveRequest} />{contextNotice && <p className="retouch-feedback" role="status">{contextNotice}</p>}</>}
          {type === 'script' && toolbarTab === 0 && <div className="brand-agent-card glass-card script-workspace"><div><span className="kicker">编导助手 · 茶馆场景 Skill</span><p>先确定剧本和角色，再确认 Seedance 视频提示词；两次确认后才分别保存剧本与分镜提示词。</p></div>{contextNotice && <p className="retouch-feedback" role="status">{contextNotice}</p>}<ScriptAssetUnitPicker selectedScene={selectedAsset} selectedCharacter={selectedCharacterAsset} selectedProp={selectedPropAsset} onSelectScene={setSelectedAsset} onSelectCharacter={setSelectedCharacterAsset} onSelectProp={setSelectedPropAsset} /><ScriptCreationFlow stage={scriptStage} prompt={scriptPrompt} setPrompt={setScriptPrompt} plan={scriptPlan} setPlan={setScriptPlan} seedancePrompt={seedancePrompt} setSeedancePrompt={setSeedancePrompt} busy={brandBusy} saveBusy={scriptSaveBusy} selectedScene={selectedAsset} selectedCharacter={selectedCharacterAsset} selectedProp={selectedPropAsset} onGenerate={generateScriptPlan} onConfirmStory={confirmStoryAndCharacter} onSave={saveConfirmedScript} onOpenImport={() => scriptImportInputRef.current?.click()} onImportFile={importLocalScript} importInputRef={scriptImportInputRef} onIdea={appendScriptInspiration} onOpenVideo={() => setToolbarTab(2)} />{brandError && <p className="retouch-error" role="alert">{brandError}</p>}</div>}
          {toolbarTab === 0 && <div className="legacy-case-cache" aria-hidden="true">{config.cases.map((item, index) => <span key={item.id}>{item.title}{index === 0 && <span>{item.title}</span>}</span>)}</div>}
          {type === 'script' && toolbarTab === 2 && <VideoWorkbench scripts={scripts} activeId={activeId} scriptPlan={scriptPlan} />}
          {type === 'brand' && toolbarTab === 2 && <PromptRecordPage workspace="brand" title="品牌提示词记录" description="设计计划与最终提示词会自动同步到云端文本库。" filters={[["brand_prompt", "文创提示词"]]} onReuse={record => { setBrandPlan(record.content); setToolbarTab(0) }} />}
          {type === 'script' && toolbarTab === 3 && <PromptRecordPage workspace="script" title="短剧文本记录" description="短剧正文与分镜提示词分开归档。" filters={[["script", "短剧剧本"], ["storyboard_prompt", "分镜提示词"]]} onReuse={record => { setScriptPrompt(record.content); setToolbarTab(0) }} />}
          {type === 'brand' && toolbarTab === 1 ? <section className="product-library-panel glass-card" aria-label="品牌产品库"><h2>品牌成品与设计方案</h2><p className="product-library-hint">单击图片选中案例并查看设计内容；双击可放大预览。</p><div className="product-library-grid">{brandAssets.map(asset => <article className={selectedBrandAsset?.id === asset.id ? 'is-selected' : ''} key={asset.id}><button type="button" className="brand-generated-preview" aria-label={`选择案例 ${asset.name}`} aria-pressed={selectedBrandAsset?.id === asset.id} onClick={() => setSelectedBrandAssetId(asset.id)} onDoubleClick={() => setViewerImage(asset)}><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /><small>{selectedBrandAsset?.id === asset.id ? '已选中 · 双击放大查看' : '点击选中 · 双击放大查看'}</small></button><div><strong>{asset.name}</strong><small>{new Date(asset.createdAt || Date.now()).toLocaleDateString('zh-CN')} · {asset.model || 'gpt-image-2'} · 引用 {asset.referenceAssetIds?.length || asset.sourceAssetIds?.length || 0} 项素材</small><span className="brand-card-actions"><a className="secondary-button" href={`/api/v1/assets/${asset.id}/download`} download={asset.downloadName || asset.name}><Download size={15} />下载</a><button className="secondary-button" aria-label={`重命名 ${asset.name}`} onClick={async () => { const nextName = window.prompt('输入新的图片名称', asset.name); if (!nextName?.trim()) return; const response = await fetch(`/api/v1/assets/${asset.id}/name`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: nextName }) }); const value = await response.json(); if (!response.ok) { setBrandError(value.error || '重命名失败'); return }; setBrandAssets(current => current.map(item => item.id === asset.id ? { ...item, ...value.asset } : item)); }}><Pencil size={15} />重命名</button></span></div></article>)}</div>{!brandAssets.length && <p>暂无已归档的品牌成品。确认生成后会自动保存在这里。</p>}</section> : ((type === 'script' && toolbarTab === 1) ? <section className={`case-grid case-grid--${type}`} aria-label={`${config.title}剧本库`}>
            {scriptsLoading && <p role="status">正在读取云端剧本库…</p>}
            {!scriptsLoading && scripts.map(script => { const parts = scriptPartsFor(script); return <article className={activeId === script.id ? 'case-card is-active script-library-card' : 'case-card script-library-card'} key={script.id}><button type="button" className="script-library-card-main" onClick={() => { setActiveId(script.id); setEditor(script) }}><span className="case-copy"><small>云端剧本 · {script.versionCount || 1} 个版本</small><strong>{script.title}</strong><em>{script.summary || '尚未填写故事梗概'}</em><span>{script.kind || '未分类'} · 更新于 {new Date(script.updatedAt).toLocaleDateString('zh-CN')}</span></span></button><div className="script-library-parts"><button type="button" onClick={() => { setActiveId(script.id); setEditor(script) }}><b>剧本</b><small>{parts.script ? '已保存' : '待归档'}</small></button><button type="button" onClick={() => { const record = parts.storyboard; if (record) { setSeedancePrompt(record.content); setToolbarTab(0); setScriptStage('confirm-seedance') } }} disabled={!parts.storyboard}><b>分镜提示词</b><small>{parts.storyboard ? '已保存' : '待生成'}</small></button></div></article> })}
            {!scriptsLoading && !scripts.length && <div className="empty-state"><p>暂无云端剧本。新建后会自动持久化并支持版本恢复。</p><button className="primary-button" onClick={() => setEditor({})}>新建剧本</button></div>}
            {scriptsError && <p className="retouch-error" role="alert">{scriptsError}</p>}
          </section> : null)}
        </main>
        {((type === 'brand' && toolbarTab === 1) || (type === 'script' && toolbarTab === 1)) && <aside className="case-inspector glass-card">
          <span className="case-inspector-icon"><Icon size={20} /></span>
          <span className="kicker">{type === 'script' ? 'CLOUD SCRIPT' : 'SELECTED CASE'}</span>
          <h2>{type === 'brand' ? selectedBrandAsset?.name || '选择一个设计案例' : activeScript?.title || activeCase.title}</h2>
          <p className={type === 'brand' ? 'case-design-summary' : ''}>{type === 'brand' ? selectedBrandDesign : activeScript?.summary || activeCase.summary}</p>
          <div className="case-facts">{type === 'brand' ? <><span><small>设计类型</small><strong>{selectedBrandType}</strong></span><span><small>参考素材</small><strong>{selectedBrandAsset?.referenceAssetIds?.length || selectedBrandAsset?.sourceAssetIds?.length || 0} 项</strong></span><span><small>后续创作</small><strong>海报 / 效果图</strong></span></> : <><span><small>类型</small><strong>{activeScript?.kind || activeCase.kind}</strong></span><span><small>版本</small><strong>v{activeScript?.versionCount || 1}</strong></span><span><small>状态</small><strong>{activeScript?.status || activeCase.status}</strong></span></>}</div>
          <button className="primary-button primary-button--wide" disabled={type === 'brand' && !selectedBrandAsset} onClick={() => type === 'brand' ? startFromBrandCase() : setEditor(activeScript || { title: activeCase.title, kind: activeCase.kind, summary: activeCase.summary })}>{type === 'brand' ? '以此案例开始' : activeScript ? '编辑云端剧本' : '以此案例开始'} <ArrowUpRight size={16} /></button>
        </aside>}
      </div>
      {editor && <ScriptEditor initial={editor} onClose={() => setEditor(null)} onSave={persistScript} onAutoSave={autoSaveScript} onListVersions={async id => (await requestScript(`/api/v1/scripts/${id}/versions`)).versions || []} onSaveVersion={async (values, changeNote) => { const result = await requestScript(`/api/v1/scripts/${editor.id}/versions`, { method: 'POST', body: JSON.stringify({ ...values, changeNote }) }); setScripts(current => [result.script, ...current.filter(item => item.id !== result.script.id)]); void archiveText({ workspace: 'script', sourceModule: 'script.records', recordType: 'script', title: result.version.title || '短剧剧本版本', content: result.version.outline || result.version.content || result.version.summary, contentFormat: 'markdown', scriptId: result.script.id, scriptVersionId: result.version.id }); return result }} onRestoreVersion={async versionId => { const result = await requestScript(`/api/v1/scripts/${editor.id}/restore-version`, { method: 'POST', body: JSON.stringify({ versionId }) }); setScripts(current => [result.script, ...current.filter(item => item.id !== result.script.id)]); setEditor(result.script); return result.script }} />}
      {archiveRequest && <GeneratedArchiveDialog asset={archiveRequest} onClose={() => setArchiveRequest(null)} onArchived={(asset, message) => { setBrandImage(asset); setBrandAssets(current => [asset, ...current.filter(item => item.id !== asset.id)]); setContextNotice(message); setArchiveRequest(null) }} />}
      {viewerImage && <ImageViewer src={typeof viewerImage === 'string' ? viewerImage : viewerImage.url} alt={typeof viewerImage === 'string' ? '中式文创效果图' : viewerImage.name} downloadUrl={typeof viewerImage === 'string' ? viewerImage : `/api/v1/assets/${viewerImage.id}/download`} downloadName={typeof viewerImage === 'string' ? undefined : viewerImage.downloadName || viewerImage.name} onClose={() => setViewerImage('')} />}
    </div>
  )
}

const ASSET_LIBRARY_UI = [
  { key: 'retouch', label: '精修图库', folders: [['source', '原图'], ['template', '模板'], ['effect', '效果图']] },
  { key: 'brand', label: '茶馆文创库', folders: [['illustration', '插画资产'], ['product-effect', '产品效果'], ['graphic-effect', '平面效果']] },
  { key: 'script', label: '短剧库', folders: [['scene', '场景资产'], ['character', '人物资产'], ['prop', '道具资产']] },
  { key: 'text', label: '文本库', folders: [['retouch-prompt', '精修提示词'], ['brand-prompt', '文创提示词'], ['script', '短剧剧本'], ['storyboard-prompt', '分镜提示词']] },
]

function AssetUploadDialog({ library, folder, onClose, onSaved }) {
  const [files, setFiles] = useState([]); const [previews, setPreviews] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [progress, setProgress] = useState('')
  const choose = event => {
    const next = Array.from(event.target.files || [])
    if (!next.length) return
    const invalid = next.find(file => !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024)
    if (invalid) { setError('仅支持 20MB 以内的 PNG、JPG、WebP 图片'); return }
    setFiles(next); setPreviews(next.map(file => URL.createObjectURL(file))); setError(''); setProgress('')
  }
  const submit = async () => {
    if (!files.length || busy) return
    setBusy(true); setError('')
    const uploaded = []; const failed = []
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`正在上传 ${index + 1}/${files.length}：${file.name}`)
        try {
          const body = new FormData(); body.append('file', file); body.append('libraryKey', library.key); body.append('folderKey', folder.key); body.append('name', file.name.replace(/\.[^.]+$/, '')); body.append('visibility', 'project'); body.append('uploadId', `${Date.now()}-${index}-${file.name}-${file.size}`)
          const response = await fetch('/api/v1/assets/upload', { method: 'POST', body }); const value = await response.json()
          if (!response.ok || !value.asset) throw new Error(value.error || '上传失败')
          uploaded.push(value.asset)
        } catch (reason) { failed.push(`${file.name}${reason.message ? `（${reason.message}）` : ''}`) }
      }
      if (uploaded.length) onSaved(uploaded, `已保存 ${uploaded.length} 项到：${library.label} / ${folder.label}`)
      if (failed.length) { setFiles(files.filter(file => failed.some(item => item.startsWith(file.name)))); setPreviews([]); setError(`以下图片未上传成功：${failed.join('、')}。可再次确认上传。`); setProgress(''); return }
      onClose()
    } catch (reason) { setError(reason.message || '上传失败，可重试') } finally { setBusy(false) }
  }
  return <div className="asset-picker-modal" role="presentation"><section className="asset-picker-dialog asset-upload-dialog" role="dialog" aria-modal="true" aria-label={`上传到${library.label}${folder.label}`}><header className="asset-picker-heading"><div><strong>批量上传资产</strong><small>目标位置：{library.label} / {folder.label}</small></div><button type="button" className="icon-button" aria-label="关闭上传" onClick={onClose}><X size={18} /></button></header><label className="asset-upload-dropzone"><input type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="选择上传图片" onChange={choose} />{previews.length ? <div className="asset-upload-preview-grid">{previews.slice(0, 12).map((preview, index) => <img key={`${preview}-${index}`} src={preview} alt={`${files[index]?.name || '上传图片'}预览`} />)}{previews.length > 12 && <b>另有 {previews.length - 12} 张</b>}</div> : <><Upload size={24} /><b>选择一张或多张 PNG、JPG 或 WebP 图片</b><small>单文件不超过 20MB</small></>}</label>{files.length > 0 && <div className="asset-upload-details"><strong>已选择 {files.length} 张图片</strong>{files.slice(0, 6).map(file => <span key={`${file.name}-${file.size}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>)}{files.length > 6 && <span>另有 {files.length - 6} 张图片</span>}</div>}{progress && <p className="record-notice" role="status">{progress}</p>}{error && <p className="retouch-error" role="alert">{error}</p>}<footer className="asset-picker-footer"><span>上传后会真实归档到当前工作区。</span><div><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={!files.length || busy} onClick={submit}>{busy ? '正在上传…' : `确认上传 ${files.length} 张`}</button></div></footer></section></div>
}

function VideoPlayerDialog({ task, onClose }) {
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const downloadUrl = `/api/v1/video-tasks/${encodeURIComponent(task.id)}/download`
  return createPortal(<div className="video-player-modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="video-player-dialog" role="dialog" aria-modal="true" aria-label={`播放视频 镜头 ${task.id.slice(0, 8)}`}><header><div><span className="kicker">VIDEO PREVIEW</span><h2>镜头 {task.id.slice(0, 8)}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭视频播放窗口"><X size={18} /></button></header><video controls autoPlay preload="metadata" src={task.providerVideoUrl}>当前浏览器无法播放此视频。</video><footer><span>{task.durationSeconds || '—'} 秒 · {task.aspectRatio || '—'} · {task.resolution || '—'}</span><a className="secondary-button" href={downloadUrl} download={`短剧视频-${task.id.slice(0, 8)}.mp4`}><Download size={15} />下载视频</a></footer></section></div>, document.body)
}

function VideoLibraryPanel() {
  const [tasks, setTasks] = useState([])
  const [scripts, setScripts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [playingTask, setPlayingTask] = useState(null)
  useEffect(() => {
    let active = true
    const load = () => Promise.all([
      fetch('/api/v1/video-tasks').then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.error || '视频库读取失败'); return value.tasks || [] }),
      fetch('/api/v1/scripts').then(async response => { const value = await response.json(); return response.ok ? value.scripts || [] : [] }),
    ]).then(([nextTasks, nextScripts]) => {
      if (!active) return
      setTasks(nextTasks); setScripts(nextScripts); setError('')
    }).catch(reason => active && setError(reason.message || '视频库读取失败，可重试')).finally(() => active && setLoading(false))
    void load()
    const timer = window.setInterval(load, 8000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const scriptNames = useMemo(() => new Map(scripts.map(script => [script.id, script.title || '未命名剧本'])), [scripts])
  const grouped = useMemo(() => {
    const groups = new Map()
    tasks.forEach(task => {
      const key = task.scriptId || 'unassigned'
      groups.set(key, [...(groups.get(key) || []), task])
    })
    return [...groups.entries()].map(([scriptId, videos]) => ({ scriptId, title: scriptNames.get(scriptId) || (scriptId === 'unassigned' ? '未关联剧本的视频' : '剧本已删除或不可读取'), videos })).sort((a, b) => String(b.videos[0]?.createdAt || '').localeCompare(String(a.videos[0]?.createdAt || '')))
  }, [tasks, scriptNames])
  return <section className="video-library-panel" aria-label="视频库"><div className="showcase-toolbar glass-card asset-toolbar"><div><strong>视频库</strong><span className="video-library-caption">按已保存剧本分批管理视频生成任务与结果。</span></div><span>{tasks.length} 个视频任务</span></div>{error && <p className="retouch-error" role="alert">{error}</p>}{loading ? <div className="asset-skeleton" /> : !grouped.length ? <div className="empty-state"><Film size={28} /><p>暂无视频任务。先在短剧脚本中确认剧本与分镜，再提交视频生成。</p></div> : <div className="video-library-groups">{grouped.map(group => <section className="video-script-group glass-card" key={group.scriptId}><header><div><span className="kicker">SCRIPT BATCH</span><h2>{group.title}</h2></div><span>{group.videos.length} 个视频</span></header><div className="video-library-grid">{group.videos.map(task => <article key={task.id}><div className="video-library-frame">{task.providerVideoUrl ? <video muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true" onPlay={event => event.currentTarget.pause()} src={task.providerVideoUrl}>视频封面</video> : <div className="video-library-pending"><Film size={28} /><strong>{task.status === 'failed' ? '视频生成失败' : '等待视频结果'}</strong><small>{task.stage || '上游服务正在处理，请稍后刷新。'}</small></div>}</div><div><strong>镜头 {task.id.slice(0, 8)}</strong><small>{task.durationSeconds || '—'} 秒 · {task.aspectRatio || '—'} · {task.resolution || '—'}</small><small>{new Date(task.createdAt || Date.now()).toLocaleString('zh-CN')}</small>{task.providerVideoUrl && <div className="video-library-actions"><button className="secondary-button" onClick={() => setPlayingTask(task)}><Film size={15} />打开视频</button><a className="secondary-button" href={`/api/v1/video-tasks/${encodeURIComponent(task.id)}/download`} download={`短剧视频-${task.id.slice(0, 8)}.mp4`}><Download size={15} />下载视频</a></div>}</div></article>)}</div></section>)}</div>}{playingTask && <VideoPlayerDialog task={playingTask} onClose={() => setPlayingTask(null)} />}</section>
}

function GeneratedResultsPanel({ onNavigate }) {
  const [results, setResults] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewerAsset, setViewerAsset] = useState(null)
  const selected = results.find(item => item.id === selectedId) || results[0] || null
  useEffect(() => {
    let alive = true
    fetch('/api/v1/generated-results').then(async response => {
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'AI 成果读取失败')
      if (alive) { setResults(value.results || []); setSelectedId(value.results?.[0]?.id || '') }
    }).catch(reason => alive && setError(reason.message || 'AI 成果读取失败')).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!selected?.id) { setSources([]); return }
    let alive = true
    fetch(`/api/v1/generated-results/${selected.id}`).then(async response => {
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '成果详情读取失败')
      if (alive) setSources(value.sources || [])
    }).catch(reason => alive && setError(reason.message || '成果详情读取失败'))
    return () => { alive = false }
  }, [selected?.id])
  const reuse = asset => onNavigate(asset.assetSpace === 'script' ? 'script' : asset.assetSpace === 'brand' ? 'brand' : 'retouch', undefined, { asset, assetId: asset.id, source: 'generated-results', focusAssistant: true })
  return <section className="generated-results-panel" aria-label="AI 成果中心"><div className="showcase-toolbar glass-card"><div><strong>AI 成果</strong><small>查看生成结果、参考素材与创建记录。</small></div></div>{error && <p className="retouch-error" role="alert">{error}</p>}{loading ? <div className="asset-skeleton" /> : !results.length ? <div className="empty-state"><p>暂无 AI 生成成果。完成精修或品牌创作后，请在保存确认中归档。</p></div> : <div className="generated-results-layout"><div className="generated-result-list">{results.map(asset => <button key={asset.id} className={selected?.id === asset.id ? 'is-selected' : ''} onClick={() => setSelectedId(asset.id)}><CachedImage asset={asset} src={asset.thumbnailUrl || asset.url} alt="" /><span><b>{asset.name}</b><small>{asset.assetSpace === 'brand' ? '品牌创作' : asset.assetSpace === 'script' ? '短剧制作' : '产品精修'} · {new Date(asset.createdAt).toLocaleDateString('zh-CN')}</small></span></button>)}</div>{selected && <article className="generated-result-detail glass-card"><button className="asset-image-button" onDoubleClick={() => setViewerAsset(selected)} aria-label={`双击查看 ${selected.name}`} title="双击放大查看"><CachedImage asset={selected} src={selected.previewUrl || selected.url} alt={selected.name} /></button><div><span className="kicker">GENERATED RESULT</span><h2>{selected.name}</h2><p>{selected.promptSummary || selected.finalPrompt || selected.originalPlan || '该结果未保存生成摘要。'}</p><div className="generated-result-actions"><button className="primary-button" onClick={() => reuse(selected)}>继续创作 <ArrowUpRight size={15} /></button><a className="secondary-button" href={`/api/v1/assets/${selected.id}/download`} download={selected.downloadName || selected.name}><Download size={15} />下载</a></div><h3>参考素材</h3><div className="generated-result-sources">{sources.length ? sources.map(source => <button key={source.id} onDoubleClick={() => setViewerAsset(source)} title="双击放大查看"><CachedImage asset={source} src={source.thumbnailUrl || source.url} alt={source.name} /><span>{source.name}</span></button>) : <p>本次生成没有可读取的参考素材。</p>}</div></div></article>}</div>}{viewerAsset && <ImageViewer src={viewerAsset.previewUrl || viewerAsset.url} alt={viewerAsset.name} downloadUrl={`/api/v1/assets/${viewerAsset.id}/download`} downloadName={viewerAsset.downloadName || viewerAsset.name} onClose={() => setViewerAsset(null)} />}</section>
}

function AssetLibraryPageLegacy({ onNavigate, initialCategory = 'retouch' }) {
  const [libraryKey, setLibraryKey] = useState(initialCategory === 'generated' || initialCategory === 'video-library' || ASSET_LIBRARY_UI.some(library => library.key === initialCategory) ? initialCategory : 'retouch')
  const [folderKey, setFolderKey] = useState('source'); const [libraries, setLibraries] = useState([]); const [assets, setAssets] = useState([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [viewerAsset, setViewerAsset] = useState(null); const [uploadTarget, setUploadTarget] = useState(null); const [page, setPage] = useState(1)
  const activeLibrary = ASSET_LIBRARY_UI.find(library => library.key === libraryKey) || ASSET_LIBRARY_UI[0]
  const activeFolder = activeLibrary.folders.find(folder => folder[0] === folderKey) || activeLibrary.folders[0]
  const folderConfig = libraries.find(library => library.key === libraryKey)?.folders?.find(folder => folder.key === activeFolder[0])
  const loadLibraries = async () => { try { const response = await fetch('/api/v1/libraries?includeLegacy=true'); const value = await response.json(); if (!response.ok) throw new Error(value.error || '资产目录读取失败'); setLibraries(value.libraries || []) } catch (reason) { setError(reason.message || '资产目录读取失败') } }
  const loadAssets = async () => { if (libraryKey === 'text' || libraryKey === 'generated' || libraryKey === 'video-library') { setLoading(false); return } setLoading(true); setError(''); try { const params = new URLSearchParams({ libraryKey, folderKey: activeFolder[0], page: String(page), pageSize: '18', includeLegacy: 'true' }); if (query.trim()) params.set('q', query.trim()); const response = await fetch(`/api/v1/assets?${params}`); const value = await response.json(); if (!response.ok) throw new Error(value.error || '资产读取失败'); setAssets(value.assets || []) } catch (reason) { setAssets([]); setError(reason.message || '资产读取失败，可重试') } finally { setLoading(false) } }
  useEffect(() => { const next = ASSET_LIBRARY_UI.find(library => library.key === initialCategory); setLibraryKey(initialCategory === 'generated' || initialCategory === 'video-library' ? initialCategory : (next || ASSET_LIBRARY_UI[0]).key); setFolderKey((next || ASSET_LIBRARY_UI[0]).folders[0][0]); setPage(1) }, [initialCategory])
  useEffect(() => { void loadLibraries() }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void loadAssets() }, query ? 250 : 0); return () => window.clearTimeout(timer) }, [libraryKey, folderKey, page, query])
  const saveTemplate = async asset => { setNotice(''); setError(''); try { const response = await fetch(`/api/v1/assets/${asset.id}/save-as-template`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${asset.name}-模板` }) }); const value = await response.json(); if (!response.ok) throw new Error(value.error || '保存模板失败'); setNotice(`已保存到：精修图库 / 模板${value.idempotent ? '（已存在）' : ''}`); void loadLibraries() } catch (reason) { setError(reason.message || '保存模板失败，可重试') } }
  const reuse = asset => onNavigate(libraryKey === 'script' ? 'script' : libraryKey === 'brand' ? 'brand' : 'retouch', undefined, { asset, assetId: asset.id, source: 'asset-library', focusAssistant: true })
  const textRecordType = { 'retouch-prompt': 'retouch_prompt', 'brand-prompt': 'brand_prompt', script: 'script', 'storyboard-prompt': 'storyboard_prompt' }[activeFolder[0]]
  return <div className="page-content asset-library-page"><header className="workspace-header"><div><span className="breadcrumb">创作工作台 / 云端资产</span><h1>资产库</h1><p>按固定业务库与文件夹管理真实归档资产。</p></div><span className="connection-note">当前工作区</span></header><div className="asset-library-layout"><aside className="asset-folder-nav glass-card" aria-label="资产库目录">{ASSET_LIBRARY_UI.map(library => <section key={library.key}><button className={libraryKey === library.key ? 'is-selected' : ''} onClick={() => { setLibraryKey(library.key); setFolderKey(library.folders[0][0]); setPage(1) }}><FolderOpen size={16} />{library.label}</button><div>{library.folders.map(([key, label]) => <button key={key} className={libraryKey === library.key && activeFolder[0] === key ? 'is-selected' : ''} onClick={() => { setLibraryKey(library.key); setFolderKey(key); setPage(1) }}><span>{label}</span><small>{libraries.find(item => item.key === library.key)?.folders?.find(folder => folder.key === key)?.count ?? '—'}</small></button>)}</div></section>)}<section><button className={libraryKey === 'generated' ? 'is-selected' : ''} onClick={() => { setLibraryKey('generated'); setPage(1) }}><Sparkles size={16} />AI 成果</button></section></aside><main>{libraryKey === 'text' ? <PromptRecordPage workspace="" title={`文本库 / ${activeFolder[1]}`} description="提示词、剧本与分镜按业务类型分开归档，可直接复用。" filters={[[textRecordType, activeFolder[1]]]} initialFilter={textRecordType} onReuse={record => onNavigate(record.workspace === 'brand' ? 'brand' : record.workspace === 'retouch' ? 'retouch' : 'script', undefined, { record, source: 'text-library', focusAssistant: true })} /> : libraryKey === 'generated' ? <GeneratedResultsPanel onNavigate={onNavigate} /> : <><div className="showcase-toolbar glass-card asset-toolbar"><div><strong>{activeLibrary.label} / {activeFolder[1]}</strong>{folderConfig?.uploadEnabled && <button className="primary-button" onClick={() => setUploadTarget({ library: activeLibrary, folder: { key: activeFolder[0], label: activeFolder[1] } })}><Upload size={15} />上传资产</button>}</div><label className="asset-search"><span className="sr-only">搜索资产</span><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="搜索名称、来源或创建人" aria-label="搜索资产" /></label></div>{notice && <p className="record-notice" role="status">{notice}</p>}{error && <p className="retouch-error" role="alert">{error}<button className="text-button" onClick={() => void loadAssets()}>重试</button></p>}<section className="asset-grid asset-grid--folders" aria-label={`${activeLibrary.label}${activeFolder[1]}列表`}>{loading && Array.from({ length: 6 }, (_, index) => <div className="asset-skeleton" key={index} />)}{!loading && assets.map(asset => <article className="asset-card glass-card" key={asset.id}><button className="asset-image-button" onClick={() => setViewerAsset(asset)} aria-label={`查看 ${asset.name}`} title="查看图片"><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /></button><div><span><strong>{asset.name}</strong><small>{activeFolder[1]} · {asset.sourceModule || asset.createdBy || '云端资产'}</small></span><span className="asset-card-actions"><a className="secondary-button" href={`/api/v1/assets/${asset.id}/download`} download={asset.downloadName || asset.name} aria-label={`下载 ${asset.name}`}><Download size={15} /></a>{libraryKey === 'retouch' && activeFolder[0] === 'effect' && <button className="secondary-button" onClick={() => void saveTemplate(asset)}>保存为模板</button>}<button className="secondary-button" onClick={() => reuse(asset)}>{libraryKey === 'script' ? '用于短剧' : libraryKey === 'brand' ? '用于创作' : '用于精修'}</button></span></div></article>)}</section>{!loading && !assets.length && <div className="empty-state"><p>{folderConfig?.uploadEnabled ? `暂无${activeFolder[1]}，可从本地上传真实图片资产。` : `暂无${activeFolder[1]}，完成对应生成后会在保存确认中归档到这里。`}</p>{folderConfig?.uploadEnabled && <button className="primary-button" onClick={() => setUploadTarget({ library: activeLibrary, folder: { key: activeFolder[0], label: activeFolder[1] } })}>上传资产</button>}</div>}<nav className="asset-pagination" aria-label="资产库分页"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={16} />上一页</button><span>第 {page} 页</span><button className="secondary-button" disabled={assets.length < 18} onClick={() => setPage(current => current + 1)}>下一页<ChevronRight size={16} /></button></nav></>}</main></div>{uploadTarget && <AssetUploadDialog library={uploadTarget.library} folder={uploadTarget.folder} onClose={() => setUploadTarget(null)} onSaved={(asset, message) => { setNotice(message); setUploadTarget(null); void loadLibraries(); void loadAssets(); setViewerAsset(asset) }} />}{viewerAsset && <ImageViewer src={viewerAsset.previewUrl || viewerAsset.url} alt={viewerAsset.name} downloadUrl={`/api/v1/assets/${viewerAsset.id}/download`} downloadName={viewerAsset.downloadName || viewerAsset.name} onClose={() => setViewerAsset(null)} />}</div>
}

function AssetLibraryPage({ onNavigate, initialCategory = 'retouch' }) {
  const isSpecial = initialCategory === 'generated' || initialCategory === 'video-library'
  const [libraryKey, setLibraryKey] = useState(isSpecial || ASSET_LIBRARY_UI.some(library => library.key === initialCategory) ? initialCategory : 'retouch')
  const [folderKey, setFolderKey] = useState('source')
  const [libraries, setLibraries] = useState([])
  const [assets, setAssets] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewerAsset, setViewerAsset] = useState(null)
  const [uploadTarget, setUploadTarget] = useState(null)
  const [page, setPage] = useState(1)
  const activeLibrary = ASSET_LIBRARY_UI.find(library => library.key === libraryKey) || ASSET_LIBRARY_UI[0]
  const activeFolder = activeLibrary.folders.find(folder => folder[0] === folderKey) || activeLibrary.folders[0]
  const folderConfig = libraries.find(library => library.key === libraryKey)?.folders?.find(folder => folder.key === activeFolder[0])
  const textRecordType = { 'retouch-prompt': 'retouch_prompt', 'brand-prompt': 'brand_prompt', script: 'script', 'storyboard-prompt': 'storyboard_prompt' }[activeFolder[0]]
  const selectLibrary = (key, folder = null) => {
    const library = ASSET_LIBRARY_UI.find(item => item.key === key)
    setLibraryKey(key); setFolderKey(folder || library?.folders?.[0]?.[0] || 'source'); setPage(1); setQuery(''); setError('')
  }
  const loadLibraries = async () => {
    try {
      const response = await fetch('/api/v1/libraries?includeLegacy=true')
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '资产目录读取失败')
      setLibraries(value.libraries || [])
    } catch (reason) { setError(reason.message || '资产目录读取失败') }
  }
  const loadAssets = async () => {
    if (libraryKey === 'text' || libraryKey === 'generated' || libraryKey === 'video-library') { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ libraryKey, folderKey: activeFolder[0], page: String(page), pageSize: '18', includeLegacy: 'true' })
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/v1/assets?${params}`)
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '资产读取失败')
      setAssets(value.assets || [])
    } catch (reason) { setAssets([]); setError(reason.message || '资产读取失败，可重试') } finally { setLoading(false) }
  }
  useEffect(() => {
    const next = ASSET_LIBRARY_UI.find(library => library.key === initialCategory)
    setLibraryKey(initialCategory === 'generated' || initialCategory === 'video-library' ? initialCategory : (next || ASSET_LIBRARY_UI[0]).key)
    setFolderKey((next || ASSET_LIBRARY_UI[0]).folders[0][0]); setPage(1); setQuery('')
  }, [initialCategory])
  useEffect(() => { void loadLibraries() }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void loadAssets() }, query ? 250 : 0); return () => window.clearTimeout(timer) }, [libraryKey, folderKey, page, query])
  const saveTemplate = async asset => {
    setNotice(''); setError('')
    try {
      const response = await fetch(`/api/v1/assets/${asset.id}/save-as-template`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${asset.name}-模板` }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '保存模板失败')
      setNotice(`已保存到：精修图库 / 模板${value.idempotent ? '（已存在）' : ''}`); void loadLibraries()
    } catch (reason) { setError(reason.message || '保存模板失败，可重试') }
  }
  const reuse = asset => onNavigate(libraryKey === 'script' ? 'script' : libraryKey === 'brand' ? 'brand' : 'retouch', undefined, { asset, assetId: asset.id, source: 'asset-library', focusAssistant: true })
  const renderSidebar = <aside className="asset-folder-nav glass-card" aria-label="资产库目录">
    {ASSET_LIBRARY_UI.map(library => <section key={library.key}><button className={libraryKey === library.key ? 'is-selected' : ''} onClick={() => selectLibrary(library.key)}><FolderOpen size={16} />{library.label}</button><div>{library.folders.map(([key, label]) => <button key={key} className={libraryKey === library.key && activeFolder[0] === key ? 'is-selected' : ''} onClick={() => selectLibrary(library.key, key)}><span>{label}</span><small>{libraries.find(item => item.key === library.key)?.folders?.find(folder => folder.key === key)?.count ?? '—'}</small></button>)}</div></section>)}
    <section><button className={libraryKey === 'video-library' ? 'is-selected' : ''} onClick={() => selectLibrary('video-library')}><Film size={16} />视频库</button></section>
    <section><button className={libraryKey === 'generated' ? 'is-selected' : ''} onClick={() => selectLibrary('generated')}><Sparkles size={16} />AI 成果</button></section>
  </aside>
  const renderAssets = <>
    <div className="showcase-toolbar glass-card asset-toolbar"><div><strong>{activeLibrary.label} / {activeFolder[1]}</strong>{folderConfig?.uploadEnabled && <button className="primary-button" onClick={() => setUploadTarget({ library: activeLibrary, folder: { key: activeFolder[0], label: activeFolder[1] } })}><Upload size={15} />批量上传资产</button>}</div><label className="asset-search"><span className="sr-only">搜索资产</span><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="搜索名称、来源或创建人" aria-label="搜索资产" /></label></div>
    {notice && <p className="record-notice" role="status">{notice}</p>}{error && <p className="retouch-error" role="alert">{error}<button className="text-button" onClick={() => void loadAssets()}>重试</button></p>}
    <section className="asset-grid asset-grid--folders" aria-label={`${activeLibrary.label}${activeFolder[1]}列表`}>
      {loading && Array.from({ length: 6 }, (_, index) => <div className="asset-skeleton" key={index} />)}
      {!loading && assets.map(asset => <article className="asset-card glass-card" key={asset.id}><button className="asset-image-button" onDoubleClick={() => setViewerAsset(asset)} aria-label={`双击查看 ${asset.name}`} title="双击放大查看"><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /></button><div><span><strong>{asset.name}</strong><small>{activeFolder[1]} · {asset.sourceModule || asset.createdBy || '云端资产'}</small></span><span className="asset-card-actions"><a className="secondary-button" href={`/api/v1/assets/${asset.id}/download`} download={asset.downloadName || asset.name} aria-label={`下载 ${asset.name}`}><Download size={15} /></a>{libraryKey === 'retouch' && activeFolder[0] === 'effect' && <button className="secondary-button" onClick={() => void saveTemplate(asset)}>保存为模板</button>}<button className="secondary-button" onClick={() => reuse(asset)}>{libraryKey === 'script' ? '用于短剧' : libraryKey === 'brand' ? '用于创作' : '用于精修'}</button></span></div></article>)}
    </section>
    {!loading && !assets.length && <div className="empty-state"><p>{folderConfig?.uploadEnabled ? `暂无${activeFolder[1]}，可从本地批量上传真实图片资产。` : `暂无${activeFolder[1]}，完成对应生成后会在保存确认中归档到这里。`}</p>{folderConfig?.uploadEnabled && <button className="primary-button" onClick={() => setUploadTarget({ library: activeLibrary, folder: { key: activeFolder[0], label: activeFolder[1] } })}>批量上传资产</button>}</div>}
    <nav className="asset-pagination" aria-label="资产库分页"><button className="secondary-button" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={16} />上一页</button><span>第 {page} 页</span><button className="secondary-button" disabled={assets.length < 18} onClick={() => setPage(current => current + 1)}>下一页<ChevronRight size={16} /></button></nav>
  </>
  return <div className="page-content asset-library-page"><header className="workspace-header"><div><span className="breadcrumb">创作工作台 / 云端资产</span><h1>资产库</h1><p>按固定业务库、剧本批次和文件夹管理真实归档资产。</p></div><span className="connection-note">当前工作区</span></header><div className="asset-library-layout">{renderSidebar}<main>{libraryKey === 'text' ? <PromptRecordPage workspace="" title={`文本库 / ${activeFolder[1]}`} description="提示词、剧本与分镜按业务类型分开归档，可直接复用。" filters={[[textRecordType, activeFolder[1]]]} initialFilter={textRecordType} onReuse={record => onNavigate(record.workspace === 'brand' ? 'brand' : record.workspace === 'retouch' ? 'retouch' : 'script', undefined, { record, source: 'text-library', focusAssistant: true })} /> : libraryKey === 'generated' ? <GeneratedResultsPanel onNavigate={onNavigate} /> : libraryKey === 'video-library' ? <VideoLibraryPanel /> : renderAssets}</main></div>{uploadTarget && <AssetUploadDialog library={uploadTarget.library} folder={uploadTarget.folder} onClose={() => setUploadTarget(null)} onSaved={(uploaded, message) => { setNotice(message); void loadLibraries(); void loadAssets() }} />}{viewerAsset && <ImageViewer src={viewerAsset.previewUrl || viewerAsset.url} alt={viewerAsset.name} downloadUrl={`/api/v1/assets/${viewerAsset.id}/download`} downloadName={viewerAsset.downloadName || viewerAsset.name} onClose={() => setViewerAsset(null)} />}</div>
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
  const validPreviewPage = ['home', 'retouch', 'brand', 'script', 'assets', 'settings', 'profile'].includes(previewPage) ? previewPage : null
  const [authenticated, setAuthenticated] = useState(initialAuthenticated)
  const [sessionReady, setSessionReady] = useState(initialAuthenticated || demoRetouch)
  const [session, setSession] = useState(null)
  const [page, setPage] = useState(validPreviewPage || initialPage)
  const [subRoute, setSubRoute] = useState(DEFAULT_SUB_ROUTE[validPreviewPage || initialPage] || '')
  const [timeMode, setTimeMode] = useState(previewParams.get('theme') === 'night' ? 'night' : 'day')
  const [retouchContext, setRetouchContext] = useState(null)
  const [creationContext, setCreationContext] = useState(null)

  useEffect(() => {
    if (initialAuthenticated || demoRetouch) return
    let active = true
    fetch('/api/v1/session').then(async response => ({ ok: response.ok, value: await response.json().catch(() => ({})) })).then(result => {
      if (!active) return
      if (result.ok) { setSession(result.value); setAuthenticated(true) }
    }).catch(() => {}).finally(() => { if (active) setSessionReady(true) })
    return () => { active = false }
  }, [initialAuthenticated, demoRetouch])

  if (!sessionReady) return <main className="login-page"><p className="session-loading">正在恢复安全会话…</p></main>
  if (!authenticated) return <Login previewOnly={demoRetouch} onLogin={value => { setSession(value); setAuthenticated(true) }} />

  const navigate = (nextPage, nextSubRoute = DEFAULT_SUB_ROUTE[nextPage] || '', context = null) => {
    const route = nextPage === 'retouch' && nextSubRoute === 'assistant' ? 'one-click' : nextSubRoute
    setPage(nextPage); setSubRoute(route)
    if (context?.assetId && nextPage === 'retouch') setRetouchContext({ ...context, subRoute: 'one-click', createdAt: new Date().toISOString() })
    if (context && ['brand', 'script'].includes(nextPage)) setCreationContext({ ...context, target: nextPage, createdAt: context.createdAt || new Date().toISOString() })
  }
  return (
    <div className={`app-shell time-${timeMode}`}>
      <Sidebar page={page} subRoute={subRoute} onNavigate={navigate} />
      <div className="app-main">
        <Topbar timeMode={timeMode} session={session} onOpenProfile={() => navigate('profile')} onSwitchWorkspace={async workspaceId => { const response = await fetch(`/api/v1/workspaces/${workspaceId}/switch`, { method: 'POST' }); if (response.ok) { const refreshed = await fetch('/api/v1/session'); if (refreshed.ok) setSession(await refreshed.json()) } }} onToggleTimeMode={() => setTimeMode(mode => mode === 'day' ? 'night' : 'day')} onLogout={() => { fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {}); setSession(null); setAuthenticated(false); navigate('home') }} />
        <div className="page-transition" key={page}>
          {page === 'home' && <HomePage onNavigate={navigate} />}
          {page === 'retouch' && (subRoute === 'tasks' ? <PromptRecordPage workspace="retouch" title="产品精修记录" description="精修计划、最终提示词与关联生成结果会自动存入云端。" filters={[["retouch_prompt", "精修提示词"]]} /> : demoRetouch ? <RetouchPage /> : <LiveRetouch initialTab={subRoute === 'gallery' ? 'gallery' : 'one-click'} focusAssistant={subRoute === 'assistant' || Boolean(retouchContext?.focusAssistant)} incomingAsset={retouchContext?.asset} onIncomingAssetConsumed={() => setRetouchContext(null)} />)}
          {page === 'brand' && <CreativeCasesPage type="brand" initialRoute={subRoute} incomingContext={creationContext} onIncomingContextConsumed={() => setCreationContext(null)} />}
          {page === 'script' && <CreativeCasesPage type="script" initialRoute={subRoute} incomingContext={creationContext} onIncomingContextConsumed={() => setCreationContext(null)} />}
          {page === 'assets' && <AssetLibraryPage onNavigate={navigate} initialCategory={subRoute} />}
          {page === 'settings' && <ApiSettings />}
          {page === 'profile' && <UserProfile session={session} onSessionChange={setSession} />}
        </div>
      </div>
      <TaskProgress />
    </div>
  )
}
