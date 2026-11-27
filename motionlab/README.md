# 映动 MotionLab

面向中文创作者的 coding-to-video 产品 MVP。可用模板快速制作产品宣传和社交短视频，也可以从空白画布开始，自由安排图层、构图和动画，再预览并导出真实视频。

源码托管于 GitHub，产品继续在本地运行，尚未部署到在线服务。

## 已实现

- 中文创作工作台、4 套原创视觉模板与品牌偏好。
- 独立的自定义创作模式：空白画布、自由图层、动画关键帧和多场景，不依赖固定模板。
- 文字、矩形、椭圆、线条、多边形及图片图层；支持位置、尺寸、颜色、透明度、旋转、缩放、排序和复制。
- 15/30/60 秒视频；横屏、竖屏、方形三种画幅。
- 分镜生成与校验、文案编辑、场景排序、风格修改、撤销。
- 模型服务接入（服务端兼容 Chat Completions）：模板模式可在无模型时使用规则编排；AI 自定义创作必须配置模型，不会回退为模板。
- D1 项目存储、R2 素材空间、用户隔离、保存冲突保护。
- 确定性动画预览、可拖动时间线、真实浏览器视频导出与原创合成节拍。
- 独立 Chromium + FFmpeg H.264/AAC MP4 渲染脚本。

## 自定义创作

1. 在创作页选择「自定义创作」，点击「创建空白画布」。手工创作不需要模型密钥。
2. 在「场景与图层」中添加文字或图形，调整位置、尺寸、颜色与层级。需要图片时，先在创作页上传并选中素材，再创建作品。
3. 拖动时间线到目标时刻，点击「记录」，修改该关键帧的位置、透明度或缩放；相邻关键帧会自动过渡。也可使用淡入、上浮、横移和呼吸动画作为起点。
4. 按需要增删、排序场景。修改总时长时会同步重排各场景及其关键帧，每幕至少保留 0.5 秒。
5. 播放预览，保存项目并导出视频。项目 JSON 保留全部自定义图层与关键帧，可交给离线渲染器生成 MP4。

配置模型后，「AI 自由创作」可以根据描述生成专属场景、图层和动画，并支持继续对话修改。自定义模式使用独立的场景图（scene graph），没有自动插入的模板背景、产品卡片、片头或片尾；它提供受控的自由图层创作，不执行任意 HTML/JavaScript。

## 本地启动

需要 Node.js 22.13 或以上版本。离线 MP4 渲染额外需要 Chrome/Chromium 与 FFmpeg。

本次工作区已安装依赖并初始化数据库，可直接在 `motionlab` 目录运行 `npm run dev`。以下完整步骤用于解压源码包后的全新环境。

```sh
cd motionlab
npm ci
npm run build
npm run db:migrate:local
npm run dev
```

打开终端打印的地址，默认为 `http://127.0.0.1:5173`。本地开发会使用 Sites 的模拟登录；首页会走标准登录跳转。首次数据库迁移会创建 projects 和 assets 表。运行 `db:migrate:local` 前须已构建；脚本将构建配置复制到被 Git 忽略的 `.sites-runtime/migrations/`，将 Worker、静态资源和 `drizzle/` 迁移目录解析为绝对路径，并与开发服务器共用 `.wrangler/state`。Wrangler 记录已应用迁移，再次运行只应用新增 SQL。后续修改数据库结构后先运行 `npm run db:generate`，检查生成 SQL，再构建并迁移。脚本只操作本地数据库，不会触发远程迁移。`npm run start` 用于本地生产构建测试，不提供开发模式的登录模拟。

可用 `npm run db:migrate:local -- --persist-to /tmp/motionlab-db-check` 在独立本地目录验证迁移。若旧数据库通过 `d1 execute --file` 手工建表，尚无 Wrangler 迁移记录，需在备份后人工核对并建立迁移基线；本脚本不会删除数据或擅自跳过这类冲突。

## 模型配置

复制 `.env.example` 的字段到本机 `.dev.vars`（不要提交密钥），然后重启本地开发服务：

```dotenv
MODEL_API_KEY=your_provider_key
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_NAME=your_model_id
```

客户端不会收到密钥。未配置时仍可使用模板编排和自定义空白画布，以及编辑、预览、保存和导出。AI 自定义生成或对话修改在缺少配置时会明确提示，不用模板替代。

已在本地通过火山方舟 `kimi-k3-1-pro-261024` 完成真实自定义生成联调：返回 `mode: model`、1 个自由场景、2 个图层和 6 个关键帧，并通过结构校验。请求使用供应商默认 temperature，以兼容限制采样参数的模型。其他模型仍需单独验证参数与输出质量。

如果密钥已配置在 `~/.zshenv` 的 `ARK_API_KEY` 中，需要把当前值映射到 `.dev.vars` 的 `MODEL_API_KEY`；程序不会自动识别这个别名，dotenv 也不会展开字面量 `$ARK_API_KEY`。本地 `.dev.vars` 存在时，Worker 会优先读取它，因此地址和模型 ID 也应写在同一文件中。密钥轮换后同步更新本地配置并重启服务。

## 验证与导出

```sh
npm run typecheck
npm test
npm run build
npm run render:video -- --sample luma --output outputs/luma.mp4 --music
```

已通过 43 项测试、TypeScript 检查和生产构建，覆盖自定义场景保存、无模型时禁止模板降级、自由图层与关键帧校验、动画确定性、场景时长重排、跨用户隔离、过期保存和素材授权。本地 HTTP 集成已验证原有项目及素材接口。

浏览器已验证自定义作品创建、图层编辑、保存、关键帧跳转，以及导出完成后弹窗关闭；刷新页面重新打开作品后，两层布局及动画仍正确保留。浏览器下载文件尚未从下载目录读取并做编码检查，因此这部分验收不包含实际下载文件的媒体参数验证。导出需要页面保持前台，格式依浏览器能力为 MP4 或 WebM。

独立 CLI 成片已用 ffprobe 验证：模板示例为 15 秒、450 帧；自定义示例为 5 秒、150 帧。两者均为 1280×720、30 fps、H.264 视频和 AAC 音频。

- [架构、接口与商业化前缺口](docs/ARCHITECTURE.md)
- [视频渲染说明](docs/RENDERING.md)

这是可运行的本地 MVP，不等同于已完成公开商业运营。尚未接入支付计费、模型额度限流、云端渲染队列、任意代码沙箱、URL 抓取、旁白及运营后台。生产建设路线和边界见架构文档。

## 参考

参考 [whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion) 的统一时间线、纯时间函数与视觉审查，以及 [AbubakrChan/product-launch-motion](https://github.com/AbubakrChan/product-launch-motion) 的闭式弹簧、音乐节拍与逐帧渲染。动画、示例品牌、画面和音轨均为原创，未分发其示例影片或素材。具体许可说明见架构文档。
