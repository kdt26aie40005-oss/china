// ===== シナリオ会話 =====
// app.js の speak() / normalize() / similarity() / SpeechRecognition と
// data/phrases.js の TONES を使う

const TALK_STORAGE_KEY = "chinalanguage-talk-results";
const PASS_SCORE = 75;
const PUNCTUATION = /[\s，。！？、,.!?＿]/;

const TALK_TEXT = {
  ja: {
    turns: "回のやりとり",
    cleared: "クリア",
    back: "← シナリオ一覧",
    speak: "🎤 話す",
    listening: "● 聞いています…",
    send: "送信",
    placeholder: "中国語で入力して Enter",
    hint: "💡 ヒント",
    skip: "⏭ スキップ",
    yourTurn: "あなたの番です。中国語で返事をしよう",
    examples: "返事の例",
    pass: (s) => `✅ 伝わりました！（${s}点）`,
    fail: (s) => `❌ おしい！（${s}点）`,
    missed: "赤い字がうまく伝わらなかったかもしれません。",
    toneTip: (ch, py, tone, desc) => `「${ch}」${py}（${tone}）：${desc}`,
    needName: "「＿＿」のところに自分の名前を入れて言ってみよう",
    retry: "🔊でお手本を聞いて、もう一度言ってみよう",
    skipped: "スキップしました。お手本：",
    finish: "会話クリア！",
    result: (ok, all) => `1回で伝わった返事：${ok} / ${all}`,
    again: "もう一度",
    toMenu: "ほかのシナリオへ",
    micError: "うまく聞き取れませんでした。もう一度試してください",
    micDenied: "マイクの使用が許可されていません。ブラウザの設定を確認してください",
    noMic: "このブラウザは音声認識に対応していません。文字で入力してください",
  },
  zh: {
    turns: "轮对话",
    cleared: "已完成",
    back: "← 场景列表",
    speak: "🎤 说",
    listening: "● 正在听…",
    send: "发送",
    placeholder: "用中文输入，按 Enter",
    hint: "💡 提示",
    skip: "⏭ 跳过",
    yourTurn: "轮到你了，用中文回答吧",
    examples: "参考回答",
    pass: (s) => `✅ 对方听懂了！（${s}分）`,
    fail: (s) => `❌ 差一点！（${s}分）`,
    missed: "红色的字可能没说清楚。",
    toneTip: (ch, py, tone) => `“${ch}” ${py}（${tone}）`,
    needName: "在“＿＿”的地方说你的名字吧",
    retry: "听一下示范，再说一遍吧",
    skipped: "已跳过。示范：",
    finish: "对话完成！",
    result: (ok, all) => `一次就说对的回答：${ok} / ${all}`,
    again: "再来一次",
    toMenu: "选择其他场景",
    micError: "没听清楚，请再试一次",
    micDenied: "没有麦克风权限，请检查浏览器设置",
    noMic: "这个浏览器不支持语音识别，请用文字输入",
  },
};

const TONE_NAMES = { ja: ["第1声", "第2声", "第3声", "第4声", "軽声"], zh: ["第一声", "第二声", "第三声", "第四声", "轻声"] };
const TONE_MARKS = ["āēīōūǖĀĒĪŌŪ", "áéíóúǘÁÉÍÓÚ", "ǎěǐǒǔǚǍĚǏǑǓ", "àèìòùǜÀÈÌÒÙ"];

const talk = {
  scenario: null,
  stepIndex: 0,
  tries: 0,
  firstTryCount: 0,
  waiting: false, // 返事を受け付けているか
  timer: null, // 次のセリフへ進むタイマー
};

const talkEls = {
  menu: document.getElementById("talk-menu"),
  list: document.getElementById("talk-list"),
  lang: document.getElementById("talk-lang"),
  stage: document.getElementById("talk-stage"),
  title: document.getElementById("talk-title"),
  back: document.getElementById("talk-back"),
  log: document.getElementById("talk-log"),
  turn: document.getElementById("talk-turn"),
  turnLabel: document.getElementById("talk-turn-label"),
  mic: document.getElementById("talk-mic"),
  input: document.getElementById("talk-input"),
  send: document.getElementById("talk-send"),
  hintBtn: document.getElementById("talk-hint-btn"),
  skip: document.getElementById("talk-skip"),
  hintBox: document.getElementById("talk-hint"),
  status: document.getElementById("talk-status"),
};

function t() {
  return TALK_TEXT[talkEls.lang.value];
}

function lang() {
  return talkEls.lang.value;
}

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== 保存 =====
function loadResults() {
  try {
    return JSON.parse(localStorage.getItem(TALK_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveResult(id, firstTry) {
  const results = loadResults();
  results[id] = Math.max(results[id] || 0, firstTry);
  try {
    localStorage.setItem(TALK_STORAGE_KEY, JSON.stringify(results));
  } catch {
    // 保存できなくても続ける
  }
}

// ===== 判定 =====
function toneOf(syllable) {
  for (let i = 0; i < 4; i++) {
    if ([...syllable].some((c) => TONE_MARKS[i].includes(c))) return i;
  }
  return 4; // 軽声
}

// 返事の候補1つと、聞き取った文字を比べる
function scoreAnswer(answer, heard) {
  const [zh] = answer;
  const said = normalize(heard);
  if (zh.includes("＿")) {
    // 「我叫＿＿。」のような自由に言う部分がある返事
    const prefix = normalize(zh.split("＿")[0]);
    const head = said.slice(0, prefix.length);
    const score = similarity(prefix, head);
    const hasName = said.length > prefix.length;
    return { score: hasName ? score : Math.min(score, PASS_SCORE - 1), target: prefix, said: head, needName: !hasName };
  }
  return { score: similarity(zh, said), target: normalize(zh), said, needName: false };
}

// 一番近い返事を探す
function judge(step, candidates) {
  let best = null;
  for (const heard of candidates) {
    for (const answer of step.answers) {
      const r = { ...scoreAnswer(answer, heard), answer, heard };
      if (!best || r.score > best.score) best = r;
    }
  }
  return best;
}

// お手本のうち、聞き取った文字に含まれなかった文字の位置（LCS で対応を取る）
function missedIndexes(target, said) {
  const a = [...target];
  const b = [...said];
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Set();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      matched.add(i);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return a.map((_, k) => k).filter((k) => !matched.has(k));
}

// お手本の文を、伝わらなかった字を赤くして表示する
function renderWithMissed(zh, missed) {
  let k = 0;
  return [...zh]
    .map((ch) => {
      if (PUNCTUATION.test(ch)) return esc(ch);
      const html = missed.includes(k) ? `<span class="missed">${esc(ch)}</span>` : esc(ch);
      k++;
      return html;
    })
    .join("");
}

function feedbackHtml(result) {
  const text = t();
  const [zh, py] = result.answer;
  if (result.needName && result.score >= PASS_SCORE - 1) {
    return `<p>${text.needName}</p>`;
  }
  const missed = missedIndexes(result.target, result.said);
  const syllables = py.split(/\s+/);
  const tips = missed.slice(0, 3).map((k) => {
    const ch = [...result.target][k];
    const syl = syllables[k] || "";
    const tone = toneOf(syl);
    const desc = tone < 4 ? TONES[tone].desc : "軽く短く添える";
    return `<li>${esc(text.toneTip(ch, syl, TONE_NAMES[lang()][tone], desc))}</li>`;
  });
  return `
    <p class="talk-model">${renderWithMissed(zh, missed)} <small>${esc(py)}</small></p>
    <p>${text.missed}</p>
    ${tips.length ? `<ul class="talk-tips">${tips.join("")}</ul>` : ""}
    <p>${text.retry}</p>
    <button class="btn" data-say="${esc(zh.replace(/＿/g, ""))}">🔊</button>
  `;
}

// ===== 表示 =====
function renderMenu() {
  const text = t();
  const results = loadResults();
  talkEls.list.innerHTML = "";
  for (const s of SCENARIOS) {
    const card = document.createElement("button");
    card.className = "talk-card";
    const done = results[s.id] !== undefined;
    card.innerHTML = `
      <span class="talk-card-icon">${s.partner.icon}</span>
      <span class="talk-card-title">${esc(s.title[lang()])}</span>
      <span class="talk-card-sub">${esc(s.partner[lang()])} ・ ${s.steps.length}${text.turns}</span>
      ${done ? `<span class="talk-card-done">✓ ${text.cleared} ${results[s.id]}/${s.steps.length}</span>` : ""}
    `;
    card.onclick = () => startScenario(s);
    talkEls.list.appendChild(card);
  }
}

function renderLabels() {
  const text = t();
  talkEls.back.textContent = text.back;
  talkEls.mic.textContent = text.speak;
  talkEls.send.textContent = text.send;
  talkEls.input.placeholder = text.placeholder;
  talkEls.hintBtn.textContent = text.hint;
  talkEls.skip.textContent = text.skip;
  talkEls.turnLabel.textContent = text.yourTurn;
  if (talk.scenario) talkEls.title.textContent = `${talk.scenario.partner.icon} ${talk.scenario.title[lang()]}`;
}

function scrollToEnd(el) {
  el.scrollIntoView({ behavior: "smooth", block: "end" });
}

function addPartnerLine(step) {
  const el = document.createElement("div");
  el.className = "chat-msg ai";
  el.innerHTML = `
    <p class="talk-who">${esc(talk.scenario.partner[lang()])}</p>
    <p class="chat-zh">${esc(step.zh)}</p>
    <p class="phrase-py">${esc(step.py)}</p>
    ${lang() === "ja" ? `<p class="phrase-ja">${esc(step.ja)}</p>` : ""}
    <button class="btn" data-say="${esc(step.zh)}">🔊</button>
  `;
  talkEls.log.appendChild(el);
  scrollToEnd(el);
  speak(step.zh);
}

function addUserLine(heard, result, passed) {
  const text = t();
  const el = document.createElement("div");
  el.className = "chat-msg user";
  el.innerHTML = `
    <p class="chat-zh">${esc(heard)}</p>
    <div class="chat-feedback ${passed ? "ok" : ""}">
      <p class="chat-feedback-title">${passed ? text.pass(result.score) : text.fail(result.score)}</p>
      ${passed ? "" : feedbackHtml(result)}
    </div>
  `;
  talkEls.log.appendChild(el);
  scrollToEnd(el);
}

function renderHint(step) {
  const text = t();
  const items = step.answers
    .map(
      ([zh, py, ja]) => `
      <li>
        <button class="btn" data-say="${esc(zh.replace(/＿/g, ""))}">🔊</button>
        <span class="chat-zh-small">${esc(zh)}</span>
        <small class="phrase-py">${esc(py)}</small>
        ${lang() === "ja" ? `<small class="phrase-ja">${esc(ja)}</small>` : ""}
      </li>`
    )
    .join("");
  talkEls.hintBox.innerHTML = `<p><b>${esc(step.hint[lang()])}</b></p><p>${text.examples}</p><ul class="talk-examples">${items}</ul>`;
  talkEls.hintBox.hidden = false;
}

// ===== 進行 =====
function startScenario(scenario) {
  clearTimeout(talk.timer);
  talk.scenario = scenario;
  talk.stepIndex = 0;
  talk.firstTryCount = 0;
  talkEls.menu.hidden = true;
  talkEls.stage.hidden = false;
  talkEls.log.innerHTML = "";
  renderLabels();
  showStep();
}

function currentStep() {
  return talk.scenario.steps[talk.stepIndex];
}

function showStep() {
  talk.tries = 0;
  talk.waiting = true;
  talkEls.hintBox.hidden = true;
  talkEls.status.textContent = "";
  talkEls.turn.hidden = false;
  addPartnerLine(currentStep());
}

function answer(candidates) {
  if (!talk.waiting || !candidates.length) return;
  const step = currentStep();
  const result = judge(step, candidates);
  const passed = result.score >= PASS_SCORE;
  addUserLine(result.heard, result, passed);

  if (passed) {
    if (talk.tries === 0) talk.firstTryCount++;
    nextStep();
  } else {
    talk.tries++;
    if (talk.tries >= 2) renderHint(step); // 2回まちがえたらヒントを出す
  }
}

function skipStep() {
  if (!talk.waiting) return;
  const [zh, py] = currentStep().answers[0];
  const el = document.createElement("div");
  el.className = "chat-msg user skipped";
  el.innerHTML = `
    <p>${t().skipped}</p>
    <p class="chat-zh">${esc(zh)}</p>
    <p class="phrase-py">${esc(py)}</p>
    <button class="btn" data-say="${esc(zh.replace(/＿/g, ""))}">🔊</button>
  `;
  talkEls.log.appendChild(el);
  scrollToEnd(el);
  speak(zh.replace(/＿/g, ""));
  nextStep(2500);
}

function nextStep(delay = 1200) {
  talk.waiting = false;
  talkEls.turn.hidden = true;
  talk.timer = setTimeout(() => {
    talk.stepIndex++;
    if (talk.stepIndex < talk.scenario.steps.length) {
      showStep();
    } else {
      finish();
    }
  }, delay);
}

function finish() {
  const text = t();
  const all = talk.scenario.steps.length;
  saveResult(talk.scenario.id, talk.firstTryCount);
  const el = document.createElement("div");
  el.className = "talk-finish";
  el.innerHTML = `
    <p class="talk-finish-title">🎉 ${text.finish}</p>
    <p>${text.result(talk.firstTryCount, all)}</p>
    <div class="phrase-actions">
      <button class="btn primary" data-action="again">${text.again}</button>
      <button class="btn" data-action="menu">${text.toMenu}</button>
    </div>
  `;
  el.querySelector('[data-action="again"]').onclick = () => startScenario(talk.scenario);
  el.querySelector('[data-action="menu"]').onclick = backToMenu;
  talkEls.log.appendChild(el);
  scrollToEnd(el);
}

function backToMenu() {
  clearTimeout(talk.timer);
  speechSynthesis.cancel();
  talk.scenario = null;
  talk.waiting = false;
  talkEls.stage.hidden = true;
  talkEls.menu.hidden = false;
  renderMenu();
}

// ===== 入力 =====
function listenAnswer() {
  if (!talk.waiting) return;
  const text = t();
  const rec = new SpeechRecognition();
  rec.lang = "zh-CN";
  rec.maxAlternatives = 5;
  talkEls.mic.classList.add("recording");
  talkEls.mic.textContent = text.listening;
  talkEls.status.textContent = "";

  rec.onresult = (e) => answer([...e.results[0]].map((r) => r.transcript));
  rec.onerror = (e) => {
    talkEls.status.textContent = e.error === "not-allowed" ? text.micDenied : text.micError;
  };
  rec.onend = () => {
    talkEls.mic.classList.remove("recording");
    talkEls.mic.textContent = t().speak;
  };
  rec.start();
}

function sendTyped() {
  const value = talkEls.input.value.trim();
  if (!value) return;
  talkEls.input.value = "";
  answer([value]);
}

// ===== 初期化 =====
talkEls.lang.onchange = () => {
  renderLabels();
  renderMenu();
};
talkEls.back.onclick = backToMenu;
talkEls.send.onclick = sendTyped;
talkEls.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    sendTyped();
  }
});
talkEls.hintBtn.onclick = () => talk.waiting && renderHint(currentStep());
talkEls.skip.onclick = skipStep;
if (SpeechRecognition) {
  talkEls.mic.onclick = listenAnswer;
} else {
  talkEls.mic.disabled = true;
  talkEls.mic.title = TALK_TEXT.ja.noMic;
}

// 🔊ボタン（data-say を持つもの）はまとめて処理する
document.getElementById("view-talk").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-say]");
  if (btn) speak(btn.dataset.say);
});

renderLabels();
renderMenu();
