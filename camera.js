// ===== 写真で単語（画像認識） =====
// 学習済みモデル COCO-SSD（TensorFlow.js）をブラウザ内で動かし、写っている物を見つける。
// 画像はどこにも送信されない。モデルは「写真で単語」タブを初めて開いたときに読み込む。
// speak() / listen() / SpeechRecognition は app.js のものを使う。

const TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
const COCO_SSD_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";
const MIN_SCORE = 0.5; // この確信度（50%）未満の結果は出さない
const MAX_SIZE = 640; // 解析する画像の最大サイズ（px）。大きいと遅くなる

let detectorPromise = null;
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`読み込み失敗: ${src}`));
    document.head.appendChild(s);
  });
}

// モデルの読み込み（1回だけ。失敗したら次に開いたとき再挑戦）
function loadDetector() {
  if (!detectorPromise) {
    setStatus("AIを読み込んでいます…（初回は数秒〜数十秒かかります）");
    detectorPromise = loadScript(TFJS_URL)
      .then(() => loadScript(COCO_SSD_URL))
      .then(() => cocoSsd.load())
      .then((model) => {
        setStatus("準備OK！写真を選ぶか、カメラで撮ってください");
        return model;
      })
      .catch((err) => {
        detectorPromise = null;
        setStatus("AIを読み込めませんでした。インターネット接続を確認して、もう一度タブを開いてください");
        throw err;
      });
  }
  return detectorPromise;
}

// 画像（img / video）をキャンバスに描いて解析する
async function detectFrom(source, width, height) {
  const scale = Math.min(1, MAX_SIZE / Math.max(width, height));
  const canvas = camEl.canvas;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  canvas.hidden = false;
  camEl.list.innerHTML = "";

  let model;
  try {
    model = await loadDetector();
  } catch {
    return;
  }
  setStatus("調べています…");
  const predictions = (await model.detect(canvas)).filter((p) => p.score >= MIN_SCORE);

  drawBoxes(ctx, predictions);
  renderDetections(predictions);
  setStatus(
    predictions.length
      ? `${predictions.length}個 見つかりました`
      : "知っている物が見つかりませんでした。別の角度や明るい場所で試してみてください"
  );
}

function drawBoxes(ctx, predictions) {
  const color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c0392b";
  ctx.lineWidth = 3;
  ctx.font = "bold 18px system-ui, 'Microsoft YaHei', sans-serif";
  ctx.textBaseline = "top";
  for (const p of predictions) {
    const [x, y, w, h] = p.bbox;
    const label = OBJECT_WORDS[p.class]?.zh || p.class;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);
    const textW = ctx.measureText(label).width + 10;
    const ty = y > 26 ? y - 26 : y;
    ctx.fillStyle = color;
    ctx.fillRect(x, ty, textW, 26);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 5, ty + 4);
  }
}

// 見つかった物を単語カードにする（同じ物が複数あっても1枚にまとめる）
function renderDetections(predictions) {
  const best = new Map();
  for (const p of predictions) {
    if (!best.has(p.class) || best.get(p.class).score < p.score) best.set(p.class, p);
  }

  for (const p of best.values()) {
    const word = OBJECT_WORDS[p.class] || { zh: p.class, py: "", ja: "（辞書にない物）" };
    const card = document.createElement("div");
    card.className = "phrase-card";
    card.innerHTML = `
      <p class="phrase-zh">${word.zh}</p>
      <p class="phrase-py">${word.py}</p>
      <p class="phrase-ja">${word.ja}<span class="detect-score">（AIの自信 ${Math.round(p.score * 100)}%）</span></p>
      <div class="phrase-actions">
        <button class="btn primary" data-action="play">🔊 聞く</button>
        <button class="btn" data-action="listen">🎤 話してみる</button>
      </div>
      <p class="feedback"></p>
    `;
    const micBtn = card.querySelector('[data-action="listen"]');
    card.querySelector('[data-action="play"]').onclick = () => speak(word.zh);
    if (SpeechRecognition && word.py) {
      micBtn.onclick = () => listen(word, micBtn, card.querySelector(".feedback"));
    } else {
      micBtn.disabled = true;
    }
    camEl.list.appendChild(card);
  }
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
  setStatus("調べたい物を写して「撮影して調べる」を押してください");
  loadDetector().catch(() => {});
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
      loadDetector().catch(() => {});
    } else {
      stopCamera();
    }
  });
}
