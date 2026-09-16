# 短剧制作工作台

这是一个已经安装好的项目级 Codex 工作台，将以下两个 MIT 项目组合为一条完整流水线：

- `0xsline/short-drama`：选题、故事规划、角色、分集目录、剧本、质量审查、合规与导出。
- `renmu2017/Hell-Grind-AIGC-Skill`：资产、场次、镜头、图片/视频提示词、生成记录、连续性、失败诊断与交付。

## 使用

在 Codex 中打开本目录，然后直接说：

```text
使用 $short-drama-production 启动一个新的竖屏短剧项目，先帮我完成选题立项，不调用任何付费生成模型。
```

也可以继续说 `/plan`、`/characters`、`/outline`、`/episode 1`、`/review 1`、`/compliance` 或“把已经确认的第 1 集转换成资产表和镜头表”。

已初始化的示例工作目录位于 `projects/我的短剧项目/`，可直接改名和填写内容。

## 本地工具

```powershell
python .agents/skills/short-drama-production/scripts/init_short_drama_project.py `
  --name "新短剧" `
  --output projects/new-drama `
  --aspect-ratio 9:16 `
  --episodes 60

python .agents/skills/short-drama-production/scripts/validate_project.py `
  projects/new-drama --strict-v2
```

初始化、校验和提示词审计都不会访问网络或数据库。项目默认不自动调用图片/视频生成服务。

## 来源与许可证

整合内容来自 [0xsline/short-drama](https://github.com/0xsline/short-drama) 与 [renmu2017/Hell-Grind-AIGC-Skill](https://github.com/renmu2017/Hell-Grind-AIGC-Skill)。两者均采用 MIT License；完整声明保存在 `third_party/`。

Hell Grind 仓库的方法受到公开制作资料启发，但其原片、原始资产、全量提示词与项目专有材料不在授权范围内，也未包含在本项目中。
