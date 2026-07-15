# ViSTR-Bench 项目网站

这是 ViSTR-Bench 的静态项目网站，包含两个页面：

- `Overview`：论文与基准概览。
- `Leaderboard`：Overall、Public 和 Private 三套模型排行榜。

网站使用原生 HTML、CSS 和 JavaScript，不需要 npm、React、Vue 或构建流程。页面之间通过顶部导航栏切换，并共享主题、导航、表格和响应式样式。

## 本地预览

在仓库根目录启动静态文件服务器：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/index.html
http://localhost:8000/leaderboard.html
```

也可以直接打开 `http://localhost:8000/` 进入 Overview。

Leaderboard 使用浏览器 `fetch` 读取本地 CSV。请通过本地服务器或正式网站访问，不要使用 `file://` 直接打开 HTML，否则浏览器可能阻止 CSV 加载。

## 文件结构

```text
.
├── index.html                    # Overview 页面
├── leaderboard.html              # Leaderboard 页面与表格结构
├── summary_all.csv               # Overall 排行榜数据
├── summary_public.csv            # Public 排行榜数据
├── summary_private.csv           # Private 排行榜数据
├── cologo/
│   └── cologo.png                # 导航栏和 Hero 使用的 Logo
└── static/
    ├── css/
    │   ├── bulma.min.css         # 基础样式
    │   ├── index.css             # 两个页面共享的主要样式
    │   └── leaderboard.css       # Leaderboard 补充样式
    ├── js/
    │   ├── index.js              # 共享交互与 Overview 交互
    │   └── leaderboard.js        # CSV 解析、排行榜与搜索
    ├── images/                   # 任务、流程和结果图片
    ├── videos/                   # 顶部任务示例视频
    └── pdfs/
        └── main.pdf              # Paper 按钮打开的论文 PDF
```

## Overview 页面

Overview 的主体内容位于 `index.html`，当前包含：

1. 项目 Hero、Logo 和论文标题。
2. 作者、机构以及 Paper、Code、Dataset 资源入口。
3. 15 个任务示例组成的视频 Carousel。
4. 基准概览：4 个推理维度、15 个子任务、1,340 个视频问答对和 39 个模型变体。
5. Task Definition：Motion Perception、Spatial Relations、Outcome Prediction 和 Physical Dynamics。
6. Benchmark statistics：任务数量与数据来源的交互式分布图。
7. Construction pipeline：数据收集、视频预处理、QA 生成和人工质量控制。
8. Evaluation Results：关键结果、结果图片、按模型类别整理的主结果表格和结论。
9. Citation 区域与 BibTeX 复制按钮。

页面中的统计配置位于 `index.html` 的 `window.ProjectPageConfig`：

```js
window.ProjectPageConfig = {
  demoAutoplayInterval: 7000,
  distribution: { /* 维度、子任务和数量 */ },
  dataPie: { /* 数据来源数量 */ },
  references: [],
  footer: {
    organization: "Colalab",
    year: 2026
  }
};
```

修改任务数量或数据来源时，应同时检查总数是否仍为 1,340，并保证图表配置、正文和表格中的数字一致。

## Leaderboard 页面

Leaderboard 的页面结构位于 `leaderboard.html`，数据和交互由 `static/js/leaderboard.js` 生成。页面提供：

- Overall、Public、Private 三个标签页。
- 按模型名称搜索。
- 每个数据范围内的全局排名。
- Average、4 个推理维度和 15 个子任务的完整成绩。
- 每一项最高分自动高亮。
- 键盘可操作的标签切换，以及上下同步的横向滚动条。
- 滚动时固定表头和 Method 列，便于浏览右侧任务成绩。
- Public 和 Private 的可分享地址：

```text
leaderboard.html?split=public
leaderboard.html?split=private
```

三个 CSV 的路径直接配置在 `leaderboard.html`：

```html
<main
  data-leaderboard-root
  data-leaderboard-overall-source="summary_all.csv"
  data-leaderboard-public-source="summary_public.csv"
  data-leaderboard-private-source="summary_private.csv"
>
```

当前每个文件包含 39 个模型。Overall 使用全部 1,340 道题，Public 和 Private 各使用 670 道题。

## CSV 数据格式

`summary_all.csv`、`summary_public.csv` 和 `summary_private.csv` 必须使用相同的表头和列顺序。每一行代表一个模型在对应数据范围内的一套完整结果。

### 基本信息与计数

| 字段 | 说明 |
| --- | --- |
| `suite` | 原始实验标识；当前可以保持为 `main` |
| `run_name` | 实验运行名称 |
| `model_id` | 模型或运行标识 |
| `model` | 页面显示的模型名称 |
| `source_kind` | 原始结果来源类型 |
| `total_questions` | 对应数据范围的问题总数 |
| `evaluated_questions` | 实际完成评测的问题数 |
| `missing_questions` | 未完成评测的问题数 |
| `correct` | 回答正确的问题数 |
| `overall_accuracy` | 页面显示的 Average accuracy (%) |
| `evaluated_accuracy` | 原始统计中的已评测准确率 |

页面根据文件来源确定 Overall、Public 或 Private，因此三个文件中的 `suite` 均可继续使用 `main`。

### 四个推理维度

```text
Motion_Perception
Spatial_Relations
Outcome_Prediction
Physical_Dynamics
```

### 十五个子任务

```text
Vehicle_Movement
Relative_Velocity
Rotation_Direction
Ego_Motion
Passage_Feasibility
Interaction_Direction
Basketball_Shot
Soccer_Shot
Golf_Shot
Billiards_Shot
Swimming_Race
Fall_Direction
Jenga_Stability
Mikado_Dependency
Knot_Type
```

`result_dir` 和 `warnings` 用于保留原始实验信息，当前页面不会展示它们。

所有 Average、维度和子任务成绩都应为有效数字。缺少任意成绩的行会被排行榜过滤，并在浏览器控制台产生警告。

## 排名规则

每个标签页分别对自身的全部模型排名：

1. 优先使用 `correct / evaluated_questions` 计算未四舍五入的精确准确率。
2. 按精确准确率从高到低排序。
3. 精确准确率完全相同的模型并列，后续名次采用竞赛排名方式。例如 `1, 2, 2, 4`。
4. 精确准确率相同的模型按模型名称排序，保证展示顺序稳定。
5. 表格中的 Average 仍读取 `overall_accuracy`，并显示一位小数。

因此，两个模型即使显示相同的一位小数 Average，也可能因为精确正确率不同而具有不同排名。为保证排名准确，新数据必须填写正确的 `correct` 和 `evaluated_questions`。

## 添加新模型

完成一个新模型的 Overall、Public 和 Private 评测后：

1. 分别在 `summary_all.csv`、`summary_public.csv` 和 `summary_private.csv` 末尾追加一行。
2. 三个文件使用完全一致的 `model` 名称。
3. 填写对应范围的 `total_questions`、`evaluated_questions`、`missing_questions` 和 `correct`。
4. 填写 `overall_accuracy`、4 个推理维度和 15 个子任务的全部成绩。
5. 保持 CSV 表头、字段顺序和逗号转义格式不变。
6. 启动本地服务器并刷新 Leaderboard，检查三个标签页的模型数量、排名和成绩。

不需要修改 `leaderboard.html` 或 JavaScript；页面会自动读取新行、重新排名并计算每列最高分。

建议同时检查：

- Overall、Public 和 Private 中没有重复模型名称。
- `evaluated_questions + missing_questions = total_questions`。
- Overall 的 `correct` 与 Public、Private 的结果关系符合评测数据定义。
- 所有准确率均在合理范围内，并与原始实验结果一致。

## 修改文字、链接和资源

### 导航与页面文字

- 两个页面的导航分别位于 `index.html` 和 `leaderboard.html`。
- 修改导航名称或链接时，要同步修改两个文件。
- Overview 的标题、作者、机构、正文和结果表格直接在 `index.html` 中编辑。
- Leaderboard 的标题、联系邮箱和表头直接在 `leaderboard.html` 中编辑。

### Logo

导航栏和 Hero 使用：

```text
cologo/cologo.png
```

可以替换同名文件，也可以同步修改两个 HTML 中的路径。

### 图片

当前 Overview 使用：

```text
static/images/task-definition-1.png
static/images/construction-pipeline-1.png
static/images/radar-results-1.png
```

替换图片时应保留清晰的 `alt` 文本，并检查浅色和深色主题下的可读性。

### 视频

任务示例视频位于 `static/videos/`。每个示例在 `index.html` 中使用：

```html
<video muted loop playsinline preload="none">
  <source src="static/videos/example.mp4" type="video/mp4">
</video>
```

Carousel 会只为当前可见的示例加载并播放视频；离开可视区域或打开预览时，后台视频会暂停。替换视频时同步更新任务名称、问题、正确答案和三个模型的回答状态。推荐使用 MP4/H.264，并控制文件大小。

### 论文和外部资源

- Paper 按钮指向 `static/pdfs/main.pdf`。
- Code 和 Dataset 地址位于 `index.html` 的 `.resource-card` 链接中。
- 发布前确认外部仓库和数据集允许匿名访问。
- Citation 的 BibTeX 内容位于 `index.html` 的 `#bibtex-code` 中。

## 主题与响应式布局

网站默认跟随系统浅色或深色主题，用户选择保存在：

```text
localStorage["colalab-project-theme"]
```

两个页面共享 `static/css/index.css`。`static/css/leaderboard.css` 仅补充排行榜标签、搜索框、超宽表格和移动端布局。

响应式行为包括：

- 桌面端导航相对页面居中。
- 小屏幕下导航和控件重新排列。
- Overview 卡片和内容区按屏幕宽度调整列数。
- Leaderboard 在窄屏中保留横向滚动和固定 Method 列，避免压缩任务列或丢失模型名称。

修改颜色、间距或导航时，应同时检查 Overview 与 Leaderboard，避免两个页面出现不一致。

## 发布前检查

- [ ] Overview 和 Leaderboard 的导航链接、激活状态与标题正确。
- [ ] Paper、Code、Dataset 和联系邮箱可用。
- [ ] Citation 区域包含最终 BibTeX，复制按钮能够复制有效内容。
- [ ] 三个 CSV 均可加载，字段完整，且模型数量符合预期。
- [ ] Overall、Public 和 Private 排名与精确正确率一致。
- [ ] Overview 的统计数字、图表和结果表格与论文一致。
- [ ] 任务示例的视频、问题、答案和正确/错误状态一致。
- [ ] 浅色模式和深色模式下文字、标签、表格均清晰可见。
- [ ] 桌面端和移动端布局均无重叠或溢出问题。
- [ ] 浏览器控制台没有 CSV、脚本或资源加载错误。

## 发布到 GitHub Pages

1. 将网站文件提交并推送到 GitHub 仓库。
2. 打开仓库的 `Settings` → `Pages`。
3. 在 `Build and deployment` 中选择 `Deploy from a branch`。
4. 选择用于发布的分支，例如 `main`，目录选择 `/ (root)`。
5. 保存设置并等待部署完成。
6. 使用公开地址重新执行发布前检查，尤其确认 CSV、视频、PDF 和外部链接可以访问。

项目已经包含 `.nojekyll`，GitHub Pages 会直接按当前静态文件结构发布。所有页面和资源使用相对路径，因此应保持现有目录结构和文件名大小写。
