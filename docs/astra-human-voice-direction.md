# 英文科研讲解男声方向

本片采用清晰、自然、有对话感的科研讲解方向：中音区，轻微好奇感，问题句和转折处有适度起伏；语速稍快，句尾不刻意拖长。保留专业、准确的表达。

科研配音没有唯一音色。参考分类里既有成熟、沉着的教授型，也有自然、有热情的研究者和讲解型；本片选择后者的表达特点，避免上一版过于庄重的感觉。

## 当前选型

- 已选音色：Microsoft `en-US-AndrewNeural`，美式男声；服务目录标签为 Conversation / Warm / Confident / Authentic。
- 基础速度相对于默认值 +6%，音高 +2 Hz；逐句不得超出画面时间窗口。
- 旁白模型名统一写作 `GPT-6-Astra`，语音读作 `G P T six Astra`。
- 画面不重新编码，换音后重新合入现有 4K 视频。
- 在线合成需发送英文讲稿到语音服务；用户已明确允许将这份英文旁白发送给 Microsoft 在线语音服务。离线方案使用本机语音。

## 参考来源

- [ElevenLabs Scientific voices](https://elevenlabs.io/voice-library/scientific)：不同科研讲解风格的音色、节奏与表达描述；仅作为风格参考，并非本片使用的合成服务。
- [ElevenLabs Voice Library](https://elevenlabs.io/docs/eleven-creative/voices/voice-library)：Conversational、Educational 等分类，以及年龄、口音、性别等筛选维度。
- [Microsoft speech voice / SSML](https://learn.microsoft.com/en-au/azure/ai-services/speech-service/speech-synthesis-markup-voice)：语音及节奏控制资料。
- [edge-tts 项目](https://github.com/rany2/edge-tts)：当前在线音色的调用工具。
