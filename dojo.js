// 昇級審査（空手の帯）
// 審査に合格すると級・段が上がり、ヘッダーの帯が変わる。
// 稽古をサボると確率で「道場破り」が来て、負けると1つ下がる。
// app.js の speak() / similarity() / shuffle() / showView() / state / SpeechRecognition と、
// data/ranks.js・confetti.js を使う。

// ===== 記録（localStorage） =====
const DOJO_STORAGE_KEY = "chinalanguage-dojo";

const DOJO_DEFAULTS = {
  rank: 0, // DOJO_RANKS の何番目か
  promotedAt: null, // 最後に昇級した日（"YYYY-MM-DD"）
  lastPractice: null, // 最後に稽古した日
  streak: 0, // 連続で稽古した日数
  raidCheckedOn: null, // 道場破りの抽選をした日（1日1回）
  raidInProgress: false, // 道場破りの途中でページを閉じたかを見分ける
  mistakes: [], // まちがえた問題 [{ zh, type }]
  history: [], // [{ date, mode, from, to, correct, total, passed }]
};

const dojo = loadDojo();

function loadDojo() {
  try {
    return { ...structuredClone(DOJO_DEFAULTS), ...JSON.parse(localStorage.getItem(DOJO_STORAGE_KEY)) };
  } catch {
    return structuredClone(DOJO_DEFAULTS);
  }
}

function saveDojo() {
  try {
    localStorage.setItem(DOJO_STORAGE_KEY, JSON.stringify(dojo));
  } catch {
    // 保存できなくてもアプリは動かす
  }
}

// ===== 日付 =====
function dojoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dojoDaysBetween(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function dojoAddDays(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCMonth() + 1}月${t.getUTCDate()}日`;
}

// 連続稽古日数（昨日も今日も稽古していなければ途切れている）
function dojoStreak() {
  if (!dojo.lastPractice) return 0;
  return dojoDaysBetween(dojo.lastPractice, dojoToday()) <= 1 ? dojo.streak : 0;
}

function dojoRecordPractice() {
  const today = dojoToday();
  if (dojo.lastPractice === today) return;
  const continued = dojo.lastPractice && dojoDaysBetween(dojo.lastPractice, today) === 1;
  dojo.streak = continued ? dojo.streak + 1 : 1;
  dojo.lastPractice = today;
  saveDojo();
  renderDojo();
}

// 次の審査を受けられるまでの残り日数（0 なら受けられる）
function dojoWaitLeft() {
  const exam = DOJO_EXAMS[dojo.rank];
  if (!exam || !exam.wait || !dojo.promotedAt) return 0;
  return Math.max(0, exam.wait - dojoDaysBetween(dojo.promotedAt, dojoToday()));
}

// ===== 帯 =====
function dojoBeltHtml(rank) {
  const r = DOJO_RANKS[rank];
  const stripes = r.dan ? `<span class="belt-stripes">${"<i></i>".repeat(r.dan)}</span>` : "";
  return `
    <span class="belt belt-${r.belt}">
      <span class="belt-band">${stripes}</span>
      <span class="belt-tail belt-tail-l"></span>
      <span class="belt-tail belt-tail-r"></span>
      <span class="belt-knot"></span>
    </span>`;
}

function dojoRankLabel(rank) {
  const r = DOJO_RANKS[rank];
  return `${r.name}<span class="belt-color">${DOJO_BELT_NAMES[r.belt]}</span>`;
}

function renderBeltDisplay(celebrate) {
  const el = document.getElementById("belt-display");
  el.innerHTML = `${dojoBeltHtml(dojo.rank)}<span class="belt-label">${dojoRankLabel(dojo.rank)}</span>`;
  el.setAttribute("aria-label", `いまの段位: ${DOJO_RANKS[dojo.rank].name}（${DOJO_BELT_NAMES[DOJO_RANKS[dojo.rank].belt]}）。昇級審査を開く`);
  if (celebrate) {
    el.classList.remove("belt-celebrate");
    void el.offsetWidth; // アニメーションをやり直すため
    el.classList.add("belt-celebrate");
  }
}

function dojoConfetti(rank, count) {
  const colors = {
    white: ["#ffffff", "#f1c40f", "#e74c3c", "#3498db", "#2ecc71"],
    brown: ["#8b5a2b", "#c68642", "#f1c40f", "#e74c3c", "#ffffff"],
    black: ["#1b1b1b", "#d4af37", "#f5d76e", "#e74c3c", "#ffffff"],
  }[DOJO_RANKS[rank].belt];
  launchConfetti({ count, colors });
}

// ===== 問題づくり =====
const dojoPhrases = PHRASE_CATEGORIES.flatMap((c) => c.items.map((p) => ({ ...p, group: c.id, kind: "phrase" })));
const dojoNature = NATURE_CATEGORIES.flatMap((c) => c.items.map((w) => ({ ...w, group: c.id, kind: "nature" })));
const dojoToneItems = DOJO_TONE_SETS.flat();
const DOJO_TONE_LABELS = ["第1声（ˉ）", "第2声（ˊ）", "第3声（ˇ）", "第4声（ˋ）"];

function dojoExamPool(cfg) {
  const phrases = cfg.categories === "all" ? dojoPhrases : dojoPhrases.filter((p) => cfg.categories.includes(p.group));
  // 花・動物は「写真で単語」で覚えたものだけ（クイズと同じ）
  const nature = cfg.nature ? dojoNature.filter((w) => state.learned.has(w.zh)) : [];
  return [...phrases, ...nature];
}

function dojoUsableTypes(types) {
  return types.filter((t) => t !== "speak" || SpeechRecognition);
}

// まちがいの選択肢。花・動物は同じ種類から、similar ならフレーズも同じ場面から選ぶ
function dojoOptions(item, cfg) {
  const sameKind =
    item.kind === "nature"
      ? dojoNature.filter((w) => w.group === item.group)
      : cfg.similar
        ? dojoPhrases.filter((p) => p.group === item.group)
        : dojoPhrases;
  const others = shuffle(sameKind.filter((p) => p.zh !== item.zh && p.ja !== item.ja)).slice(0, 3);
  return shuffle([item, ...others]);
}

function dojoToneQuestion(item) {
  const set = item
    ? DOJO_TONE_SETS.find((s) => s.includes(item))
    : DOJO_TONE_SETS[Math.floor(Math.random() * DOJO_TONE_SETS.length)];
  const answer = item || set[Math.floor(Math.random() * set.length)];
  return { type: "tone", item: answer, toneIndex: set.indexOf(answer) };
}

function dojoBuildQuestions(cfg, count) {
  const types = dojoUsableTypes(cfg.types);
  // どの形式も最低1問は出し、残りはランダム
  const seq = shuffle([
    ...types,
    ...Array.from({ length: Math.max(0, count - types.length) }, () => types[Math.floor(Math.random() * types.length)]),
  ]).slice(0, count);

  const pool = dojoExamPool(cfg);
  let deck = [];
  return seq.map((type) => {
    if (type === "tone") return dojoToneQuestion();
    if (!deck.length) deck = shuffle(pool); // 問題が足りなければ2周目に入る
    const item = deck.pop();
    return { type, item, options: dojoOptions(item, cfg) };
  });
}

// 稽古：まちがえた問題を、ピンイン付きのやさしい形で出す
function dojoKeikoQuestions() {
  const cfg = { pinyin: true };
  return shuffle(dojo.mistakes)
    .slice(0, 10)
    .map((m) => {
      if (m.type === "tone") {
        const item = dojoToneItems.find((t) => t.zh === m.zh);
        return item && dojoToneQuestion(item);
      }
      const item = [...dojoPhrases, ...dojoNature].find((p) => p.zh === m.zh);
      if (!item) return null;
      const type = m.type === "speak" && !SpeechRecognition ? "ja2zh" : m.type;
      return { type, item, options: dojoOptions(item, cfg) };
    })
    .filter(Boolean);
}

function dojoAddMistake(q) {
  if (!dojo.mistakes.some((m) => m.zh === q.item.zh && m.type === q.type)) {
    dojo.mistakes.push({ zh: q.item.zh, type: q.type });
  }
}

function dojoRemoveMistake(q) {
  dojo.mistakes = dojo.mistakes.filter((m) => !(m.zh === q.item.zh && m.type === q.type));
}

function dojoNeed(cfg, total) {
  return Math.ceil(total * cfg.pass - 1e-9);
}

// ===== 審査・道場破り・稽古の画面（オーバーレイ） =====
const arena = {
  root: document.getElementById("dojo-arena"),
  title: document.getElementById("dojo-arena-title"),
  body: document.getElementById("dojo-arena-body"),
  quit: document.getElementById("dojo-quit"),
};

let dojoRun = null; // { mode: "exam" | "raid" | "keiko", cfg, questions, index, correct, answered, quitArmed }
let dojoTimer = null;

function dojoOpenArena(title) {
  arena.title.textContent = title;
  arena.root.hidden = false;
  arena.quit.hidden = false;
  arena.quit.textContent = "棄権する";
  document.body.classList.add("dojo-locked");
}

function dojoCloseArena() {
  clearInterval(dojoTimer);
  speechSynthesis.cancel();
  currentRecognition?.abort();
  dojoRun = null;
  arena.root.hidden = true;
  document.body.classList.remove("dojo-locked");
  renderDojo();
}

function dojoStartExam() {
  const cfg = DOJO_EXAMS[dojo.rank];
  if (!cfg || dojoWaitLeft() > 0) return;
  dojoRun = { mode: "exam", cfg, questions: dojoBuildQuestions(cfg, cfg.count), index: 0, correct: 0 };
  dojoOpenArena(`${DOJO_RANKS[dojo.rank].name} → ${DOJO_RANKS[dojo.rank + 1].name} 昇級審査`);
  dojoRenderQuestion();
}

function dojoStartKeiko() {
  const questions = dojoKeikoQuestions();
  if (!questions.length) return;
  dojoRun = { mode: "keiko", cfg: { pinyin: true, pass: 0 }, questions, index: 0, correct: 0 };
  dojoOpenArena("稽古（まちがえた問題の復習）");
  dojoRenderQuestion();
}

function dojoStartRaid() {
  if (dojoRun || dojo.rank === 0) return;
  // いまの級・段に上がったときの審査の内容で戦う
  const base = DOJO_EXAMS[dojo.rank - 1];
  const cfg = { ...base, count: DOJO_RAID.count, pass: DOJO_RAID.pass };
  dojoRun = { mode: "raid", cfg, questions: dojoBuildQuestions(cfg, cfg.count), index: 0, correct: 0 };
  dojo.raidInProgress = true;
  saveDojo();

  dojoOpenArena("道場破り");
  arena.quit.hidden = true;
  const need = dojoNeed(cfg, cfg.count);
  arena.body.innerHTML = `
    <div class="dojo-raid-intro">
      <p class="dojo-raid-emoji">🥋💥</p>
      <p class="dojo-raid-headline">道場破りが現れた！</p>
      <p>「この道場の${DOJO_RANKS[dojo.rank].name}の実力、見せてもらおうか！」</p>
      <p class="hint">${cfg.count}問中 ${need}問以上正解で勝ち。負けると<strong>${DOJO_RANKS[dojo.rank - 1].name}</strong>に下がります。<br>逃げても（ページを閉じても）負けになります。</p>
      <button class="btn primary dojo-big-btn" id="dojo-raid-accept">受けて立つ！</button>
    </div>`;
  document.getElementById("dojo-raid-accept").onclick = () => {
    arena.quit.hidden = false;
    dojoRenderQuestion();
  };
}

function dojoRenderQuestion() {
  const run = dojoRun;
  const q = run.questions[run.index];
  const pinyin = run.cfg.pinyin;
  currentRecognition?.abort(); // 前の問題の録音が残っていたら止める
  run.answered = false;
  run.quitArmed = false;
  arena.quit.textContent = "棄権する";

  const labels = {
    ja2zh: "中国語でなんと言う？",
    zh2ja: "日本語の意味は？",
    listen: "何と言っている？",
    tone: "聞こえたのは第何声？",
    speak: "中国語で言ってみよう",
  };
  let prompt;
  if (q.type === "zh2ja") {
    prompt = `${q.item.zh}${pinyin ? `<small class="dojo-py">${q.item.py}</small>` : ""}`;
  } else if (q.type === "listen" || q.type === "tone") {
    prompt = `<button class="btn dojo-replay" id="dojo-replay">🔊 もう一度聞く</button>`;
  } else {
    prompt = q.item.ja;
  }

  arena.body.innerHTML = `
    <div class="dojo-progress">
      <span>${run.index + 1} / ${run.questions.length} 問目</span>
      <span>正解 ${run.correct}</span>
    </div>
    <div class="dojo-timer" id="dojo-timer" hidden><div class="dojo-timer-bar" id="dojo-timer-bar"></div></div>
    <p class="quiz-label">${labels[q.type]}</p>
    <p class="quiz-question">${prompt}</p>
    <div class="quiz-options" id="dojo-options"></div>
    <p class="quiz-result" id="dojo-result"></p>
    <div class="quiz-footer">
      <span class="hint" id="dojo-reveal"></span>
      <button class="btn primary" id="dojo-next" hidden>${run.index + 1 < run.questions.length ? "次へ" : "結果を見る"}</button>
    </div>`;

  const box = document.getElementById("dojo-options");
  document.getElementById("dojo-next").onclick = () => {
    run.index++;
    run.index < run.questions.length ? dojoRenderQuestion() : dojoFinish();
  };

  if (q.type === "speak") {
    dojoRenderSpeak(q, box);
  } else if (q.type === "tone") {
    DOJO_TONE_LABELS.forEach((label, i) => {
      dojoAddOption(box, label, i === q.toneIndex);
    });
  } else {
    for (const opt of q.options) {
      const html =
        q.type === "ja2zh"
          ? `${opt.zh}${pinyin ? `<small>${opt.py}</small>` : ""}`
          : opt.ja;
      dojoAddOption(box, html, opt === q.item);
    }
  }

  if (q.type === "listen" || q.type === "tone") {
    document.getElementById("dojo-replay").onclick = () => speak(q.item.zh);
    speak(q.item.zh);
  }
  dojoStartTimer(q);
}

function dojoAddOption(box, html, isAnswer) {
  const btn = document.createElement("button");
  btn.className = "quiz-option";
  btn.innerHTML = html;
  if (isAnswer) btn.dataset.answer = "1";
  btn.onclick = () => {
    if (dojoRun.answered) return;
    btn.classList.add(isAnswer ? "correct" : "wrong");
    dojoAnswer(isAnswer);
  };
  box.appendChild(btn);
}

function dojoRenderSpeak(q, box) {
  box.innerHTML = `
    <div class="phrase-actions">
      <button class="btn primary" id="dojo-mic">🎤 話す</button>
      <button class="btn" id="dojo-giveup">わからない</button>
    </div>
    <p class="feedback" id="dojo-speak-feedback">チャンスは2回。80点以上で正解です</p>`;
  const mic = document.getElementById("dojo-mic");
  const feedback = document.getElementById("dojo-speak-feedback");
  let tries = 0;

  document.getElementById("dojo-giveup").onclick = () => !dojoRun.answered && dojoAnswer(false);
  mic.onclick = () => {
    if (dojoRun.answered) return;
    // 聞いている最中にもう一度押したら、録音を止める
    if (mic.classList.contains("recording")) {
      currentRecognition?.stop();
      return;
    }
    if (!navigator.onLine) {
      feedback.className = "feedback ng";
      feedback.textContent = micErrorMessage("network");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "zh-CN";
    rec.maxAlternatives = 3;
    mic.classList.add("recording");
    mic.textContent = "● 聞いています…";
    rec.onresult = (e) => {
      const best = [...e.results[0]]
        .map((r) => ({ text: r.transcript, score: similarity(r.transcript, q.item.zh) }))
        .sort((x, y) => y.score - x.score)[0];
      tries++;
      if (best.score >= 80) {
        feedback.className = "feedback ok";
        feedback.textContent = `${best.score}点 認識結果: ${best.text}`;
        dojoAnswer(true);
      } else if (tries < 2) {
        feedback.className = "feedback ng";
        feedback.textContent = `${best.score}点 認識結果: ${best.text}　あと1回！`;
      } else {
        feedback.className = "feedback ng";
        feedback.textContent = `${best.score}点 認識結果: ${best.text}`;
        dojoAnswer(false);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      feedback.className = "feedback ng";
      feedback.textContent = micErrorMessage(e.error);
    };
    rec.onend = () => {
      mic.classList.remove("recording");
      mic.textContent = "🎤 話す";
    };
    startRecognition(rec);
  };
}

function dojoStartTimer(q) {
  clearInterval(dojoTimer);
  const seconds = dojoRun.cfg.time;
  if (!seconds || q.type === "speak") return; // 発音は認識に時間がかかるので制限なし
  const wrap = document.getElementById("dojo-timer");
  const bar = document.getElementById("dojo-timer-bar");
  wrap.hidden = false;
  const end = Date.now() + seconds * 1000;
  dojoTimer = setInterval(() => {
    const left = end - Date.now();
    bar.style.width = `${Math.max(0, (left / (seconds * 1000)) * 100)}%`;
    bar.classList.toggle("hurry", left < 3000);
    if (left <= 0) {
      clearInterval(dojoTimer);
      if (!dojoRun.answered) dojoAnswer(false, "時間切れ！");
    }
  }, 100);
}

function dojoAnswer(correct, message) {
  const run = dojoRun;
  const q = run.questions[run.index];
  run.answered = true;
  clearInterval(dojoTimer);

  for (const b of document.querySelectorAll("#dojo-options .quiz-option")) {
    b.disabled = true;
    if (b.dataset.answer) b.classList.add("correct");
  }

  const result = document.getElementById("dojo-result");
  charaReact(correct ? "joy" : "sad");
  if (correct) {
    run.correct++;
    result.textContent = "正解！";
    result.className = "quiz-result dojo-ok";
    if (run.mode === "keiko") dojoRemoveMistake(q);
  } else {
    result.textContent = message || "残念…";
    result.className = "quiz-result dojo-ng";
    dojoAddMistake(q);
  }
  saveDojo();

  document.getElementById("dojo-reveal").textContent = `${q.item.zh}（${q.item.py}）${q.item.ja}`;
  if (q.type !== "speak") speak(q.item.zh);
  const next = document.getElementById("dojo-next");
  next.hidden = false;
  next.focus();
}

function dojoFinish(quit) {
  clearInterval(dojoTimer);
  const run = dojoRun;
  const total = run.questions.length;
  const need = dojoNeed(run.cfg, total);
  const passed = !quit && run.correct >= need;
  const from = dojo.rank;
  dojoRecordPractice();
  arena.quit.hidden = true;

  let headline;
  let message = "";
  let celebrate = 0;

  if (run.mode === "exam") {
    if (passed) {
      dojo.rank++;
      dojo.promotedAt = dojoToday();
      const beltChanged = DOJO_RANKS[from].belt !== DOJO_RANKS[dojo.rank].belt;
      headline = `合格！ ${DOJO_RANKS[dojo.rank].name}に昇級！`;
      if (DOJO_RANKS[dojo.rank].dan === 1) headline = "合格！ 初段・黒帯を授与します！";
      else if (DOJO_RANKS[dojo.rank].dan) headline = `合格！ ${DOJO_RANKS[dojo.rank].name}に昇段！`;
      if (beltChanged) message = `${DOJO_BELT_NAMES[DOJO_RANKS[dojo.rank].belt]}になりました。おめでとう！`;
      if (dojo.rank === DOJO_RANKS.length - 1) message = "十段に到達しました。ここが頂点です。これからも稽古を続けよう！";
      celebrate = beltChanged || dojo.rank === DOJO_RANKS.length - 1 ? 320 : 150;
    } else {
      headline = quit ? "棄権しました" : "不合格…";
      message = "まちがえた問題は「稽古」で復習できます。何度でも挑戦できます。";
    }
  } else if (run.mode === "raid") {
    dojo.raidInProgress = false;
    if (passed) {
      headline = "道場破りを撃退した！";
      message = `${DOJO_RANKS[dojo.rank].name}の実力を守り抜きました。`;
      celebrate = 70;
    } else {
      dojo.rank = Math.max(0, dojo.rank - 1);
      headline = quit ? "逃げてしまった…" : "道場破りに負けた…";
      message = `${DOJO_RANKS[from].name}から<strong>${DOJO_RANKS[dojo.rank].name}</strong>に下がりました。稽古して取り戻そう！`;
    }
  } else {
    headline = "稽古おつかれさま！";
    message = dojo.mistakes.length
      ? `まだ復習が残っている問題: ${dojo.mistakes.length}問`
      : "まちがえた問題はすべて復習できました！";
  }

  if (run.mode !== "keiko") {
    dojo.history.push({ date: dojoToday(), mode: run.mode, from, to: dojo.rank, correct: run.correct, total, passed });
    dojo.history = dojo.history.slice(-30);
  }
  saveDojo();
  renderDojo();

  const score =
    run.mode === "keiko"
      ? `${total}問中 ${run.correct}問正解`
      : `${total}問中 ${run.correct}問正解（${run.mode === "raid" ? "勝ち" : "合格"}ライン ${need}問）`;
  arena.body.innerHTML = `
    <div class="dojo-finish ${passed || run.mode === "keiko" ? "passed" : "failed"}">
      <p class="dojo-finish-headline">${headline}</p>
      <p class="dojo-finish-score">${score}</p>
      <div class="dojo-finish-belt">${dojoBeltHtml(dojo.rank)}<span class="belt-label">${dojoRankLabel(dojo.rank)}</span></div>
      <p>${message}</p>
      <button class="btn primary dojo-big-btn" id="dojo-close">閉じる</button>
    </div>`;
  document.getElementById("dojo-close").onclick = dojoCloseArena;
  document.getElementById("dojo-close").focus();

  renderBeltDisplay(dojo.rank !== from);
  if (celebrate) dojoConfetti(dojo.rank, celebrate);
}

arena.quit.onclick = () => {
  if (!dojoRun) return;
  if (dojoRun.mode === "keiko") return dojoCloseArena();
  if (!dojoRun.quitArmed) {
    dojoRun.quitArmed = true;
    arena.quit.textContent = dojoRun.mode === "raid" ? "本当に逃げる？（負けになります）" : "本当に棄権する？";
    return;
  }
  dojoFinish(true);
};

// ===== 道場破りの抽選 =====
function dojoCheckRaid() {
  // 前回、道場破りの途中でページを閉じた
  if (dojo.raidInProgress) {
    const from = dojo.rank;
    dojo.raidInProgress = false;
    dojo.rank = Math.max(0, dojo.rank - 1);
    dojo.history.push({ date: dojoToday(), mode: "raid", from, to: dojo.rank, correct: 0, total: DOJO_RAID.count, passed: false });
    saveDojo();
    renderBeltDisplay(dojo.rank !== from);
    renderDojo();
    dojoOpenArena("道場破り");
    arena.quit.hidden = true;
    arena.body.innerHTML = `
      <div class="dojo-finish failed">
        <p class="dojo-finish-headline">道場破りから逃げてしまった…</p>
        <p>前回、道場破りの途中でページを閉じたため、負けになりました。<br>${DOJO_RANKS[from].name}から<strong>${DOJO_RANKS[dojo.rank].name}</strong>に下がりました。</p>
        <button class="btn primary dojo-big-btn" id="dojo-close">閉じる</button>
      </div>`;
    document.getElementById("dojo-close").onclick = dojoCloseArena;
    return;
  }

  const today = dojoToday();
  if (dojo.rank === 0 || !dojo.lastPractice || dojo.raidCheckedOn === today) return;
  dojo.raidCheckedOn = today;
  saveDojo();
  const days = dojoDaysBetween(dojo.lastPractice, today);
  if (Math.random() < DOJO_RAID.chance(days)) setTimeout(dojoStartRaid, 800);
}

// ===== 昇級審査タブ =====
function renderDojo() {
  const streak = dojoStreak();
  const days = dojo.lastPractice ? dojoDaysBetween(dojo.lastPractice, dojoToday()) : null;
  const chance = dojo.rank > 0 && days !== null ? Math.round(DOJO_RAID.chance(days) * 100) : 0;

  document.getElementById("dojo-status").innerHTML = `
    <div class="dojo-status-belt">${dojoBeltHtml(dojo.rank)}<span class="belt-label">${dojoRankLabel(dojo.rank)}</span></div>
    <div class="dojo-status-text">
      <p class="dojo-streak">${streak ? `🔥 ${streak}日連続で稽古中` : "今日はまだ稽古していません"}</p>
      <p class="hint">${
        days === null
          ? "審査・稽古・クイズをすると、稽古した日として記録されます"
          : `最後の稽古: ${days === 0 ? "今日" : `${days}日前`}${dojo.rank > 0 ? `　道場破りの危険度: ${chance}%` : ""}`
      }</p>
    </div>`;

  // 次の審査
  const examEl = document.getElementById("dojo-exam");
  const cfg = DOJO_EXAMS[dojo.rank];
  if (!cfg) {
    examEl.innerHTML = `
      <p class="dojo-card-title">十段に到達しました</p>
      <p class="hint">もう上の審査はありません。道場破りに負けないよう、ひたすら稽古を続けよう！</p>`;
  } else {
    const to = DOJO_RANKS[dojo.rank + 1];
    const special =
      to.dan === 1 ? "初段審査（黒帯）" : DOJO_RANKS[dojo.rank].belt !== to.belt ? `${DOJO_BELT_NAMES[to.belt]}審査` : "";
    const types = dojoUsableTypes(cfg.types).map((t) => DOJO_QUESTION_TYPES[t]).join("・");
    const wait = dojoWaitLeft();
    examEl.innerHTML = `
      <p class="dojo-card-title">次の審査：${DOJO_RANKS[dojo.rank].name} → ${to.name}${special ? `<span class="dojo-special">${special}</span>` : ""}</p>
      <ul class="dojo-rules">
        <li>${cfg.count}問中 <strong>${dojoNeed(cfg, cfg.count)}問以上</strong>正解で合格</li>
        <li>形式：${types}</li>
        <li>ピンイン：${cfg.pinyin ? "あり" : "なし"}${cfg.similar ? "　選択肢：似たものが出る" : ""}</li>
        ${cfg.time ? `<li>制限時間：1問 ${cfg.time}秒（発音問題をのぞく）</li>` : ""}
      </ul>
      ${wait ? `<p class="hint">昇段には期間が必要です。あと${wait}日（${dojoAddDays(dojo.promotedAt, cfg.wait)}から）受けられます。</p>` : ""}
      <button class="btn primary dojo-big-btn" id="dojo-exam-start" ${wait ? "disabled" : ""}>審査を受ける</button>`;
    document.getElementById("dojo-exam-start").onclick = dojoStartExam;
  }

  // 稽古
  document.getElementById("dojo-keiko").innerHTML = `
    <p class="dojo-card-title">稽古（まちがえた問題の復習）</p>
    <p class="hint">${dojo.mistakes.length ? `復習する問題: ${dojo.mistakes.length}問。正解すると一覧から消えます。` : "まちがえた問題はありません。"}</p>
    <button class="btn dojo-big-btn" id="dojo-keiko-start" ${dojo.mistakes.length ? "" : "disabled"}>稽古する</button>`;
  document.getElementById("dojo-keiko-start").onclick = dojoStartKeiko;

  // 級と段の一覧
  document.getElementById("dojo-ladder").innerHTML = DOJO_RANKS.map(
    (r, i) => `
      <li class="${i === dojo.rank ? "current" : i < dojo.rank ? "done" : ""}">
        <span class="belt-chip belt-${r.belt}"></span>${r.name}${i === dojo.rank ? '<span class="dojo-here">いまここ</span>' : ""}
      </li>`
  ).join("");

  // 記録
  const history = dojo.history.slice(-8).reverse();
  document.getElementById("dojo-history").innerHTML = history.length
    ? history
        .map((h) => {
          const [, m, d] = h.date.split("-").map(Number);
          const kind = h.mode === "raid" ? "道場破り" : "審査";
          const verdict = h.mode === "raid" ? (h.passed ? "勝ち" : "負け") : h.passed ? "合格" : "不合格";
          const change = h.from !== h.to ? `　${DOJO_RANKS[h.from].name} → ${DOJO_RANKS[h.to].name}` : "";
          return `<li><span class="hint">${m}/${d}</span> ${kind} <strong class="${h.passed ? "dojo-ok" : "dojo-ng"}">${verdict}</strong>（${h.correct}/${h.total}）${change}</li>`;
        })
        .join("")
    : '<li class="hint">まだ記録はありません</li>';

  if (dojoDebug) renderDojoDebug();
}

// ===== デバッグ（URL の末尾に ?debug を付けると表示） =====
const dojoDebug = new URLSearchParams(location.search).has("debug");

function renderDojoDebug() {
  const el = document.getElementById("dojo-debug");
  el.hidden = false;
  el.innerHTML = `
    <p class="dojo-card-title">デバッグ</p>
    <div class="phrase-actions">
      <select id="dojo-debug-rank">${DOJO_RANKS.map((r, i) => `<option value="${i}" ${i === dojo.rank ? "selected" : ""}>${r.name}</option>`).join("")}</select>
      <button class="btn" id="dojo-debug-raid">道場破りを呼ぶ</button>
      <button class="btn" id="dojo-debug-wait">待ち時間をなくす</button>
      <button class="btn" id="dojo-debug-confetti">紙吹雪</button>
      <button class="btn" id="dojo-debug-yesterday">最後の稽古を3日前にする</button>
      <button class="btn" id="dojo-debug-reset">記録をすべて消す</button>
    </div>`;
  document.getElementById("dojo-debug-rank").onchange = (e) => {
    dojo.rank = Number(e.target.value);
    saveDojo();
    renderBeltDisplay(true);
    renderDojo();
  };
  document.getElementById("dojo-debug-raid").onclick = dojoStartRaid;
  document.getElementById("dojo-debug-wait").onclick = () => {
    dojo.promotedAt = null;
    saveDojo();
    renderDojo();
  };
  document.getElementById("dojo-debug-confetti").onclick = () => dojoConfetti(dojo.rank, 320);
  document.getElementById("dojo-debug-yesterday").onclick = () => {
    const d = new Date(Date.now() - 3 * 86400000);
    dojo.lastPractice = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dojo.raidCheckedOn = null;
    saveDojo();
    renderDojo();
  };
  const reset = document.getElementById("dojo-debug-reset");
  reset.onclick = () => {
    if (reset.dataset.armed) {
      Object.assign(dojo, structuredClone(DOJO_DEFAULTS));
      saveDojo();
      renderBeltDisplay(true);
      renderDojo();
    } else {
      reset.dataset.armed = "1";
      reset.textContent = "本当に消す？（もう一度押す）";
    }
  };
}

// ===== 初期化 =====
function initDojo() {
  const belt = document.getElementById("belt-display");
  belt.onclick = () => showView("dojo");
  document.querySelector('.tab[data-view="dojo"]').addEventListener("click", renderDojo);
  // ふつうのクイズに答えたときも、稽古した日として数える
  document.getElementById("quiz-options").addEventListener("click", (e) => {
    if (e.target.closest(".quiz-option")) dojoRecordPractice();
  });

  renderBeltDisplay(false);
  renderDojo();
  dojoCheckRaid();
}

initDojo();
