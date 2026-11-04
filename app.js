// ===== 設定・状態 =====
const STORAGE_KEY = "chinalanguage-learned";
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  category: PHRASE_CATEGORIES[0].id,
  rate: 0.8,
  learned: loadLearned(),
  quiz: { answer: null, correct: 0, total: 0, answered: false },
};

function loadLearned() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  } catch {
    return new Set();
  }
}

function saveLearned() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.learned]));
  } catch {
    // 保存できなくてもアプリは動かす
  }
}

const allPhrases = PHRASE_CATEGORIES.flatMap((c) => c.items);

// ===== 自分で追加した単語（translate.js で翻訳して追加する） =====
// PHRASE_CATEGORIES には入れない（昇級審査 dojo.js の出題に、確かめていない単語が混ざらないように）
const CUSTOM_STORAGE_KEY = "chinalanguage-custom-words";
const CUSTOM_CATEGORY = { id: "custom", name: "📝 自分で追加", items: loadCustomWords() };

function loadCustomWords() {
  try {
    const words = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY)) || [];
    return words.filter((w) => w && typeof w.zh === "string" && typeof w.py === "string" && typeof w.ja === "string");
  } catch {
    return [];
  }
}

function saveCustomWords() {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(CUSTOM_CATEGORY.items));
  } catch {
    // 保存できなくてもアプリは動かす
  }
}

function addCustomWord({ zh, py, ja }) {
  CUSTOM_CATEGORY.items.push({ zh, py, ja });
  saveCustomWords();
}

function removeCustomWord(zh) {
  CUSTOM_CATEGORY.items = CUSTOM_CATEGORY.items.filter((w) => w.zh !== zh);
  saveCustomWords();
  state.learned.delete(zh);
  saveLearned();
}

// フレーズ画面のカテゴリ（最後に「自分で追加」）
function phraseCategories() {
  return [...PHRASE_CATEGORIES, CUSTOM_CATEGORY];
}

// 練習・クイズに使うフレーズ（もとのフレーズ ＋ 自分で追加した単語）
function studyPhrases() {
  return [...allPhrases, ...CUSTOM_CATEGORY.items];
}

// 自分で入力した文字を、HTML として表示しても安全にする
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 「写真で単語」の花・動物（data/objects.js）。覚えたものだけクイズに出す
const natureWords = NATURE_CATEGORIES.flatMap((c) => c.items.map((w) => ({ ...w, category: c.id })));

function quizPool() {
  return [...studyPhrases(), ...natureWords.filter((w) => state.learned.has(w.zh))];
}

// ===== 音声（読み上げ） =====
let chineseVoice = null;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  chineseVoice =
    voices.find((v) => v.lang === "zh-CN") ||
    voices.find((v) => v.lang.startsWith("zh")) ||
    null;
}

function speak(text) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = state.rate;
  if (chineseVoice) u.voice = chineseVoice;
  speechSynthesis.speak(u);
}

// ===== 音声認識（発音チェック） =====
function normalize(text) {
  return text.replace(/[\s，。！？、,.!?]/g, "");
}

// 2つの文字列がどれくらい似ているか（0〜100）
function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a.length && !b.length) return 100;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return Math.round((1 - dp[a.length][b.length] / Math.max(a.length, b.length)) * 100);
}

// 今動いている音声認識（同時に2つ動かさないため。talk.js でも使う）
let currentRecognition = null;

function startRecognition(rec) {
  if (currentRecognition) currentRecognition.abort(); // 前の録音は止める
  currentRecognition = rec;
  rec.addEventListener("end", () => {
    if (currentRecognition === rec) currentRecognition = null;
  });
  rec.start();
}

// 音声認識のエラーを、原因がわかる文にする
function micErrorMessage(error) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "マイクの使用が許可されていません。ブラウザの設定を確認してください";
    case "network":
      return "インターネットに接続されていません。🎤を使うにはインターネット接続が必要です";
    case "no-speech":
      return "声が聞こえませんでした。マイクに近づいて話してみてください";
    case "audio-capture":
      return "マイクが見つかりません。マイクがつながっているか確認してください";
    default:
      return "うまく聞き取れませんでした。もう一度試してください";
  }
}

function listen(target, button, feedbackEl) {
  // 聞いている最中にもう一度押したら、録音を止める
  if (button.classList.contains("recording")) {
    currentRecognition?.stop();
    return;
  }
  if (!navigator.onLine) {
    feedbackEl.className = "feedback ng";
    feedbackEl.textContent = micErrorMessage("network");
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = "zh-CN";
  rec.maxAlternatives = 3;

  button.classList.add("recording");
  button.textContent = "● 聞いています…";
  feedbackEl.className = "feedback";
  feedbackEl.textContent = "中国語で話してください";

  rec.onresult = (e) => {
    const candidates = [...e.results[0]].map((r) => r.transcript);
    const best = candidates
      .map((t) => ({ text: t, score: similarity(t, target.zh) }))
      .sort((x, y) => y.score - x.score)[0];

    if (best.score >= 80) {
      feedbackEl.className = "feedback ok";
      feedbackEl.textContent = `よくできました！（${best.score}点）認識結果: ${best.text}`;
      state.learned.add(target.zh);
      saveLearned();
      renderPhrases();
    } else {
      feedbackEl.className = "feedback ng";
      feedbackEl.textContent = `おしい！（${best.score}点）認識結果: ${best.text}　もう一度お手本を聞いてみよう`;
    }
  };
  rec.onerror = (e) => {
    if (e.error === "aborted") {
      // ほかの🎤が押されて止めたときは、何も出さない
      feedbackEl.className = "feedback";
      feedbackEl.textContent = "";
      return;
    }
    feedbackEl.className = "feedback ng";
    feedbackEl.textContent = micErrorMessage(e.error);
  };
  rec.onend = () => {
    button.classList.remove("recording");
    button.textContent = "🎤 話してみる";
    // 何も話さずに止めたときは「中国語で話してください」を消す
    if (feedbackEl.textContent === "中国語で話してください") feedbackEl.textContent = "";
  };
  startRecognition(rec);
}

// ===== フレーズ画面 =====
function renderCategories() {
  const el = document.getElementById("categories");
  el.innerHTML = "";
  for (const c of phraseCategories()) {
    const btn = document.createElement("button");
    btn.className = "btn" + (c.id === state.category ? " active" : "");
    btn.textContent = c.name;
    btn.onclick = () => {
      state.category = c.id;
      renderCategories();
      renderPhrases();
    };
    el.appendChild(btn);
  }
}

function renderPhrases() {
  const category = phraseCategories().find((c) => c.id === state.category);
  const isCustom = category.id === CUSTOM_CATEGORY.id;
  const list = document.getElementById("phrase-list");
  list.innerHTML = "";

  // 「自分で追加」のときだけ、翻訳して追加する欄を出す（translate.js）
  document.getElementById("custom-add").hidden = !isCustom;
  if (isCustom && !category.items.length) {
    list.innerHTML = '<p class="hint">まだ追加した単語はありません。上の欄に日本語を入れて翻訳してみよう。</p>';
  }

  for (const p of category.items) {
    const learned = state.learned.has(p.zh);
    const card = document.createElement("div");
    card.className = "phrase-card" + (learned ? " learned" : "");
    card.innerHTML = `
      <p class="phrase-zh">${escapeHtml(p.zh)}</p>
      <p class="phrase-py">${escapeHtml(p.py)}</p>
      <p class="phrase-ja">${escapeHtml(p.ja)}</p>
      <div class="phrase-actions">
        <button class="btn primary" data-action="play">🔊 聞く</button>
        <button class="btn" data-action="listen">🎤 話してみる</button>
        <button class="btn" data-action="toggle">${learned ? "✓ 覚えた" : "覚えた"}</button>
        ${isCustom ? '<button class="btn" data-action="delete">🗑 削除</button>' : ""}
      </div>
      <p class="feedback"></p>
    `;
    const feedbackEl = card.querySelector(".feedback");
    const micBtn = card.querySelector('[data-action="listen"]');

    card.querySelector('[data-action="play"]').onclick = () => speak(p.zh);
    if (SpeechRecognition) {
      micBtn.onclick = () => listen(p, micBtn, feedbackEl);
    } else {
      micBtn.disabled = true;
    }
    card.querySelector('[data-action="toggle"]').onclick = () => {
      learned ? state.learned.delete(p.zh) : state.learned.add(p.zh);
      saveLearned();
      renderPhrases();
    };
    if (isCustom) {
      card.querySelector('[data-action="delete"]').onclick = () => {
        if (!confirm(`「${p.zh}」を削除しますか？`)) return;
        removeCustomWord(p.zh);
        renderPhrases();
      };
    }
    list.appendChild(card);
  }
  renderProgress();
}

function renderProgress() {
  const phrases = studyPhrases();
  const count = phrases.filter((p) => state.learned.has(p.zh)).length;
  document.getElementById("progress").textContent = `覚えたフレーズ: ${count} / ${phrases.length}`;
}

// ===== クイズ画面 =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextQuiz() {
  const q = state.quiz;
  const pool = quizPool();
  q.answer = pool[Math.floor(Math.random() * pool.length)];
  q.answered = false;

  // まちがいの選択肢は同じ種類から（花の問題なら別の花、フレーズならほかのフレーズ）
  const sameKind = q.answer.category
    ? natureWords.filter((w) => w.category === q.answer.category)
    : studyPhrases();
  const others = shuffle(sameKind.filter((p) => p !== q.answer)).slice(0, 3);
  const options = shuffle([q.answer, ...others]);

  document.getElementById("quiz-question").textContent = q.answer.ja;
  document.getElementById("quiz-result").textContent = "";

  const box = document.getElementById("quiz-options");
  box.innerHTML = "";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.dataset.zh = opt.zh;
    btn.innerHTML = `${escapeHtml(opt.zh)}<small>${escapeHtml(opt.py)}</small>`;
    btn.onclick = () => answerQuiz(opt, btn);
    box.appendChild(btn);
  }
  renderQuizScore();
}

function answerQuiz(choice, btn) {
  const q = state.quiz;
  if (q.answered) return;
  q.answered = true;
  q.total++;

  const result = document.getElementById("quiz-result");
  if (choice === q.answer) {
    q.correct++;
    btn.classList.add("correct");
    result.textContent = "正解！声に出して言ってみよう";
  } else {
    btn.classList.add("wrong");
    [...document.querySelectorAll(".quiz-option")]
      .find((b) => b.dataset.zh === q.answer.zh)
      .classList.add("correct");
    result.textContent = `残念… 正解は「${q.answer.zh}」`;
  }
  speak(q.answer.zh);
  renderQuizScore();
}

function renderQuizScore() {
  const q = state.quiz;
  document.getElementById("quiz-score").textContent = `正解数: ${q.correct} / ${q.total}`;
}

// ===== 声調画面 =====
function renderTones() {
  const list = document.getElementById("tone-list");
  for (const t of TONES) {
    const card = document.createElement("div");
    card.className = "tone-card";
    card.innerHTML = `
      <p class="tone-zh">${t.zh}</p>
      <p class="phrase-py">${t.py}（${t.ja}）</p>
      <p class="tone-name">${t.tone}</p>
      <p class="tone-desc">${t.desc}</p>
    `;
    card.onclick = () => speak(t.zh);
    list.appendChild(card);
  }
}

// ===== タブ切り替え・初期化 =====
function showView(name) {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.view === name);
  }
  for (const view of document.querySelectorAll(".view")) {
    view.hidden = view.id !== `view-${name}`;
  }
  if (name === "quiz" && !state.quiz.answer) nextQuiz();
}

function init() {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;

  const rate = document.getElementById("rate");
  rate.oninput = () => {
    state.rate = Number(rate.value);
    document.getElementById("rate-value").textContent = rate.value;
  };

  for (const tab of document.querySelectorAll(".tab")) {
    tab.onclick = () => showView(tab.dataset.view);
  }
  document.getElementById("quiz-next").onclick = nextQuiz;

  if (!SpeechRecognition) {
    const w = document.getElementById("support-warning");
    w.hidden = false;
    w.textContent = "このブラウザは音声認識に対応していません。「話してみる」を使うには Chrome か Edge で開いてください。";
  }

  renderCategories();
  renderPhrases();
  renderTones();
}

init();
