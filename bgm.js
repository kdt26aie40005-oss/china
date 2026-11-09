// ===== BGM =====
// audio/bgm.mp3 をくり返し流す。🎵ボタンでオン／オフを切り替え、設定は localStorage に残す。
// audio/bgm.mp3 がないときは、ボタンを出さない（ファイルを置くだけで使えるようにするため）。
// お手本の読み上げ中と🎤で聞いている間は、音を小さくする。
// currentRecognition は app.js のものを使う。

const BGM_SRC = "audio/bgm.mp3";
const BGM_STORAGE_KEY = "chinalanguage-bgm";
const BGM_VOLUME = 0.3; // ふだんの音量
const BGM_DUCK_VOLUME = 0.05; // 読み上げ・🎤の間の音量

const bgm = {
  audio: new Audio(),
  on: loadBgmOn(),
  timer: null,
};

function loadBgmOn() {
  try {
    return localStorage.getItem(BGM_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function saveBgmOn() {
  try {
    localStorage.setItem(BGM_STORAGE_KEY, bgm.on ? "on" : "off");
  } catch {
    // 保存できなくてもアプリは動かす
  }
}

function renderBgmButton() {
  const button = document.getElementById("bgm-toggle");
  button.textContent = bgm.on ? "🎵 BGM オン" : "🎵 BGM オフ";
  button.setAttribute("aria-pressed", String(bgm.on));
  button.classList.toggle("active", bgm.on);
}

// 読み上げ中・🎤の間は小さく、それ以外はふだんの音量に、少しずつ近づける
function updateBgmVolume() {
  const busy = speechSynthesis.speaking || currentRecognition !== null;
  const target = busy ? BGM_DUCK_VOLUME : BGM_VOLUME;
  const v = bgm.audio.volume;
  bgm.audio.volume = Math.abs(target - v) < 0.02 ? target : v + (target - v) * 0.4;
}

function playBgm() {
  // ブラウザは、画面を一度も押していないうちは音を流せない。
  // そのときは失敗するので、最初に画面を押したときにもう一度流す
  bgm.audio.play().catch(() => {
    document.addEventListener("pointerdown", () => bgm.on && playBgm(), { once: true });
  });
  if (!bgm.timer) bgm.timer = setInterval(updateBgmVolume, 100);
}

function stopBgm() {
  bgm.audio.pause();
  clearInterval(bgm.timer);
  bgm.timer = null;
}

function initBgm() {
  const button = document.getElementById("bgm-toggle");
  bgm.audio.loop = true;
  bgm.audio.preload = "metadata";
  bgm.audio.volume = BGM_VOLUME;

  // ファイルが読めたら、ボタンを出す
  bgm.audio.addEventListener("loadedmetadata", () => {
    button.hidden = false;
    renderBgmButton();
    if (bgm.on) playBgm();
  }, { once: true });
  bgm.audio.src = BGM_SRC;

  button.onclick = () => {
    bgm.on = !bgm.on;
    saveBgmOn();
    renderBgmButton();
    if (bgm.on) playBgm();
    else stopBgm();
  };
}

initBgm();
