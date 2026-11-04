// ===== 翻訳して単語を追加（フレーズの「自分で追加」） =====
// 翻訳モデル M2M100（Transformers.js）をブラウザの中で動かして、日本語 → 中国語に訳す。
// 入力した言葉はどこにも送信されない。モデルは「翻訳する」を初めて押したときに読み込む（約630MB）。
// ピンインは pinyin-pro で付ける。
// app.js の speak() / addCustomWord() / studyPhrases() / renderCategories() / renderPhrases() / state を使う。

const MT_LIB_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js";
const MT_PINYIN_URL = "https://cdn.jsdelivr.net/npm/pinyin-pro@3.29.5/+esm";
const MT_MODEL = "Xenova/m2m100_418M";

// 日本語と中国語で意味がずれる言葉。AI がまちがえやすいので、こちらの訳を優先する
const MT_FIXES = {
  先生: "老师", // 中国語の「先生」は男性への敬称
  新聞: "报纸", // 中国語の「新闻」はニュース
  床: "地板", // 中国語の「床」はベッド
  丈夫: "结实", // 中国語の「丈夫」は夫
  留守: "不在家",
  手紙: "信", // 中国語の「手纸」はトイレットペーパー
  汽車: "火车", // 中国語の「汽车」は自動車
  勉強: "学习",
  大丈夫: "没关系",
  娘: "女儿", // 中国語の「娘」は母親
  愛人: "恋人", // 中国語の「爱人」は配偶者
  湯: "热水",
  お湯: "热水",
  質問: "问题", // 中国語の「质问」は問いつめる
  工夫: "想办法", // 中国語の「工夫」は時間
  人参: "胡萝卜", // 中国語の「人参」は朝鮮人参
  切符: "票",
  携帯: "手机",
  携帯電話: "手机",
  走る: "跑",
  美味しい: "好吃",
  おいしい: "好吃",
};

const MT_PUNCT = /[\s，。！？、；：,.!?;:'"“”‘’（）()]/g;
const MT_HAN = /\p{Script=Han}/u;
const MT_KANA = /[぀-ヿ]/;

let mtPromise = null;
let mtBusy = false;

const mtEls = {
  input: document.getElementById("mt-input"),
  translate: document.getElementById("mt-translate"),
  status: document.getElementById("mt-status"),
  result: document.getElementById("mt-result"),
  zh: document.getElementById("mt-zh"),
  py: document.getElementById("mt-py"),
  ja: document.getElementById("mt-ja"),
  back: document.getElementById("mt-back"),
  warn: document.getElementById("mt-warn"),
  play: document.getElementById("mt-play"),
  add: document.getElementById("mt-add"),
  cancel: document.getElementById("mt-cancel"),
};

function mtSetStatus(text) {
  mtEls.status.textContent = text;
}

function mtSetWarn(lines) {
  mtEls.warn.hidden = !lines.length;
  mtEls.warn.textContent = lines.map((l) => `⚠ ${l}`).join("\n");
}

// 翻訳モデルとピンインのライブラリを読み込む（1回だけ。失敗したら次に押したとき再挑戦）
function mtLoad() {
  if (!mtPromise) {
    mtSetStatus("翻訳AIを読み込んでいます…（初回だけ約630MBのダウンロードがあります）");
    const files = new Map();
    const onProgress = (p) => {
      if (p.status !== "progress" || !p.total) return;
      files.set(p.file, p);
      const loaded = [...files.values()].reduce((s, f) => s + f.loaded, 0);
      const total = [...files.values()].reduce((s, f) => s + f.total, 0);
      mtSetStatus(`翻訳AIを読み込んでいます… ${Math.floor((loaded / total) * 100)}%（初回だけ時間がかかります）`);
    };
    mtPromise = Promise.all([
      import(MT_LIB_URL).then(({ pipeline }) => pipeline("translation", MT_MODEL, { progress_callback: onProgress })),
      import(MT_PINYIN_URL),
    ])
      .then(([translator, { pinyin }]) => ({ translator, pinyin }))
      .catch((err) => {
        mtPromise = null;
        throw err;
      });
  }
  return mtPromise;
}

async function mtRun(text, from, to) {
  const { translator } = await mtLoad();
  const out = await translator(text, { src_lang: from, tgt_lang: to });
  return out[0].translation_text.trim();
}

// AI の訳を整える（半角の記号を全角に。単語なら記号を取る）
function mtClean(zh, isWord) {
  zh = zh.replace(/\?/g, "？").replace(/!/g, "！").replace(/,/g, "，").replace(/\s+/g, "");
  if (isWord) zh = zh.replace(MT_PUNCT, "");
  return zh;
}

// 「丈夫な」「美味しいです」のような語尾を取って、辞書（MT_FIXES）を引く
function mtFix(ja) {
  const key = ja.replace(MT_PUNCT, "").replace(/(です|だ|な)$/, "");
  return MT_FIXES[key] || null;
}

async function mtPinyin(zh) {
  const { pinyin } = await mtLoad();
  return pinyin(zh.replace(MT_PUNCT, ""));
}

// 中国語 → 日本語に訳し戻して、意味がずれていないか確かめられるようにする
async function mtBackTranslate(zh) {
  mtEls.back.textContent = "意味を確かめています…";
  try {
    const ja = await mtRun(zh, "zh", "ja");
    if (mtEls.zh.value.trim() === zh) mtEls.back.textContent = `🔁 この中国語を日本語に訳し戻すと：「${ja}」`;
  } catch {
    mtEls.back.textContent = "";
  }
}

function mtCheck(ja, zh, aiZh) {
  const warns = [];
  if (!MT_HAN.test(zh)) warns.push("中国語（漢字）になっていません。直してから追加してください");
  if (MT_KANA.test(zh)) warns.push("ひらがな・カタカナが残っています。うまく訳せなかったかもしれません");
  if (aiZh && aiZh === ja.replace(MT_PUNCT, "") && MT_HAN.test(ja)) {
    warns.push("日本語のまま返ってきました。うまく訳せなかったかもしれません");
  }
  return warns;
}

async function mtTranslate() {
  const ja = mtEls.input.value.trim();
  if (!ja || mtBusy) return;
  mtBusy = true;
  mtEls.translate.disabled = true;
  mtEls.result.hidden = true;
  try {
    await mtLoad();
    mtSetStatus("翻訳しています…");
    const isWord = !/[。！？!?、，,]/.test(ja) && ja.length <= 12;
    const aiZh = mtClean(await mtRun(ja, "ja", "zh"), isWord);
    const fix = mtFix(ja);
    const zh = fix || aiZh;

    mtEls.zh.value = zh;
    mtEls.py.value = await mtPinyin(zh);
    mtEls.ja.value = ja;
    mtEls.result.hidden = false;

    const warns = mtCheck(ja, zh, fix ? null : aiZh);
    if (fix && fix !== aiZh) {
      warns.unshift(`日本語と中国語で意味がずれやすい言葉なので、辞書の訳にしました（AIの訳：「${aiZh}」）`);
    }
    mtSetWarn(warns);
    mtSetStatus("訳を確かめて、必要なら直してから「追加する」を押してください");
    mtBackTranslate(zh);
  } catch (err) {
    console.error(err);
    mtSetStatus("翻訳AIを読み込めませんでした。インターネット接続を確認して、もう一度押してください");
  } finally {
    mtBusy = false;
    mtEls.translate.disabled = false;
  }
}

function mtReset() {
  mtEls.result.hidden = true;
  mtEls.input.value = "";
  mtSetWarn([]);
}

function mtAdd() {
  const word = { zh: mtEls.zh.value.trim(), py: mtEls.py.value.trim(), ja: mtEls.ja.value.trim() };
  if (!word.zh || !word.py || !word.ja) {
    mtSetStatus("中国語・ピンイン・日本語をすべて入れてください");
    return;
  }
  if (!MT_HAN.test(word.zh) || MT_KANA.test(word.zh)) {
    mtSetStatus("中国語の欄を、中国語（漢字）に直してから追加してください");
    return;
  }
  if (studyPhrases().some((p) => p.zh === word.zh)) {
    mtSetStatus(`「${word.zh}」はもう入っています`);
    return;
  }
  addCustomWord(word);
  mtReset();
  mtSetStatus(`「${word.zh}」を追加しました。クイズにも出てきます`);
  state.category = CUSTOM_CATEGORY.id;
  renderCategories();
  renderPhrases();
}

// ----- ボタン -----
mtEls.translate.onclick = mtTranslate;
mtEls.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    mtTranslate();
  }
});
// 中国語を直したら、ピンインと訳し戻しも作り直す
mtEls.zh.addEventListener("change", async () => {
  const zh = mtEls.zh.value.trim();
  if (!zh || !mtPromise) return;
  try {
    mtEls.py.value = await mtPinyin(zh);
    mtSetWarn(mtCheck(mtEls.ja.value, zh, null));
    mtBackTranslate(zh);
  } catch {
    // 読み込めないときはピンインを手で直してもらう
  }
});
mtEls.play.onclick = () => mtEls.zh.value.trim() && speak(mtEls.zh.value.trim());
mtEls.add.onclick = mtAdd;
mtEls.cancel.onclick = () => {
  mtReset();
  mtSetStatus("");
};
