# AI 创作工作台 Demo｜技术规范

## 当前交付目标

首个开发切片为 A 层可交互原型，交付演示登录、工作台首页和产品精修“小样确认”核心链路。所有结果均为本地演示，不调用模型、不上传客户文件、不保存真实数据。

## 技术栈

- React 18：界面状态和组件组织。
- Vite 5：本地开发与生产构建。
- Vitest、Testing Library、jsdom：核心用户行为测试。
- Lucide React：统一线性图标。
- 原生 CSS：当前阶段避免引入设计系统和样式运行时。

## 目录结构

```text
.
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.test.jsx
│   ├── setupTests.js
│   └── styles.css
├── DESIGN_GUIDE.md
├── TECH_SPEC.md
└── 创作工作台-Demo需求文档-v0.1.md
```

## 当前状态模型

- `authenticated`：演示登录状态。
- `page`：当前工作区，取值为工作台、产品精修、品牌创作、短剧脚本、素材库。
- `scope`：内容归属筛选，当前演示“全部内容／日咖夜酒”。
- `selected`：产品精修中进入当前处理范围的图片 ID 集合。
- `sampleGenerated`：演示小样是否已生成。
- `compare`：原图与精修结果的对比滑杆位置。

## 后续生产边界

真实试用版将把鉴权、任务、素材、模型调用和版本记录从界面状态中抽离为服务端接口。大文件进入对象存储；图片任务使用异步队列和幂等任务 ID；前端只保存结构化引用和展示状态。

当前不引入 CopilotKit、LangGraph、LiteLLM 或 Dify。等真实主链路和模型厂商确定后，再以最小依赖原则选择所需组件。
