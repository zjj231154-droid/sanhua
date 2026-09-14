# 本地 Codex 产品精修

启动：`npm run dev -- --port 5173`，打开 http://127.0.0.1:5173/?preview=retouch。

需要 Node.js 与可在 PATH 中运行的 Codex CLI，先执行 `codex login`。如需指定二进制，可设置 `CODEX_BIN` 为可执行文件绝对路径。平台通过本地 `codex exec` 运行任务，不读取或向浏览器发送登录凭据。

上传一张真实图片，填写尺寸、场景、装饰和要求，点击“生成精修计划”。查看计划后点击“确认计划并开始精修”。仅在 outputs 目录收到实际图片时才显示完成和下载入口。当前为单图流程，不支持批量和区域画笔。

技能完整保存在 `.agents/skills/image-edit-agent/SKILL.md`，源目录仅含该文件。每次规划与执行均读取技能正文。原技能 `edit_image` 适配至 Codex 原生图片工具；工具不可用时报告失败，不使用原图或 CSS 滤镜冒充结果，不自动切换付费 API。

任务及原图存放于 `storage/retouch/<任务编号>/`，产物在其 `outputs/`。图片在提交时交给 Codex，使用已登录账号额度。刷新后可恢复最近任务状态；本地服务重启会把未完成任务标为中断，需要重新提交。

这是本机开发服务器集成，`npm run build` 仅生成前端文件，不包含独立线上后端。不要将此开发服务暴露到公网。服务限制本机 Host 与同源请求，输入图片最大 15 MB，产物只能通过任务白名单访问。

接入参考：https://developers.openai.com/codex/noninteractive/
