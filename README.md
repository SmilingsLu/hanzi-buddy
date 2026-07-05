# 小学语文生字学习伙伴 (ShengZi Buddy)

Interactive Chinese character learning app for primary school students (Grades 1-6), covering the 人教版 (PEP) curriculum with ~2,864 characters.

## Features

- **Learning Mode**: 3D flip cards with pinyin, words, and example sentences
- **Challenge Mode**: Pinyin quiz (看汉字选拼音) with scoring, streaks, and badges
- **Error Book**: Auto-collects wrong answers, remove after 2 consecutive correct
- **Favorites**: Heart-save characters for focused review
- **Badges**: Achievement system (初次挑战, 百发百中, 识字达人)
- **Speech**: Browser TTS reads characters aloud (Mandarin)
- **Responsive**: Works on phone, tablet, and desktop

## Quick Start

```bash
# No build tools needed — just serve the files
cd shengzi-buddy
python3 -m http.server 8080
# Open http://localhost:8080
```

Or drag the folder to any static hosting (Netlify, GitHub Pages, Vercel).

## Project Structure

```
shengzi-buddy/
├── index.html         — HTML structure (no logic)
├── config.json        — Tunable parameters (quiz length, timings, badges)
├── css/style.css      — Design system (tokens, components, responsive)
├── js/
│   ├── state.js       — State management (single source of truth)
│   ├── data.js        — Data loading, filtering, quiz generation
│   ├── services.js    — Side effects (speech, badges, favorites, errors, stats)
│   ├── ui.js          — UI rendering (DOM updates only, no logic)
│   └── controllers.js — Event handling, connects state↔data↔UI
└── data/
    ├── grade1-semester1.json   (Grade 1 upper, 186 chars)
    ├── grade1-semester2.json   (Grade 1 lower, 287 chars)
    ├── ...                     (12 files total)
    └── grade6-semester2.json   (Grade 6 lower, 115 chars)
```

## Adding Data

Drop a JSON file in `data/` with this format:

```json
{
  "grade": 2,
  "semester": 1,
  "lessons": [
    {
      "id": "2-1-1",
      "title": "课文1《小蝌蚪找妈妈》",
      "chars": [
        {"char": "塘", "pinyin": "táng", "words": ["池塘","鱼塘"], "sentence": "池塘里有一群小蝌蚪。"}
      ]
    }
  ]
}
```

File naming: `grade{N}-semester{M}.json` (auto-discovered, no code changes needed).

## Configuration

Edit `config.json` to adjust:
- `questionsPerRound` — Number of quiz questions (default: 10)
- `quizFeedbackDelayMs` — Delay before next question (default: 1200ms)
- `streakThresholdForFire` — Streak count for fire animation (default: 3)
- `speech.rate` — TTS speed (default: 0.8)
- `badges` — Badge definitions (id, emoji, name, condition)
- `encourageMessages` — End-of-round messages by score

## Browser Support

- Chrome / Edge 88+
- Safari 14+ (iOS / macOS)
- Firefox 85+
- WeChat browser

## Tech Stack

- Pure HTML / CSS / JavaScript (no frameworks, no build tools)
- CSS Custom Properties for theming
- Web Speech API for TTS
- localStorage for persistence
- ES Modules (IIFE pattern for browser compatibility)

## License

MIT
