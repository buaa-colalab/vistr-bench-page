# GPT-6-Astra 与人类：英文男声旁白稿

对应最终 4K 视频，时长 **99.667 秒**。画面与旁白均为英文，声音使用清晰、自然、有对话感的美式神经男声 Andrew。旁白按下方时间码合入最终视频。

录制时按时间段朗读，句间留短停顿。每个案例的答案句须等右侧预测与标准答案出现后再开始；前半段只提问，不提前揭晓。时间为 `分:秒.毫秒`，与当前配置逐帧对齐。

配套英文男声音频：[MP3](../outputs/astra-human/astra-human-narration.mp3) · [48 kHz WAV](../outputs/astra-human/astra-human-narration.wav)。音轨与当前视频等长，已逐句核对时间窗口。

## 英文旁白与画面对齐

| 时间段 | 画面 | 旁白正文 |
|---|---|---|
| 00:00.000–00:08.800 | 榜单与开场 | How close is GPT-6-Astra to humans? It leads the evaluated models, but still trails human performance. |
| 00:08.800–00:16.600 | 四维度比较 | Motion perception and spatial reasoning are strong. Outcome prediction and physical dynamics still lag behind. |
| 00:16.600–00:24.133 | 相对速度｜观察与提问 | Which vehicle is moving faster: green or blue? Watch how their positions change over time. |
| 00:24.133–00:31.900 | 相对速度｜答案与重播 | GPT-6-Astra chooses blue, correctly. Its score on relative velocity is slightly above the human baseline. |
| 00:31.900–00:37.400 | 旋转方向｜观察与提问 | Viewed from above, is the person turning clockwise or counterclockwise? |
| 00:37.400–00:43.533 | 旋转方向｜答案与重播 | Counterclockwise is correct. GPT-6-Astra nearly matches human performance on this task. |
| 00:43.533–00:51.967 | 自运动｜观察与提问 | As the camera moves, where does the table end up? Track its position relative to the moving camera. |
| 00:51.967–01:00.633 | 自运动｜答案与重播 | Front-left is correct. On this task, GPT-6-Astra is close to human performance. |
| 01:00.633–01:07.867 | 篮球投篮｜观察与提问 | Now predict the outcome. Will this basketball shot go in? Watch the ball's trajectory. |
| 01:07.867–01:15.933 | 篮球投篮｜答案与重播 | GPT-6-Astra says yes; the answer is no. Humans score much higher on this task. |
| 01:15.933–01:21.167 | 足球射门｜观察与提问 | Ignoring the goalkeeper and defenders, will this free kick go in? |
| 01:21.167–01:26.633 | 足球射门｜答案与重播 | GPT-6-Astra predicts a goal. The correct answer is no. |
| 01:26.633–01:32.733 | 摔倒方向｜观察与提问 | Will they fall left or right? Use the person's own perspective. |
| 01:32.733–01:39.667 | 摔倒方向｜答案与重播 | GPT-6-Astra predicts left, but the answer is right. Overall, it still struggles to predict the future. |

## 讲解时可参考的数据

无需把下表每个数字都念出来，视频画面已给出数值。百分比是对应任务或维度的整体准确率；右侧的 Ground truth 是当前这道题的标准答案。单个案例的对错与整个任务的准确率分别表达。

整体：GPT-6-Astra **80.2%**，Human **91.0%**，相差 **10.8 个百分点**。这里的排名限于本次评测中的模型。

| 四个维度 | GPT-6-Astra | Human | GPT-6-Astra − Human |
|---|---:|---:|---:|
| 运动感知 | 93.3% | 96.2% | -2.9 个百分点 |
| 空间关系 | 88.8% | 96.5% | -7.7 个百分点 |
| 结果预测 | 67.8% | 84.0% | -16.2 个百分点 |
| 物理动态 | 80.3% | 93.9% | -13.6 个百分点 |

| 六个案例对应的任务 | GPT-6-Astra | Human | GPT-6-Astra − Human |
|---|---:|---:|---:|
| 相对速度 | 97.6% | 97.0% | +0.6 个百分点 |
| 旋转方向 | 99.3% | 100.0% | -0.7 个百分点 |
| 自运动 | 93.9% | 99.6% | -5.7 个百分点 |
| 篮球投篮 | 61.3% | 81.5% | -20.2 个百分点 |
| 足球射门 | 69.6% | 82.9% | -13.3 个百分点 |
| 摔倒方向 | 67.4% | 100.0% | -32.6 个百分点 |

表中相对速度得分略高于人类，是当前测试结果的数值比较；不把一个正确案例或小幅分差扩展为所有场景均已超过人类。

## 后续修改

视频节奏修改后，先运行 `npm run video:prepare`，再以生成的设计数据中各案例的 `start_seconds`、`answer_reveal_seconds` 和 `end_seconds` 更新本稿时间码。文案不进入英文视频画面。

切页节奏：本版在每页入场后静置 0.65 秒再开始旁白，句尾在离页前至少留 0.85 秒；相邻页面的旁白间隔至少 1.5 秒。答案揭晓仍与旁白对齐。
