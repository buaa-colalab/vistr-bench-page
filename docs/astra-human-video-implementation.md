# Astra–Human 动画代码

最终版：当前配置约 99.67 秒、3840×2160（4K）、30 fps、全英文画面、英文男声旁白（AAC 音轨）。时长由 `video.config.json` 决定。

## 本地预览

直接用浏览器打开仓库根目录 `astra-human-video.html`。数据、图标、六段无声素材都在仓库内，不需要网络或开发服务器。

页面支持播放/暂停、时间线拖动、四幕跳转和全屏。预览控件位于画面外，不会进入导出视频。画面使用 1920×1080 逻辑坐标，默认按 2 倍导出为 3840×2160；素材画布为 2560×1600，素材与成片均使用 CRF 16 编码。

快捷键：空格播放/暂停，左右方向键前后 1 秒，F 全屏。输入框或按钮获得焦点时保留其原生键盘行为。

## 代码位置

| 文件 | 作用 |
|---|---|
| `static/js/astra-human-scene.js` | 四幕的布局与确定性 SVG 动画；浏览器和导出器共用 |
| `static/js/astra-human-player.js` | 播放、拖动、视频同步、暂停与全屏 |
| `static/video-story/data.js` | 生成的英文显示数据、时间点和内嵌厂商图标 |
| `static/video-story/*.mp4` | 六段去除音轨、统一裁成 2560×1600 的案例素材 |
| `scripts/prepare-astra-human-video.cjs` | 从设计数据准备素材、显示数据、图标与许可文本 |
| `scripts/render-astra-human-video.cjs` | 按同一时间线渲染静帧或带英文旁白的 MP4 |
| `tests/astra-human-video.test.cjs` | 时序、素材边界、简短问题来源、案例正确性、英文画面、图标 ID 和数据覆盖测试 |

## 准备与导出

要求 Node.js 20+、FFmpeg 与 ffprobe 在 PATH 中。预览本身不需要安装 npm 依赖。

首次使用导出器：

```bash
npm ci --ignore-scripts
```

数据或原片更新后重新准备：

```bash
npm run video:prepare
```

此命令按 `docs/astra-human-video-data.json` 中的原始文件路径读取六个案例，用 FFmpeg 生成无声本地副本。若把项目迁移到另一台电脑，可先更新该文件的 `video_path`。原始视频不会被改写。

核对代码与代表性画面：

```bash
npm run test:video
npm run video:stills
```

完整导出：

```bash
npm run video:render
```

默认输出 `outputs/astra-human/astra-human-final.mp4`。导出后程序会核对分辨率、帧率、时长，并核对英文音轨及音画时长。

快速导出某一段：

```bash
npm run video:render -- --start 56.433 --end 70.933 --width 1280 --fps 30 --output outputs/astra-human/basketball-review.mp4
```

指定静帧时间点：

```bash
npm run video:stills -- --at 2,5.5,11.9,14.7,15.3,23.3,35.8,49.5,64.6,77.1,87.9
```

静帧位于 `outputs/astra-human/stills/`。`outputs/`、素材解帧缓存和 `node_modules/` 已加入 `.gitignore`。

## 修改方式

- 画面位置、字号、颜色、显隐时间：编辑 `astra-human-scene.js`。
- 章节边界、案例问题、播放/揭晓时间与素材：编辑最终设计 JSON 和准备脚本，再执行 `video:prepare`。
- 七个模型和其他图表数据来自最终设计快照；GPT-5.6-Sol 的 63.0% 是用户指定的展示修改，原始榜单 CSV 保持原样；更新榜单后若要同步成片，需要明确更新设计数据再重新准备。
- 浏览器使用 HTML 视频层播放片段；导出器将同一时间点的视频帧放进共享 SVG，预览控件不进入成片。
- 图标沿用 `model-chart.html` 中的 Lobe Icons，许可在 `static/video-story/ICON-LICENSE.txt`。SVG 光栅化使用 [resvg-js](https://github.com/thx/resvg-js)，MP4 编码使用 FFmpeg。

## 素材与比较口径

六个案例依次为 Public #111、#1139、#228、#812、#629、#1288。前三项回答正确，后三项错误。视频中的 `Ground truth` 是标准答案，Human 数字是任务整体评测准确率。

每个案例先显示首帧和简化问题 2.6–3.2 秒，完整播放原片，末帧短停约 0.25 秒再显示预测与标准答案 2 秒；回到首帧准备 0.3 秒，完整播放第二遍，末帧保留 1.4 秒后进入下一题。停顿可通过根目录 video.config.json 修改。播放时间限制在原片范围，不拼接其他结局。四维度比较结束后直接进入六个案例，没有逐任务比较页。

视频右侧问题使用设计 JSON 的 `display_question` 简短表述；原始逐题 JSON 的 `question` 保留在生成数据的 `originalQuestion` 中，模型预测与标准答案来源于原始评分记录，并保存在 `originalAnswer`、`originalCorrectAnswer`；摔倒方向仅将显示文字简化为 Left / Right。旋转方向与摔倒方向先裁掉原片底部 100 和 116 像素的文字条，再将六段素材等比缩放裁切至统一的 2560×1600（8:5）。室内与篮球镜头的裁剪位置略偏上，保留桌面和篮筐；原始文件保持不变。篮球展示片段仅删除最后一帧（原 132 帧保留前 131 帧），两遍播放与末帧停留均使用裁剪后的素材；其余片段时长保持不变。

## 停顿配置

修改根目录 `video.config.json`，预览前运行 `npm run video:prepare` 并刷新页面。`npm run video:render` 与 `npm run video:stills` 会自动先应用最新配置。详见 [配置说明](video-config.md)。读题阶段显示首帧，案例左上角显示所属分类标题。第二页结论前缀为黑色，能力名称分别标绿、红；后续只有案例分类标题使用相同颜色；右侧任务名、问题、答案均为黑色。Astra 预测右侧在所有案例的固定位置 (1600,588) 用放大的圆角线条对勾或叉号表达正误，无外圈、无底色、无英文状态文字。案例底部差值使用中性灰色 #808080。Fall Direction 明确使用人物自身左右。

## 英文男声旁白与成片合并

[英文旁白稿](astra-human-video-narration.md) 按约 93 秒视频分为 14 段，每段对齐对应画面。答案旁白在画面揭晓后才开始。

在 macOS 本机终端执行 `npm run audio:render`。当前使用 Microsoft `en-US-AndrewNeural` 美式神经男声。需要联网，只发送英文旁白正文到语音服务，不发送视频或原始评测文件。用户已明确授权这份讲稿的传输。基础语速 +6%，音高 +2 Hz；逐句自动适度调整语速以保持画面对齐。首次安装：`python3 -m venv .venv-audio`，然后 `.venv-audio/bin/python -m pip install -r requirements-audio.txt`。

声音、语速、逐句留白及目标响度由 `narration.config.json` 控制。

修改讲稿并生成新音频后，执行 `npm run video:mux`，将英文旁白合入现有最终 MP4。画面使用流复制，不重新压缩 4K 视频。音轨为 AAC 192 kbps、48 kHz，标记语言 eng。

完整重建的顺序为：`npm run video:prepare` → `npm run audio:render` → `npm run video:render`。导出器会根据数据中的音轨配置自动调用同一合并程序。修改视频节奏后，需先同步英文稿时间码，避免旁白与画面错位。

单独输出 `outputs/astra-human/astra-human-narration.mp3` 和 48 kHz、16-bit、单声道 WAV；最终成片 `outputs/astra-human/astra-human-final.mp4` 已带英文旁白。音频时长为 99.666667 秒。

`docs/astra-human-audio-timing.json` 记录逐句文本、实际发声起止点与语速。合并前会检查稿件是否与音频一致、总时长是否匹配，以及六个答案是否在画面揭晓后才读出。

完整模型名在讲稿中统一使用 `GPT-6-Astra`，合成时读作 `G P T six Astra`；音色方向和参考来源见 [音色说明](astra-human-voice-direction.md)。

## 切页留白

本版复用已合成的 Andrew 男声音频，保持原音色与语速。每页入场后 0.65 秒才开口，句尾距切页至少 0.85 秒；七次页面切换的旁白间隔已校验为 1.557–3.123 秒。只改停顿时可使用 `npm run audio:render -- --reuse`，随后重新渲染延长停留后的画面；不需要重新请求在线语音。
