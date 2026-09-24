import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { BrandMerchWorkflow, TaskProgress, WorkflowStepper } from './App'

afterEach(() => vi.unstubAllGlobals())

describe('AI 创作工作台 Demo', () => {
  it('使用演示账号进入工作台并打开产品精修', () => {
    render(<App demoRetouch />)

    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '进入演示工作台' }))

    expect(screen.getByRole('heading', { name: '今天想创作什么？' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /进入产品精修/ }))

    expect(screen.getByRole('heading', { name: '产品精修' })).toBeInTheDocument()
    expect(screen.getByText('先确认小样，再放心批量')).toBeInTheDocument()
  })

  it('选择样片后可生成演示小样', async () => {
    render(<App initialAuthenticated initialPage="retouch" demoRetouch />)

    fireEvent.click(screen.getByRole('checkbox', { name: '选择 冰美式' }))
    fireEvent.click(screen.getByRole('button', { name: '生成小样' }))

    expect(screen.getByRole('button', { name: '正在生成小样…' })).toBeDisabled()
    const comparison = await screen.findByRole('region', { name: '小样比较' }, { timeout: 2000 })
    expect(comparison).toHaveTextContent('小样已生成')
    expect(comparison).toHaveTextContent('演示结果')
  })

  it('可以收起并重新展开精修助手', () => {
    render(<App initialAuthenticated initialPage="retouch" demoRetouch />)

    fireEvent.click(screen.getByRole('button', { name: '收起精修助手' }))
    expect(screen.getByRole('button', { name: '展开精修助手' })).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: '展开精修助手' }))
    expect(screen.getByRole('button', { name: '收起精修助手' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('可以在日咖和夜酒模式之间切换', () => {
    const { container } = render(<App initialAuthenticated />)

    fireEvent.click(screen.getByRole('button', { name: '切换为夜酒模式' }))
    expect(screen.getByText('夜酒空间')).toBeInTheDocument()
    expect(container.querySelector('.app-shell')).toHaveClass('time-night')

    fireEvent.click(screen.getByRole('button', { name: '切换为日咖模式' }))
    expect(screen.getByText('日咖空间')).toBeInTheDocument()
    expect(container.querySelector('.app-shell')).toHaveClass('time-day')
  })

  it('每日爆款视频入口可以打开茶馆短剧案例', () => {
    render(<App initialAuthenticated />)

    fireEvent.click(screen.getByRole('button', { name: '查看每日爆款视频内容' }))
    expect(screen.getByRole('heading', { name: '短剧脚本' })).toBeInTheDocument()
    expect(screen.getAllByText('《00后掌柜整顿老茶馆》')).toHaveLength(2)
  })

  it('品牌创作展示茶文化文创案例', () => {
    render(<App initialAuthenticated />)

    fireEvent.click(screen.getByRole('button', { name: '品牌创作' }))
    expect(screen.getAllByText('茶山云雾香器')).toHaveLength(2)
    expect(screen.getByText('叁花茶文化礼赠')).toBeInTheDocument()
  })

  it('右上角退出按钮可以返回登录页', () => {
    render(<App initialAuthenticated />)

    expect(screen.getByLabelText('当前设计师')).toHaveTextContent('林设计')
    fireEvent.click(screen.getByRole('button', { name: '退出演示账号' }))
    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()
  })

  it('资产库展示已归档的 AI 创作成果', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (url === '/api/v1/assets') return { ok: true, json: async () => ({ assets: [{ id: 'remote-retouch-1', name: '已归档精修结果', assetSpace: 'retouch', url: '/api/assets/generated/remote-retouch-1.png' }] }) }
      return { ok: true, json: async () => ({ tasks: [] }) }
    }))
    const { container } = render(<App initialAuthenticated initialPage="assets" />)

    fireEvent.click(within(container.querySelector('.asset-toolbar')).getByRole('button', { name: 'AI 成果' }))
    await waitFor(() => expect(screen.getByText('已归档精修结果')).toBeInTheDocument())
  })

  it('资产库顶部图片筛选不显示文本按钮', () => {
    const { container } = render(<App initialAuthenticated initialPage="assets" />)
    const toolbar = within(container.querySelector('.asset-toolbar'))
    expect(toolbar.queryByRole('button', { name: '文本' })).not.toBeInTheDocument()
  })

  it('从资产库用于写剧本时会带入短剧脚本编辑区', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ assets: [], scripts: [] }) })))
    render(<App initialAuthenticated initialPage="assets" />)

    fireEvent.click(screen.getByRole('button', { name: '短剧' }))
    const useForScript = screen.getAllByRole('button', { name: '用于写剧本' })[0]
    const assetName = useForScript.closest('article').querySelector('strong').textContent
    fireEvent.click(useForScript)

    expect(await screen.findByRole('textbox', { name: '短剧脚本需求' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(`已将「${assetName}」带入短剧创作`)
    expect(screen.getByLabelText('短剧实时预览')).toHaveTextContent(assetName)
  })

  it('选中产品精修时会展开模块内的二级导航', () => {
    render(<App initialAuthenticated initialPage="retouch" />)

    expect(screen.getByRole('button', { name: '一键修图' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '图库' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '精修助手' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '任务记录' })).toBeInTheDocument()
  })

  it('再次点击当前功能板块会收起，并可再次展开子菜单', () => {
    render(<App initialAuthenticated initialPage="brand" />)
    const brandButton = screen.getByRole('button', { name: '品牌创作' })
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))

    expect(brandButton).toHaveAttribute('aria-expanded', 'true')
    expect(navigation.getByRole('button', { name: '素材创作' })).toBeInTheDocument()
    fireEvent.click(brandButton)
    expect(brandButton).toHaveAttribute('aria-expanded', 'false')
    expect(navigation.queryByRole('button', { name: '素材创作' })).not.toBeInTheDocument()
    fireEvent.click(brandButton)
    expect(brandButton).toHaveAttribute('aria-expanded', 'true')
    expect(navigation.getByRole('button', { name: '素材创作' })).toBeInTheDocument()
  })

  it('品牌产品选择可再次点击取消并清空后续步骤', () => {
    render(<BrandMerchWorkflow assets={[]} selectedAsset={null} onSelectAsset={vi.fn()} busy={false} plan="" image="" error="" onPlan={vi.fn()} onGenerate={vi.fn()} onViewImage={vi.fn()} />)
    const product = screen.getByRole('button', { name: '杯垫' })
    fireEvent.click(product)
    expect(screen.getByText('当前产品：杯垫。下一步会据此更新可量产材质建议。')).toBeInTheDocument()
    fireEvent.click(product)
    expect(screen.queryByText(/当前产品：杯垫/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一步：选择材质' })).toBeDisabled()
  })

  it('五步流程标识当前步骤、完成步骤和未完成步骤', () => {
    const onStep = vi.fn()
    render(<WorkflowStepper steps={['产品', '材质', '尺寸']} activeStep={2} onStep={onStep} />)

    expect(screen.getByRole('button', { name: '2 材质' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: '3 尺寸' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '✓ 产品' }))
    expect(onStep).toHaveBeenCalledWith(1)
  })

  it('自定义产品标签按回车后会立即选中并保存到会话', () => {
    render(<BrandMerchWorkflow assets={[]} selectedAsset={null} onSelectAsset={vi.fn()} busy={false} plan="" image="" error="" onPlan={vi.fn()} onGenerate={vi.fn()} onViewImage={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: '自定义文创产品类型' })
    fireEvent.change(input, { target: { value: '香牌' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('当前产品：香牌。下一步会据此更新可量产材质建议。')).toBeInTheDocument()
    expect(localStorage.getItem('sanhua-custom-products')).toContain('香牌')
  })

  it('任务进度可删除已完成任务而不显示运行中任务的删除按钮', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      if (options?.method === 'DELETE') return { ok: true, json: async () => ({ ok: true }) }
      return { ok: true, json: async () => ({ tasks: [{ id: 'done-task', workspace: 'brand', status: 'completed', progress: 100, stage: '完成' }, { id: 'live-task', workspace: 'retouch', status: 'running', progress: 50, stage: '处理中' }] }) }
    }))
    render(<TaskProgress />)
    fireEvent.click(screen.getByRole('button', { name: '查看后台任务进度' }))
    expect(await screen.findByRole('button', { name: '删除任务 done-tas' })).toBeInTheDocument()
    const popover = document.body.querySelector('.task-progress-popover--portal')
    expect(popover.style.top).toBe('')
    expect(popover.style.bottom).not.toBe('')
    expect(screen.queryByRole('button', { name: '删除任务 live-tas' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '删除任务 done-tas' }))
    await waitFor(() => expect(screen.queryByText('品牌创作')).not.toBeInTheDocument())
  })

  it('任务进度按钮支持拖拽定位，拖拽结束不会误打开面板', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tasks: [] }) })))
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    render(<TaskProgress />)

    const trigger = screen.getByRole('button', { name: '查看后台任务进度' })
    trigger.getBoundingClientRect = () => ({ right: 760, bottom: 570, width: 120, height: 44 })
    fireEvent.mouseDown(trigger, { button: 0, buttons: 1, clientX: 700, clientY: 548 })
    fireEvent.mouseMove(trigger, { buttons: 1, clientX: 600, clientY: 448 })
    fireEvent.mouseUp(trigger, { button: 0, buttons: 0, clientX: 600, clientY: 448 })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger.closest('.task-progress-menu--widget')).toHaveStyle({ right: '140px', bottom: '130px' })
    expect(localStorage.getItem('sanhua-task-progress-position')).toContain('140')
  })
})
