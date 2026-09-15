---
name: short-drama-production
description: 从短剧选题、角色、分集剧本与合规审核，推进到 AIGC 资产、场次、镜头、图片/视频提示词、连续性、选片和交付。适用于新建或继续一个短剧制作项目；普通长片编剧或单条无上下文提示词不应默认触发完整流水线。
---

# 短剧制作工作台

把剧本创作与 AIGC 视频生产视为一条可追踪流水线。先判断用户当前处于哪个阶段，只读取该阶段需要的参考资料；不要一次加载全部资料。

## 开始工作

1. 在当前目录寻找 `.drama-state.json` 与 `00_brief/project.yaml`。存在时恢复进度，不覆盖已确认内容。
2. 判断任务属于：立项、故事规划、角色、分集目录、分集剧本、合规/剧本审查、生产初始化、资产、场次、镜头、提示词、生成记录、连续性、失败诊断或交付。
3. 只在缺少的信息会实质改变结果时提问；否则写明保守假设后继续。
4. 默认只创建本地文档和记录。写提示词不代表获准调用付费模型、上传、发布或部署。

新建生产目录时运行：

```bash
python .agents/skills/short-drama-production/scripts/init_short_drama_project.py --name "项目名" --output /absolute/path/to/project --aspect-ratio 9:16
```

初始化器拒绝覆盖非空目录。项目校验保持只读：

```bash
python .agents/skills/short-drama-production/scripts/validate_project.py /absolute/path/to/project --strict-v2
```

## 统一阶段

### 1. 立项与故事

- `/start`：读取 `references/screenplay/genre-guide.md`，确认题材、受众、基调、结局、集数、语言和国内/海外模式，写入 `.drama-state.json` 与 `00_brief/brief.md`。
- `/plan`：读取 `opening-rules.md`、`paywall-design.md`、`rhythm-curve.md`、`satisfaction-matrix.md`，生成 `01_story/creative-plan.md`。
- `/characters`：读取 `villain-design.md`，生成 `01_story/characters.md`，并同步角色身份、状态与授权到 `02_assets/`。
- `/outline`：读取 `paywall-design.md` 与 `rhythm-curve.md`，生成完整的 `01_story/episode-directory.md`。
- `/episode N`：读取 `opening-rules.md`、`rhythm-curve.md`、`satisfaction-matrix.md`、`hook-design.md`，生成 `01_story/episodes/epNNN.md`。先核对角色与前后集连续性。
- `/review N|all`：按节奏、爽点、台词、格式、连贯性审查，写入 `07_review/screenplay/`。
- `/compliance`：读取 `compliance-checklist.md`，生成 `07_review/compliance-report.md`。

不得虚构市场数据或把付费卡点规则当作所有项目的硬要求；商业模式不适用时按用户目标调整。

### 2. 从剧本转入制作

读取 `references/production/production-workflow.md` 与 `project-schemas.md`。将已确认的故事信息转换为：

- `02_assets/`：角色、场景、道具的稳定 ID、版本、状态和参考图继承范围。
- `03_scenes/`：每场的叙事目标、开闭状态、空间分区和轴线。
- `04_shots/`：镜头目标、时长、动作节拍、机位起止、声音线索、连续性输入输出。

剧本是叙事来源，资产表和镜头表是生产事实来源。两者矛盾时停止向下游扩散，明确指出冲突并等待修订或批准。

### 3. 图片与视频提示词

任何非简单提示词先读 `references/production/prompt-architecture.md`。

- 图片：读 `image-prompt-crafting.md`；涉及参考图时读 `reference-asset-control.md`；多人或精确位置读 `spatial-blocking.md`。
- 视频：读 `video-prompt-contract.md`；按需读取摄影、表演、动作物理、光色材质、对白声音、连续性、多镜头和负向约束资料。
- 润色时必须读 `prompt-preservation.md`，保留人数、时长、逐字台词、身份、状态、画幅和明确禁项。
- 输出平台未知时先给模型无关主提示词，平台适配层标记为 `unspecified`，不臆造参数。

默认输出：模式与丰富度、硬约束快照、主提示词、平台适配层、修改/设计摘要、假设、质量评分、风险与首轮测试建议。

### 4. 迭代、诊断与交付

- 失败诊断：先读 `failure-diagnosis.md`，定位问题属于资产、场次/镜头契约、提示词、平台适配、生成还是剪辑，再做最小修复。
- 重复生成和选片：读 `iteration-selection.md`。连续两个批次同一错误无改善时，回退到资产或镜头契约，不继续盲目抽卡。
- 连续性：读 `continuity-control.md`，维护 `07_review/continuity-matrix.csv`。
- 交付：读 `project-qa-gates.md`，检查技术规格、权利、已知缺陷、豁免和发布授权；未经用户明确授权不发布。
- `/export`：将剧本导出到 `09_delivery/screenplay/`，生产交付物仍按 `09_delivery/delivery-checklist.md` 验收。

## 不可破坏的边界

- 不复制 Hell Grind 的原片、原始资产、全量提示词或项目专有角色；本 Skill 只复用其仓库许可范围内的方法、模板和脚本。
- 不把公开可访问等同于拥有第三方素材再分发权。
- 参考图必须记录来源、权利状态和继承范围。
- 不编造授权、预算、平台、生成结果、审核通过或交付批准。
