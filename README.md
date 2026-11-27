# 映动 MotionLab

面向中文创作者的 coding-to-video 平台：从产品介绍或创意出发，生成可编辑分镜和动画，支持对话修改、自由图层与关键帧编辑，以及视频导出。

应用源码位于 [`motionlab/`](motionlab/)。支持模板创作和不依赖模板的自定义创作；空白画布无需模型密钥，AI 创作使用服务端配置的模型。

## 本地运行

需要 Node.js 22.13 或以上版本。在仓库根目录执行：

```sh
cd motionlab
npm ci
npm run build
npm run db:migrate:local
npm run dev
```

模型配置请参考 [`motionlab/.env.example`](motionlab/.env.example)，将配置保存在本地 `.dev.vars` 中。源码仓库不包含密钥、用户作品数据库、上传素材或依赖目录。

完整使用说明见 [应用 README](motionlab/README.md)，设计与能力边界见 [架构文档](motionlab/docs/ARCHITECTURE.md)，视频导出见 [渲染说明](motionlab/docs/RENDERING.md)。

源码托管于 GitHub，产品继续在本地运行。
