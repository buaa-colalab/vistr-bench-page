# Astra–Human 视频最终设计

全英文画面，配自然、有对话感的英文男声旁白，3840×2160（4K），30 fps。当前配置 99.667 秒，共 2990 帧；停顿和动画由根目录 `video.config.json` 控制。

## 第一幕：模型比较

Human 加前七个模型。模型不显示 thinking 后缀。Astra 起初与其他模型同为灰色，高亮时渐变深色并加粗。页底结论：GPT-6-Astra ranks first among the evaluated models.

## 第二幕：能力差距

先比较四个维度，Human 在上、Astra 在下，带对应图标。结论：Astra performs well in motion perception and spatial reasoning. / Gaps remain in outcome prediction and physical dynamics. 只有能力名称标绿或红，and 与其余文字黑色。

四维度比较结束后直接进入相对速度案例，不再展示十五任务逐项比较、展开动画或任务组高亮页。

## 第三、四幕：六个案例

Public #111、#1139、#228 为三个表现较好的案例；#812、#629、#1288 为三个仍有差距的案例。足球为成年球员身穿黑色训练服的片段。篮球仅删除原片最后一帧，保留前 131 帧。

布局使用 1920×1080 逻辑坐标，4K 成片中所有位置和字号等比放大两倍。所有展示素材裁成 2560×1600（8:5），画面显示 1008×630，左上角 (96,196)。右列从 x=1184 开始，任务名 36px，简短问题 34px。左上分类标题标绿或红；任务名、问题、预测与标准答案均黑色。

所有案例的对勾或叉号固定在 (1600,588)，根据最长的 Counterclockwise 预留空间；仅保留清晰的圆角线条，无圆圈或底色。只用符号表达正误，不显示英文状态。案例底部差值使用中性灰色 #808080。Fall Direction 问题为 Will the person fall to their own left or right?

每题首帧读题、播放一遍、末帧短停、揭晓答案、回首帧准备、重播一遍、末帧收尾。两个播放阶段不淡出，案例淡出只发生在收尾停顿。

## 文件

- 预览：`astra-human-video.html`
- 成片：`outputs/astra-human/astra-human-final.mp4`
- 独立英文男声旁白：`outputs/astra-human/astra-human-narration.mp3` 与 `.wav`
- 语音配置：`narration.config.json`
- 设计数据：`docs/astra-human-video-data.json`
- 节奏配置：`video.config.json`，各参数自带中文说明
- 英文旁白稿：`docs/astra-human-video-narration.md`，含按画面分段的时间码与数据参考
- 配置文档：`docs/video-config.md`
- 实现说明：`docs/astra-human-video-implementation.md`

原始问题保留在生成数据 `originalQuestion`，显示问题来自设计数据 `display_question`。预测与标准答案来源于原始 JSON 评分记录，保留在 originalAnswer 和 originalCorrectAnswer。摔倒方向仅把显示值简化为 Left / Right。

旁白中的模型名统一使用 GPT-6-Astra；当前音色为 Andrew 美式神经男声。仅更新旁白，画面仍使用原来的 4K 视频流。

切页旁白留白：新页出现后 0.65 秒再开口，离页前至少留 0.85 秒句尾静音；相邻页面的旁白至少相隔 1.5 秒。榜单结论停留 3.8 秒、四维度结论停留 4.4 秒、案例重播后末帧停留 1.4 秒，总时长约 99.667 秒。

旁白用语：四维度统一使用 Outcome prediction；自运动归入表现较好类别，仅强调当前自运动任务接近人类水平；摔倒案例先说明 GPT-6-Astra 预测 left、正确答案 right，再用 Overall, it still struggles to predict the future. 收束。
