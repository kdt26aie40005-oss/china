// ヘッダーのキャラクターの吹き出し（顔文字）
// ふだんは、CHARA_CHANGE_EVERY 回クリックするたびに default の顔文字がランダムで変わる。
// 正解・不正解のときは charaReact("joy" | "sad") で、しばらく喜び・悲しみの顔文字を出す。

const CHARA_CHANGE_EVERY = 5;     // 何回クリックしたら、ふだんの顔文字を変えるか
const CHARA_REACT_MS = 3000;      // 喜び・悲しみを出しておく時間（ミリ秒）

const charaBubble = document.getElementById("chara-face");
let charaDefault = "";
let charaClicks = 0;
let charaReactTimer = null;

// 同じ顔文字が続かないように選ぶ
function charaPick(list, current) {
  const choices = list.length > 1 ? list.filter((k) => k !== current) : list;
  return choices[Math.floor(Math.random() * choices.length)];
}

function charaShow(face) {
  if (!charaBubble) return;
  charaBubble.textContent = face;
  // 変わったことが分かるように、吹き出しを少し跳ねさせる
  const bubble = charaBubble.parentElement;
  bubble.classList.remove("chara-pop");
  void bubble.offsetWidth; // アニメーションをやり直すため
  bubble.classList.add("chara-pop");
}

function charaReact(mood) {
  const list = KAOMOJI[mood];
  if (!list) return;
  clearTimeout(charaReactTimer);
  charaShow(charaPick(list, charaBubble?.textContent));
  charaReactTimer = setTimeout(() => {
    charaReactTimer = null;
    charaShow(charaDefault);
  }, CHARA_REACT_MS);
}

function charaNextDefault() {
  charaDefault = charaPick(KAOMOJI.default, charaDefault);
  // 喜び・悲しみを出している間は上書きしない（終わったら新しい顔文字に戻る）
  if (!charaReactTimer) charaShow(charaDefault);
}

document.addEventListener("click", () => {
  charaClicks++;
  if (charaClicks % CHARA_CHANGE_EVERY === 0) charaNextDefault();
}, true);

charaNextDefault();
