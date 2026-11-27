# 视频渲染与导出

平台预览、浏览器视频导出和离线 MP4 渲染共用 `lib/motion/renderer.ts` 的 `drawFilm(context, film, time)`。画面是时间的纯函数；同一项目在同一浏览器和字体环境中逐帧可复现。跨操作系统字体栅格化可能不同。


## 自定义模式

`creationMode: "custom"` 的项目由 `custom-renderer.ts` 直接渲染，自由排列文字、矩形、椭圆、线条、多边形和图片图层。画布不会自动添加模板背景、光球、仪表盘、片头、片尾或水印；空白画布只显示所选背景。背景带透明度时，统一合成在不透明黑底上，保证普通预览画布与视频编码画布的结果一致。

每个自定义场景包含 `composition.background`、可选的 `backgroundEnd` 渐变终色，以及按绘制顺序排列的 `layers`。坐标和尺寸使用相对画布的比例；字号、描边和圆角使用画布短边的比例。文字在图层尺寸内换行并裁切。图片图层使用项目已上传的素材，等比包含在指定矩形内；未提供素材时保持空白，不插入占位图。

图层关键帧时间相对于当前场景，支持位置、尺寸、旋转、透明度和缩放。每个属性独立插值：从 0 秒的基础值出发，0 秒关键帧可覆盖基础值，最后一个关键帧之后保持最终值。关键帧的 `easing` 控制进入该帧的曲线，可选 linear、easeInOut、spring；spring 为端点归一化的临界阻尼，不使用运行时状态。场景之间直接切换；需要淡入淡出或连续变形时，明确编排对应的关键帧。

自定义预览、浏览器视频导出和离线 MP4 复用同一渲染入口，不运行用户或模型生成的任意 JavaScript。它是自由图层和关键帧创作能力，不是任意 HTML/JavaScript 沙箱。编辑器修改总时长或增删场景时，会按比例重新分配各幕时长，保证每幕至少 0.5 秒，再同比重排该幕的关键帧。

## 浏览器导出

点击工作台的导出按钮，页面通过 Canvas captureStream 和 MediaRecorder 实际编码视频。根据浏览器能力自动输出 MP4 或 WebM，文件扩展名与真实容器一致。输出为 30 fps：横屏 1280×720、竖屏 720×1280、方形 720×720。

浏览器导出按视频实际时长执行，需保持页面在前台；切换后台会停止并给出错误，避免生成缺帧文件。可取消导出。开启背景音乐时，使用原创合成的 120 BPM 节拍，不需要第三方音频授权。实时编码受设备性能影响，精确逐帧输出使用以下离线渲染器。

当前已在浏览器验证自定义作品的导出操作完成、弹窗关闭；尚未从下载目录读取该文件检查真实容器、帧数和时长。离线 CLI 的成片参数已单独验证，不能据此替代浏览器下载文件验收。

## 离线 H.264 MP4

依赖：Node.js >= 22.13、项目依赖、已安装的 Chrome/Chromium、带 libx264 的 FFmpeg。`playwright-core` 不自动下载浏览器。CLI 仅启动自己的无头渲染页面，不接管用户浏览器、不读取浏览历史、不需要网站登录或模型密钥。

```sh
npm install
node scripts/render-video.mjs --sample luma --output outputs/luma.mp4 --music
```

原创新片示例 ID 为 `luma`、`form`、`flux`、`orbit`。从工作台下载项目 JSON 后可以渲染同一个项目：

```sh
node scripts/render-video.mjs --input project.json --output outputs/my-film.mp4 --music
```

私有上传图片不会由 CLI 自动抓取。需要将图片保存在本机并明确指定：

```sh
node scripts/render-video.mjs --input project.json --asset product.png --output outputs/my-film.mp4
```

其他参数：

- `--fps 60`：以 60 fps 逐帧采样同一个动画函数，默认为 30。
- `--chrome /absolute/path/to/chrome`：指定浏览器；也支持 `CHROME_PATH` 环境变量。
- `--overwrite`：允许替换已有输出，默认拒绝覆盖。
- `--music`：添加原创合成背景节拍，默认无音轨。
- `--help`：查看完整用法。

CLI 使用 esbuild 打包完整校验与渲染模块，保留模板和自定义模式相同的依赖链。渲染器先按平台相同规则校验 Film JSON，再对每个 `frame / fps` 渲染 PNG，直接送入 FFmpeg stdin，以 H.264、yuv420p、CRF 18、faststart 编码 MP4。音乐可选 AAC。临时文件在完成或失败后清理，成功后保存 MP4 和对应的 `.json` 项目文件。Ctrl+C 会取消渲染。

```sh
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -show_entries format=duration -of json outputs/luma.mp4
```

此脚本是独立的本机渲染入口，尚未连接云端渲染队列。Cloudflare Workers 承担接口和项目存储；FFmpeg/Chromium 需要运行在独立容器或机器中。首版未实现运动模糊、多机并行或托管渲染任务。

## 已验证的本地成片

| 示例 | 时长 / 帧数 | 视频 | 音频 |
| --- | --- | --- | --- |
| `outputs/motionlab-luma.mp4`（模板） | 15 秒 / 450 帧 | H.264，1280×720，30 fps | AAC |
| `outputs/motionlab-custom.mp4`（自定义图层） | 5 秒 / 150 帧 | H.264，1280×720，30 fps | AAC |

上述参数来自 ffprobe 检查。示例文件保留在当前工作区的 `outputs/`，该目录属于本地生成物；全新源码环境可从编辑器下载自定义项目 JSON，再用 `--input` 渲染。自定义示例验证的是手工场景图与渲染链路，不代表已经接入真实模型服务。

参考实现思路来自项目说明中的两个上游库；动画、模板、音轨均为本项目原创，没有分发上游示例影片。
