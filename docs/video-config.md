# 视频节奏与过渡配置

编辑根目录 `video.config.json`。每个字段旁的 `_字段名` 是中文说明，不会出现在画面中。全部时间以秒为单位，允许小数，自动对齐到 30 fps 的最近整数帧。

## 先调哪里

- 调阅读停留：`pages` 和 `examples`。
- 调动画柔和程度：`animations`。
- 只调某一个案例：`examples.overrides`。

阶段时长和动画时长不是相加关系。例如结论阶段 3 秒、淡入 0.45 秒，合计仍为 3 秒。案例素材始终保持原速播放两遍；篮球素材按要求删去原片最后一帧。

## 图表页

| 字段 | 当前秒数 | 从哪里到哪里 |
|---|---:|---|
| `pages.ranking.intro_seconds` | 0.7 | 本页入场到柱条开始生长；含页面淡入，不额外相加。 |
| `pages.ranking.all_models_seconds` | 2.5 | 柱条开始生长到 Astra 开始高亮；含柱条生长，越大则榜单阅读越久。 |
| `pages.ranking.highlight_seconds` | 1.8 | Astra 开始高亮到结论开始出现；含高亮变色动画。 |
| `pages.ranking.conclusion_seconds` | 3.8 | 结论开始出现到离开本页；含结论淡入及页尾淡出。 |
| `pages.dimensions.intro_seconds` | 0.6 | 本页入场到柱条开始生长；含页面淡入，不额外相加。 |
| `pages.dimensions.comparison_seconds` | 2.8 | 四维度柱条开始生长到结论出现；含柱条生长。 |
| `pages.dimensions.conclusion_seconds` | 4.4 | 结论开始出现到离开本页；含结论淡入及页尾淡出。 |

## 案例页的七个阶段

`首帧读题 → 第一遍播放 → 末帧短停 → 答案阅读 → 首帧准备重播 → 第二遍播放 → 末帧收尾`

| 通用字段（`examples` 下） | 当前秒数 | 控制内容 |
|---|---:|---|
| `question_seconds` | 2.8 | 从案例入场到开始第一遍播放；包含案例/问题淡入，读题阶段始终显示首帧。 |
| `before_answer_seconds` | 0.25 | 第一遍完整播放结束后，停在末帧多久才揭晓答案。 |
| `answer_seconds` | 2 | 答案开始淡入到视频回到首帧的阅读时间；包含 answer_fade_seconds。 |
| `replay_lead_in_seconds` | 0.3 | 答案保持显示，视频回到首帧后短停多久再播放第二遍，避免瞬间跳回并运动。 |
| `after_replay_seconds` | 1.4 | 第二遍播完后保留末帧的收尾时间；案例淡出只发生在此段，避免动作没播完就淡出。 |

每题总时长为：读题 + 第一遍原片时长 + 末帧短停 + 答案阅读 + 首帧准备重播 + 第二遍原片时长 + 末帧收尾。

本版简短问题通常保留 2.6–3.2 秒读题时间。第二遍结束后停留 1.4 秒，其中最后 0.35 秒淡出；视频动作播放时不淡出。

单独修改某一题：

```json
"soccer-shot": {
  "question_seconds": 3.5,
  "before_answer_seconds": 0.3,
  "answer_seconds": 2.2,
  "replay_lead_in_seconds": 0.4,
  "after_replay_seconds": 0.8
}
```

这段放在 `examples.overrides` 中对应案例的对象里。未填写的字段沿用通用值。

案例名：`relative-velocity`、`rotation-direction`、`ego-motion`、`basketball-shot`、`soccer-shot`、`fall-direction`。当前相对速度、自运动、足球读题 3.2 秒；篮球、摔倒方向 2.6 秒；旋转方向沿用通用的 2.8 秒。

## 动画时长

| 字段（`animations` 下） | 当前秒数 | 控制内容 |
|---|---:|---|
| `scene_fade_in_seconds` | 0.45 | 图表页整页淡入。 |
| `scene_fade_out_seconds` | 0.35 | 图表页整页淡出；自动限制在该页面时长内。 |
| `ranking_draw_seconds` | 0.8 | 首页所有柱条从 0 生长到目标值。 |
| `ranking_highlight_seconds` | 0.55 | Astra 柱条由普通灰色变深色，同时其他模型淡化。 |
| `dimensions_draw_seconds` | 0.8 | 四维度比较柱条的生长时长。 |
| `conclusion_fade_seconds` | 0.45 | 图下结论的淡入时长。 |
| `case_fade_in_seconds` | 0.45 | 案例整页淡入，包含视频第一帧。 |
| `case_fade_out_seconds` | 0.35 | 案例末帧的淡出时长，最多为 after_replay_seconds；不会削短播放。 |
| `question_fade_seconds` | 0.4 | 问题文字淡入；包含在读题停顿里。 |
| `answer_fade_seconds` | 0.4 | 预测、符号及标准答案淡入；包含在答案阅读停顿里。 |

动画采用两端减速的平滑曲线。图表生长、榜单高亮和案例淡出会受对应阶段长度限制；案例淡出只占末帧收尾时间。设置动画为 0 可关闭该动画，不会出现无效帧。

想更平缓，可将淡入、高亮增加到 0.5–0.7 秒；想保持文字更久，应增加页面或案例阅读停留，而不是只加动画时长。

## 当前时间线

| 阶段 | 起止（秒） |
|---|---:|
| 榜单 | 0.00–8.80 |
| 四维度 | 8.80–16.60 |
| Relative Velocity | 16.60–31.90 |
| Rotation Direction | 31.90–43.53 |
| Ego Motion | 43.53–60.63 |
| Basketball Shot | 60.63–75.93 |
| Soccer Shot | 75.93–86.63 |
| Fall Direction | 86.63–99.67 |

此表对应当前配置，约 99.67 秒。再次修改配置后，以生成的 `static/video-story/data.js` 和设计 JSON 中的时间点为准；章节按钮会自动更新。

## 应用配置

只更新预览：

```bash
npm run video:prepare
```

刷新 `astra-human-video.html`。重新导出成片：

```bash
npm run video:render
```

导出会自动应用配置，输出 `outputs/astra-human/astra-human-final.mp4`。关键帧用 `npm run video:stills` 生成。

每项支持 0–300 秒，各图表页总时长必须大于 0。负数、无效数字、未知案例名、拼错的案例参数和动画参数都会在处理素材前报错。

逐任务比较页已移除，四维度页结束后直接进入案例；配置也不再包含相应的停留和展开动画参数。配套旁白时间码位于 `docs/astra-human-video-narration.md`。

最终 MP4 已包含英文男声旁白。调整视频节奏后，也要同步英文稿的时间码，运行 `npm run audio:render` 再导出。只修改旁白时可运行 `npm run video:mux`，保留已有 4K 画面重新合入音频。

## 切页旁白停顿

`narration.config.json` 中 `page_start_padding_seconds=0.65` 表示新页出现后再开口；`page_end_padding_seconds=0.85` 表示上一句在切页前收住。`minimum_page_gap_seconds=1.5` 用于校验相邻页面两句之间的最短静音。页内问题与答案分别使用 `cue_start_padding_seconds`、`cue_end_padding_seconds`（均为 0.2 秒）。

仅调整停顿且讲稿和声音不变时，可运行 `npm run audio:render -- --reuse`，逐句复用已有音频、重新安排静音，不再调用在线语音服务。
