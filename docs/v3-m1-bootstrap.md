# v3.0 M1 初始化与迁移说明

## 当前实现范围

- 固定单企业 10 席位：S01 为唯一 owner，S02–S10 可保留给邀请码。
- 新账号只能通过席位邀请码注册，并加入唯一企业工作空间。
- 管理员后台显示座位状态、邀请码后四位、角色和已绑定账号；完整邀请码仅在生成接口响应中出现一次。
- 推理、生图、视频连接继续按当前服务端 Session 用户隔离。
- `private` 资产只能由创建者读取；管理员不再因管理权限读取他人私有资产。

## 受保护初始化

初始化只允许在空存储上执行一次，且需要部署环境变量 `SANHUA_BOOTSTRAP_SECRET`。请通过受信运维通道调用：

`POST /api/v1/admin/bootstrap`

请求体字段：`bootstrapSecret`、`username`、`password`、`name`、`workspaceName`、`inviteCodes`。其中 `inviteCodes` 必须恰好 9 组，格式为 `SH-XXXX-XXXX-XXXX`。

不要把初始密码、完整邀请码或 bootstrap secret 提交到 Git、前端配置、日志或工单。服务端仅保存密码哈希和邀请码摘要/后四位。

## Dry-run 与回滚

生产执行前应先备份 Railway Volume，并对以下 JSON 前缀导出清单：

- `metadata/collaboration/users/`
- `metadata/collaboration/workspaces/`
- `metadata/collaboration/members/`
- `metadata/assets/`、`metadata/tasks/`、`metadata/scripts/`

若已存在用户或工作空间，初始化接口会返回 `ENTERPRISE_ALREADY_INITIALIZED` 或由迁移前检查阻止；不得直接覆盖历史数据。当前 Railway Volume 的 JSON 存储不提供数据库事务级并发保证，正式多用户生产发布前仍应迁移席位、邀请、会话等事务元数据至 PostgreSQL。
