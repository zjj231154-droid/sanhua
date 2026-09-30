import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { BrandMerchWorkflow, TaskProgress, WorkflowStepper } from './App'

afterEach(() => vi.unstubAllGlobals())

describe('AI 创作工作台 Demo', () => {
  it('登录与注册统一使用用户名，注册要求席位邀请码', () => {
    render(<App demoRetouch />)
    expect(screen.getByRole('textbox', { name: '用户名' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }))
    expect(screen.getByRole('textbox', { name: '席位邀请码' })).toBeRequired()
    expect(screen.getByRole('textbox', { name: '用户名' })).toBeRequired()
    expect(screen.queryByLabelText('登录邮箱')).not.toBeInTheDocument()
  })

  it('owner 可进入成员席位后台并看到十个席位', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (url === '/api/v1/session') return { ok: true, json: async () => ({ user: { id: 'owner', username: 'admin', name: '管理员' }, workspace: { id: 'main', name: '主工作区', role: 'owner', permissions: ['view', 'use', 'edit', 'manage'] } }) }
      if (url === '/api/v1/admin/seats') return { ok: true, json: async () => ({ enterprise: { workspaceId: 'main', seatCount: 10 }, seats: Array.from({ length: 10 }, (_, index) => ({ seatId: `S${String(index + 1).padStart(2, '0')}`, status: index === 0 ? 'occupied' : 'available', role: index === 0 ? 'owner' : 'editor', user: index === 0 ? { name: '管理员', username: 'admin' } : null })) }) }
      return { ok: true, json: async () => ({}) }
    }))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '成员席位' }))
    expect(await screen.findByRole('heading', { name: '成员与邀请码' })).toBeInTheDocument()
    expect(screen.getAllByText(/^席位 \d{2}$/)).toHaveLength(10)
  })

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

  it('产品库可选中案例、展示设计摘要并带入品牌二创', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (url === '/api/v1/assets?workspace=brand') return { ok: true, json: async () => ({ assets: [
        { id: 'brand-a', name: '礼盒包装方案 A', url: 'data:image/png;base64,iVBORw0KGgo=', promptSummary: '红金茶礼盒：保留书法标题与人物插画，作为包装效果图。', sourceAssetIds: ['source-a'] },
        { id: 'brand-b', name: '礼盒包装方案 B', url: 'data:image/png;base64,iVBORw0KGgo=', promptSummary: '水墨茶山海报：保留茶器、留白与品牌印章，延展系列视觉。', referenceAssetIds: ['source-b'] },
      ] }) }
      return { ok: true, json: async () => ({ assets: [] }) }
    }))
    const { container } = render(<App initialAuthenticated initialPage="brand" />)

    fireEvent.click(within(container.querySelector('.showcase-toolbar')).getByRole('button', { name: '产品库' }))
    const caseButton = await screen.findByRole('button', { name: '选择案例 礼盒包装方案 B' })
    fireEvent.click(caseButton)
    expect(caseButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('水墨茶山海报：保留茶器、留白与品牌印章，延展系列视觉。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '以此案例开始' }))
    expect(screen.getByRole('status')).toHaveTextContent('已选中「礼盒包装方案 B」')
    fireEvent.click(screen.getByRole('button', { name: '选择做平面工作流' }))
    expect(screen.getByText('已选择参考素材：礼盒包装方案 B。会作为唯一视觉基准写入提示词。')).toBeInTheDocument()
  })

  it('右上角退出按钮可以返回登录页', () => {
    render(<App initialAuthenticated />)

    expect(screen.getByLabelText('当前设计师')).toHaveTextContent('林设计')
    fireEvent.click(screen.getByRole('button', { name: '退出演示账号' }))
    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()
  })

  it('右上角用户入口只展示账户资料，管理设置只展示模型 Key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ connection: null }) })))
    render(<App initialAuthenticated />)

    fireEvent.click(screen.getByLabelText('当前设计师'))
    expect(screen.getByRole('heading', { name: '个人资料' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '账户资料' })).toBeInTheDocument()
    expect(screen.getByLabelText('当前密码')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '管理设置' }))
    expect(await screen.findByRole('heading', { name: '模型 Key 设置' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '账户资料' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '推理模型' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '生图模型' })).toBeInTheDocument()
  })

  it('资产库展示已归档的 AI 创作成果', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).startsWith('/api/v1/libraries')) return { ok: true, json: async () => ({ libraries: [] }) }
      if (url === '/api/v1/generated-results') return { ok: true, json: async () => ({ results: [{ id: 'remote-retouch-1', name: '已归档精修结果', assetSpace: 'retouch', url: '/api/assets/generated/remote-retouch-1.png', createdAt: '2026-09-01T00:00:00.000Z' }] }) }
      if (url === '/api/v1/generated-results/remote-retouch-1') return { ok: true, json: async () => ({ result: {}, sources: [] }) }
      return { ok: true, json: async () => ({ tasks: [] }) }
    }))
    render(<App initialAuthenticated initialPage="assets" />)

    fireEvent.click(screen.getAllByRole('button', { name: 'AI 成果' })[0])
    await waitFor(() => expect(screen.getAllByText('已归档精修结果').length).toBeGreaterThan(0))
  })

  it('视频库按关联剧本分批展示视频任务', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).startsWith('/api/v1/libraries')) return { ok: true, json: async () => ({ libraries: [] }) }
      if (url === '/api/v1/video-tasks') return { ok: true, json: async () => ({ tasks: [
        { id: 'video-task-1', scriptId: 'script-a', status: 'completed', stage: '视频已生成', durationSeconds: 8, aspectRatio: '9:16', resolution: '720p', providerVideoUrl: 'https://cdn.example.test/video-1.mp4', createdAt: '2026-09-29T00:00:00.000Z' },
        { id: 'video-task-2', scriptId: 'script-b', status: 'running', stage: '正在生成', durationSeconds: 10, aspectRatio: '16:9', resolution: '1080p', createdAt: '2026-09-28T00:00:00.000Z' },
      ] }) }
      if (url === '/api/v1/scripts') return { ok: true, json: async () => ({ scripts: [{ id: 'script-a', title: '茶馆的第一杯茶' }, { id: 'script-b', title: '雨夜来客' }] }) }
      return { ok: true, json: async () => ({ assets: [] }) }
    }))
    render(<App initialAuthenticated initialPage="assets" />)

    fireEvent.click(within(document.querySelector('.asset-folder-nav')).getByRole('button', { name: '视频库' }))
    expect(await screen.findByRole('heading', { name: '茶馆的第一杯茶' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '雨夜来客' })).toBeInTheDocument()
    expect(screen.getByText('等待视频结果')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '下载视频' })).toHaveAttribute('href', '/api/v1/video-tasks/video-task-1/download')
    fireEvent.click(screen.getByRole('button', { name: '打开视频' }))
    expect(await screen.findByRole('dialog', { name: '播放视频 镜头 video-ta' })).toBeInTheDocument()
  })

  it('资产库顶部图片筛选不显示文本按钮', () => {
    const { container } = render(<App initialAuthenticated initialPage="assets" />)
    const toolbar = within(container.querySelector('.asset-toolbar'))
    expect(toolbar.queryByRole('button', { name: '文本' })).not.toBeInTheDocument()
  })

  it('资产库不再提供音频分类，已归档图片双击打开查看器', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).startsWith('/api/v1/libraries')) return { ok: true, json: async () => ({ libraries: [] }) }
      if (String(url).startsWith('/api/v1/assets?')) return { ok: true, json: async () => ({ assets: [{ id: 'scene-1', name: '茶馆场景 1', url: '/scene-1.png', previewUrl: '/scene-1.png' }] }) }
      return { ok: true, json: async () => ({}) }
    }))
    render(<App initialAuthenticated initialPage="assets" />)

    expect(screen.queryByRole('button', { name: '音频' })).not.toBeInTheDocument()
    const button = await screen.findByRole('button', { name: '双击查看 茶馆场景 1' })
    fireEvent.doubleClick(button)
    const viewer = screen.getByRole('dialog', { name: '图片查看器' })
    expect(viewer).toBeInTheDocument()
    expect(viewer.parentElement).toBe(document.body)
  })

  it('资产库按每页 18 项浏览，并可翻到下一页', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).startsWith('/api/v1/libraries')) return { ok: true, json: async () => ({ libraries: [] }) }
      if (String(url).includes('page=2')) return { ok: true, json: async () => ({ assets: [{ id: 'scene-8', name: '茶馆场景 8', url: '/scene-8.png' }] }) }
      if (String(url).startsWith('/api/v1/assets?')) return { ok: true, json: async () => ({ assets: Array.from({ length: 18 }, (_, index) => ({ id: `asset-${index}`, name: `茶馆资产 ${index}`, url: `/asset-${index}.png` })) }) }
      return { ok: true, json: async () => ({}) }
    }))
    render(<App initialAuthenticated initialPage="assets" />)

    const pagination = await screen.findByRole('navigation', { name: '资产库分页' })
    expect(pagination).toHaveTextContent('第 1 页')
    expect(screen.queryByText('茶馆场景 8')).not.toBeInTheDocument()

    fireEvent.click(within(pagination).getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(pagination).toHaveTextContent('第 2 页'))
    expect(screen.getByText('茶馆场景 8')).toBeInTheDocument()
  })

  it('从资产库用于写剧本时会带入短剧脚本编辑区', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).startsWith('/api/v1/libraries')) return { ok: true, json: async () => ({ libraries: [] }) }
      if (String(url).includes('libraryKey=script')) return { ok: true, json: async () => ({ assets: [{ id: 'scene-1', name: '茶馆场景 1', url: '/scene-1.png' }] }) }
      return { ok: true, json: async () => ({ assets: [], scripts: [] }) }
    }))
    render(<App initialAuthenticated initialPage="assets" />)

    fireEvent.click(screen.getAllByRole('button', { name: '短剧库' })[0])
    const useForScript = await screen.findByRole('button', { name: '用于短剧' })
    const assetName = useForScript.closest('article').querySelector('strong').textContent
    fireEvent.click(useForScript)

    expect(await screen.findByRole('textbox', { name: '短剧脚本需求' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(`已将「${assetName}」带入短剧创作`)
    expect(screen.getByLabelText('短剧实时预览')).toHaveTextContent(assetName)
  })

  it('短剧库的两个新建入口都会回到剧本生成工作界面', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).startsWith('/api/v1/scripts')) return { ok: true, json: async () => ({ scripts: [] }) }
      if (String(url).startsWith('/api/v1/text-records')) return { ok: true, json: async () => ({ records: [] }) }
      return { ok: true, json: async () => ({}) }
    }))
    const { container } = render(<App initialAuthenticated initialPage="script" />)

    fireEvent.click(within(container.querySelector('.showcase-toolbar')).getByRole('button', { name: '剧本库' }))
    const newScriptButton = await screen.findByRole('button', { name: '新建剧本' })
    fireEvent.click(newScriptButton)
    expect(screen.getByRole('textbox', { name: '短剧脚本需求' })).toBeInTheDocument()

    fireEvent.click(within(container.querySelector('.showcase-toolbar')).getByRole('button', { name: '剧本库' }))
    fireEvent.click(screen.getByRole('button', { name: '新建短剧项目' }))
    expect(screen.getByRole('textbox', { name: '短剧脚本需求' })).toBeInTheDocument()
  })

  it('短剧创作将场景、角色和道具分开选择，并弹出对应图片库', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).startsWith('/api/v1/assets?workspace=script&limit=80')) return { ok: true, json: async () => ({ assets: [{ id: 'character-1', name: '年轻掌柜', videoAssetType: 'character', url: '/character.png' }, { id: 'prop-1', name: '紫砂茶壶', videoAssetType: 'prop', url: '/prop.png' }] }) }
      return { ok: true, json: async () => ({ scripts: [] }) }
    }))
    render(<App initialAuthenticated initialPage="script" />)

    expect(screen.getByRole('button', { name: '选择场景资产' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择角色资产' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择道具资产' })).toBeInTheDocument()
    expect(screen.getByLabelText('批量上传场景资产图片')).toBeInTheDocument()
    expect(screen.getByLabelText('批量上传角色资产图片')).toBeInTheDocument()
    expect(screen.getByLabelText('批量上传道具资产图片')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '本地导入剧本' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '选择场景资产' }))
    const sceneLibrary = await screen.findByRole('dialog', { name: '场景资产图片库' })
    fireEvent.click(within(sceneLibrary).getByRole('button', { name: /茶馆场景 1/ }))
    expect(screen.queryByRole('dialog', { name: '场景资产图片库' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择场景资产' })).toHaveTextContent('已选：茶馆场景 1')

    fireEvent.click(screen.getByRole('button', { name: '选择角色资产' }))
    const characterLibrary = await screen.findByRole('dialog', { name: '角色资产图片库' })
    fireEvent.click(within(characterLibrary).getByRole('button', { name: /年轻掌柜/ }))
    expect(screen.getByRole('button', { name: '选择角色资产' })).toHaveTextContent('已选：年轻掌柜')
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

  it('当前板块红点会随左侧功能导航切换', () => {
    const { container } = render(<App initialAuthenticated initialPage="retouch" />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))

    expect(container.querySelector('.nav-dot')?.closest('button')).toHaveTextContent('产品精修')
    fireEvent.click(navigation.getByRole('button', { name: '品牌创作' }))
    expect(container.querySelector('.nav-dot')?.closest('button')).toHaveTextContent('品牌创作')
    expect(screen.getByRole('heading', { name: '品牌创作' })).toBeInTheDocument()
  })

  it('品牌产品以对话单选方式选择并进入材质步骤', () => {
    render(<BrandMerchWorkflow assets={[]} selectedAsset={null} onSelectAsset={vi.fn()} busy={false} plan="" image="" error="" onPlan={vi.fn()} onGenerate={vi.fn()} onViewImage={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '选择做产品工作流' }))
    const product = screen.getByRole('radio', { name: '杯垫' })
    fireEvent.click(product)
    expect(product).toBeChecked()
    expect(screen.getByRole('button', { name: '下一步：选择材质' })).toBeEnabled()
  })

  it('文创本地上传在当前页面弹出资产上传窗口', () => {
    render(<BrandMerchWorkflow assets={[]} selectedAsset={null} onSelectAsset={vi.fn()} busy={false} plan="" image="" error="" onPlan={vi.fn()} onGenerate={vi.fn()} onViewImage={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '选择做产品工作流' }))
    fireEvent.click(screen.getByRole('radio', { name: '杯垫' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步：选择材质' }))
    fireEvent.click(screen.getByRole('radio', { name: /原色纸浆板：/ }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.change(screen.getByRole('textbox', { name: '文创产品尺寸' }), { target: { value: '90 × 90 mm' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '上传图片' }))

    const dialog = screen.getByRole('dialog', { name: '上传到文创创作本地素材' })
    expect(dialog.closest('.asset-picker-modal').parentElement).toBe(document.body)
    expect(screen.getByRole('button', { name: '关闭上传' })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: '选择做产品工作流' }))
    const input = screen.getByRole('textbox', { name: '自定义文创产品类型' })
    fireEvent.change(input, { target: { value: '香牌' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('radio', { name: '香牌' })).toBeChecked()
    expect(screen.getByRole('button', { name: '下一步：选择材质' })).toBeEnabled()
    expect(localStorage.getItem('sanhua-custom-products')).toContain('香牌')
  })

  it('产品效果图必须先生成并确认刀版图', async () => {
    const onPlan = vi.fn()
      .mockResolvedValueOnce('FINAL_DIELINE_PROMPT: 茶猫冰箱贴概念刀版示意')
      .mockResolvedValueOnce('FINAL_IMAGE_PROMPT: 茶猫冰箱贴产品效果图')
    const onGenerate = vi.fn().mockResolvedValue({ id: 'dieline-1', name: '茶猫冰箱贴-刀版图', url: 'data:image/png;base64,iVBORw0KGgo=' })
    const asset = { id: 'tea-cat', name: '茶猫 IP 原图', url: 'data:image/png;base64,iVBORw0KGgo=' }
    render(<BrandMerchWorkflow assets={[asset]} selectedAsset={asset} onSelectAsset={vi.fn()} busy={false} plan="" image="" error="" onPlan={onPlan} onGenerate={onGenerate} onViewImage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '选择做产品工作流' }))
    fireEvent.click(screen.getByRole('radio', { name: '礼盒包装' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步：选择材质' }))
    fireEvent.click(screen.getByRole('radio', { name: /特种纸：适合烫金/ }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('radio', { name: '需要，先生成概念结构图并确认' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.change(screen.getByRole('textbox', { name: '文创产品尺寸' }), { target: { value: '90 × 90 mm' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '生成概念刀版图提示词 →' }))

    await waitFor(() => expect(onPlan).toHaveBeenCalledWith(expect.stringContaining('流程阶段：产品刀版图')))
    expect(screen.getByRole('textbox', { name: '文创刀版图提示词' })).toHaveValue('FINAL_DIELINE_PROMPT: 茶猫冰箱贴概念刀版示意')
    expect(screen.getByRole('textbox', { name: '文创刀版图提示词' }).closest('.brand-workspace-canvas')).toHaveClass('is-dieline-step')
    fireEvent.click(screen.getByRole('button', { name: '生成概念刀版图' }))
    await waitFor(() => expect(onGenerate).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(String), expect.objectContaining({ phase: 'dieline', sourceAsset: asset })))
    expect(screen.getByRole('button', { name: '刀版确认，生成效果图提示词 →' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '刀版确认，生成效果图提示词 →' }))

    await waitFor(() => expect(onPlan).toHaveBeenLastCalledWith(expect.stringContaining('刀版图状态：已生成并经用户确认')))
    expect(screen.getByRole('button', { name: '确认并生成效果图' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '确认并生成效果图' }))
    await waitFor(() => expect(onGenerate).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), expect.any(String), expect.objectContaining({ phase: 'product-effect', dielineConfirmed: true, dielineAssetId: 'dieline-1' })))
  })

  it('平面创作按素材、方向、输出、保留与画幅进入提示词步骤', async () => {
    const onPlan = vi.fn(async () => 'FINAL_IMAGE_PROMPT: 茶猫四季系列')
    const asset = { id: 'tea-cat', name: '茶猫 IP 原图', url: 'data:image/png;base64,iVBORw0KGgo=' }
    render(<BrandMerchWorkflow assets={[asset]} selectedAsset={asset} onSelectAsset={vi.fn()} busy={false} plan="" image="" error="" onPlan={onPlan} onGenerate={vi.fn()} onViewImage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '选择做平面工作流' }))
    expect(screen.getByRole('button', { name: '1 素材' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: '2 二创方向' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '下一步：选择二创方向 →' }))
    fireEvent.click(screen.getByRole('button', { name: '场景延展' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步：选择输出形式 →' }))
    fireEvent.click(screen.getByRole('button', { name: '系列海报' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步：锁定保留元素 →' }))
    fireEvent.change(screen.getByRole('textbox', { name: '平面创作必须保留元素' }), { target: { value: '猫咪主体、竹桌茶具、水墨线稿' } })
    fireEvent.click(screen.getByRole('button', { name: '4:5' }))
    fireEvent.click(screen.getByRole('button', { name: '生成最终提示词 →' }))

    await waitFor(() => expect(onPlan).toHaveBeenCalledWith(expect.stringContaining('创作模式：平面二创')))
    expect(screen.getByRole('textbox', { name: '品牌最终提示词' })).toHaveValue('FINAL_IMAGE_PROMPT: 茶猫四季系列')
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
