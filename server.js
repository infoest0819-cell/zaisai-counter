const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PROMPT = `あなたは土木・建設現場の資材管理の専門家です。
この写真に写っている建設資材を特定して数えてください。

主な対象資材：
- コンクリートブロック（各種サイズ・種類）
- ヒューム管・コンクリート管
- U字溝・側溝ブロック・縁石
- 鉄筋（束・本単位）
- 型枠・合板
- 砂袋・土嚢
- その他の建設資材

回答はJSON形式のみで返してください（説明文・前置き一切不要）：
{
  "items": [
    {
      "name": "資材名（具体的に）",
      "count": 数量（整数）,
      "unit": "本/枚/個/束/袋など",
      "confidence": "high/medium/low",
      "notes": "補足（積み重なりで見えにくい等）"
    }
  ],
  "overall_notes": "全体の状況や注意点"
}

confidence の基準：
- high: はっきり数えられた
- medium: 一部見えにくいが概ね正確
- low: 積み重なりや陰で概算`;

app.post('/api/analyze', async (req, res) => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: '画像データがありません' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'サーバーにAPIキーが設定されていません' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: PROMPT }
            ]
          }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || 'Gemini APIエラー' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'AIから応答を取得できませんでした' });

    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: 'AIの回答を解析できませんでした' });

    res.json(JSON.parse(m[0]));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// フロントエンドのルーティング（全てindex.htmlを返す）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`資材カウンター サーバー起動中 → http://localhost:${PORT}`);
});
