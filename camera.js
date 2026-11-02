// ===== 写真で単語（画像認識：花と動物） =====
// 学習済みモデル CLIP（Transformers.js）をブラウザ内で動かし、
// data/objects.js の候補の中から写真に一番近い花・動物を選ぶ。
// 画像はどこにも送信されない。モデルは「写真で単語」タブを初めて開いたときに読み込む。
// speak() / listen() / SpeechRecognition は app.js のものを使う。

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js";
const CLIP_MODEL = "Xenova/clip-vit-base-patch32";
const MIN_SCORE = 0.25; // 一番の候補がこれ未満なら「わからない」とする
const SUB_SCORE = 0.05; // 「ほかの候補」に出す最低ライン
const MAX_SIZE = 640; // 画面に表示する画像の最大サイズ（px）

// AI に渡す文と、その答え（単語）の対応表を作る
const candidates = [];
for (const c of NATURE_CATEGORIES) {
  for (const item of c.items) candidates.push({ prompt: c.prompt(item.en), word: item, category: c });
}
const allPrompts = [...candidates.map((x) => x.prompt), ...OTHER_PROMPTS];
const byPrompt = new Map(candidates.map((x) => [x.prompt, x]));

let classifierPromise = null;
let cameraStream = null;

const camEl = {
  status: document.getElementById("detect-status"),
  input: document.getElementById("photo-input"),
  start: document.getElementById("camera-start"),
  shoot: document.getElementById("camera-shoot"),
  video: document.getElementById("camera-video"),
  canvas: document.getElementById("detect-canvas"),
  list: document.getElementById("detect-list"),
};

function setStatus(text) {
  camEl.status.textContent = text;
}

// モデルの読み込み（1回だけ。失敗したら次に開いたとき再挑戦）
function loadClassifier() {
  if (!classifierPromise) {
    setStatus("AIを読み込んでいます…（初回だけ約150MBのダウンロードがあります）");
    const files = new Map();
    const onProgress = (p) => {
      if (p.status !== "progress" || !p.total) return;
      files.set(p.file, p);
      const loaded = [...files.values()].reduce((s, f) => s + f.loaded, 0);
      const total = [...files.values()].reduce((s, f) => s + f.total, 0);
      setStatus(`AIを読み込んでいます… ${Math.floor((loaded / total) * 100)}%（初回だけ時間がかかります）`);
    };
    classifierPromise = import(TRANSFORMERS_URL)
      .then(({ pipeline }) =>
        pipeline("zero-shot-image-classification", CLIP_MODEL, { progress_callback: onProgress })
      )
      .then((classifier) => {
        setStatus("準備OK！花か動物の写真を選ぶか、カメラで撮ってください");
        return classifier;
      })
      .catch((err) => {
        classifierPromise = null;
        setStatus("AIを読み込めませんでした。インターネット接続を確認して、もう一度タブを開いてください");
        throw err;
      });
  }
  return classifierPromise;
}

// 画像（img / video）をキャンバスに描いて解析する
async function detectFrom(source, width, height) {
  const scale = Math.min(1, MAX_SIZE / Math.max(width, height));
  const canvas = camEl.canvas;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  canvas.hidden = false;
  camEl.list.innerHTML = "";

  let classifier;
  try {
    classifier = await loadClassifier();
  } catch {
    return;
  }
  setStatus("調べています…");
  const results = await classifier(canvas.toDataURL("image/jpeg", 0.9), allPrompts, {
    hypothesis_template: "{}",
  });

  const top = results[0];
  const best = byPrompt.get(top.label);
  if (!best || top.score < MIN_SCORE) {
    setStatus("花や動物が見つかりませんでした。花や動物を大きく写して、もう一度試してみてください");
    return;
  }

  // 同じ種類（花なら花）の中から、ほかの候補も出す
  const others = results
    .slice(1)
    .map((r) => ({ ...byPrompt.get(r.label), score: r.score }))
    .filter((r) => r.word && r.category === best.category && r.score >= SUB_SCORE)
    .slice(0, 2);

  setStatus(`この${best.category.name}は…`);
  renderResult(best.word, top.score, false);
  for (const o of others) renderResult(o.word, o.score, true);
}

// 結果を単語カードにする
function renderResult(word, score, isSub) {
  const card = document.createElement("div");
  card.className = "phrase-card" + (isSub ? " detect-sub" : "");
  card.innerHTML = `
    ${isSub ? '<p class="detect-label">ほかの候補</p>' : ""}
    <p class="phrase-zh">${word.zh}</p>
    <p class="phrase-py">${word.py}</p>
    <p class="phrase-ja">${word.ja}<span class="detect-score">（AIの自信 ${Math.round(score * 100)}%）</span></p>
    <div class="phrase-actions">
      <button class="btn primary" data-action="play">🔊 聞く</button>
      <button class="btn" data-action="listen">🎤 話してみる</button>
    </div>
    <p class="feedback"></p>
  `;
  const micBtn = card.querySelector('[data-action="listen"]');
  card.querySelector('[data-action="play"]').onclick = () => speak(word.zh);
  if (SpeechRecognition) {
    micBtn.onclick = () => listen(word, micBtn, card.querySelector(".feedback"));
  } else {
    micBtn.disabled = true;
  }
  camEl.list.appendChild(card);
}

// ----- 写真を選ぶ -----
camEl.input.onchange = () => {
  const file = camEl.input.files[0];
  if (!file) return;
  stopCamera();
  const img = new Image();
  img.onload = () => {
    detectFrom(img, img.naturalWidth, img.naturalHeight);
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
  camEl.input.value = ""; // 同じ写真をもう一度選べるようにする
};

// ----- カメラで撮る -----
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("このブラウザではカメラを使えません。「写真を選ぶ」を使ってください");
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
  } catch {
    setStatus("カメラを使えませんでした。ブラウザでカメラの使用を許可してください");
    return;
  }
  camEl.video.srcObject = cameraStream;
  await camEl.video.play();
  camEl.video.hidden = false;
  camEl.canvas.hidden = true;
  camEl.list.innerHTML = "";
  camEl.start.hidden = true;
  camEl.shoot.hidden = false;
  setStatus("花や動物を大きく写して「撮影して調べる」を押してください");
  loadClassifier().catch(() => {});
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  camEl.video.hidden = true;
  camEl.start.hidden = false;
  camEl.shoot.hidden = true;
}

camEl.start.onclick = startCamera;
camEl.shoot.onclick = () => {
  const { videoWidth, videoHeight } = camEl.video;
  if (!videoWidth) return;
  detectFrom(camEl.video, videoWidth, videoHeight);
  stopCamera();
};

// ----- タブ切り替え -----
// app.js の showView() はそのままにして、ここではタブのクリックだけを追加で見張る
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    if (tab.dataset.view === "camera") {
      loadClassifier().catch(() => {});
    } else {
      stopCamera();
    }
  });
}
