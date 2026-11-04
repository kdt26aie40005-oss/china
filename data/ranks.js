// 昇級審査（空手の帯）のデータ
//
// DOJO_RANKS … 級・段の一覧（下から順）。belt は帯の色（white / brown / black）、dan は黒帯の段の数
// DOJO_EXAMS … 審査の内容。DOJO_EXAMS[i] は DOJO_RANKS[i] から DOJO_RANKS[i + 1] に上がるための審査
//
// 審査の書き方:
//   categories … 出題するフレーズの場面（data/phrases.js の id）。"all" ですべて
//   nature     … true なら「写真で単語」で覚えた花・動物も出す
//   types      … 問題の形式（下の DOJO_QUESTION_TYPES を参照）
//   pinyin     … true なら選択肢・問題にピンインを付ける
//   similar    … true ならまちがいの選択肢を同じ場面から選ぶ（似ていて難しくなる）
//   count      … 問題数
//   pass       … 合格ライン（0.8 なら8割）
//   time       … 1問の制限時間（秒）。null なら制限なし
//   wait       … 前の昇級から、この審査を受けられるまでの日数
const DOJO_RANKS = [
  { name: "無級", belt: "white" },
  { name: "6級", belt: "white" },
  { name: "5級", belt: "white" },
  { name: "4級", belt: "white" },
  { name: "3級", belt: "brown" },
  { name: "2級", belt: "brown" },
  { name: "1級", belt: "brown" },
  { name: "初段", belt: "black", dan: 1 },
  { name: "二段", belt: "black", dan: 2 },
  { name: "三段", belt: "black", dan: 3 },
  { name: "四段", belt: "black", dan: 4 },
  { name: "五段", belt: "black", dan: 5 },
  { name: "六段", belt: "black", dan: 6 },
  { name: "七段", belt: "black", dan: 7 },
  { name: "八段", belt: "black", dan: 8 },
  { name: "九段", belt: "black", dan: 9 },
  { name: "十段", belt: "black", dan: 10 },
];

const DOJO_BELT_NAMES = { white: "白帯", brown: "茶帯", black: "黒帯" };

const DOJO_QUESTION_TYPES = {
  ja2zh: "日本語 → 中国語",
  zh2ja: "中国語 → 日本語",
  listen: "聞き取り",
  tone: "声調",
  speak: "発音（🎤）",
};

const DOJO_EXAMS = [
  // ----- 白帯 -----
  { categories: ["greeting", "intro"], types: ["ja2zh"], pinyin: true, count: 10, pass: 0.7 },
  { categories: ["greeting", "intro", "conversation"], types: ["ja2zh"], pinyin: true, count: 10, pass: 0.7 },
  { categories: ["greeting", "intro", "conversation", "shopping", "restaurant"], types: ["ja2zh", "zh2ja"], pinyin: true, count: 10, pass: 0.7 },
  // ----- 茶帯（4級 → 3級 から）-----
  { categories: "all", types: ["ja2zh", "zh2ja"], pinyin: true, count: 10, pass: 0.8 },
  { categories: "all", nature: true, types: ["ja2zh", "zh2ja", "listen"], pinyin: false, count: 10, pass: 0.8 },
  { categories: "all", nature: true, types: ["ja2zh", "zh2ja", "listen", "tone"], pinyin: false, count: 10, pass: 0.8 },
  // ----- 初段審査（黒帯）-----
  { categories: "all", nature: true, types: ["ja2zh", "zh2ja", "listen", "tone"], pinyin: false, similar: true, count: 20, pass: 0.9 },
  // ----- 二段〜十段：段が上がるほど制限時間が短くなり、待つ日数が長くなる -----
  ...Array.from({ length: 9 }, (_, i) => ({
    categories: "all",
    nature: true,
    types: i === 0 ? ["ja2zh", "zh2ja", "listen", "tone"] : ["ja2zh", "zh2ja", "listen", "tone", "speak"],
    pinyin: false,
    similar: true,
    count: 15,
    pass: 0.9,
    time: Math.round(20 - i * 1.5),
    wait: i + 1,
  })),
];

// 道場破り
const DOJO_RAID = {
  count: 10,
  pass: 0.8,
  // 最後に稽古した日から何日空いたかで、道場破りが来る確率が上がる（三日坊主対策）
  chance: (days) => (days >= 3 ? 0.5 : days === 2 ? 0.25 : days === 1 ? 0.1 : 0.05),
};

// 声調の聞き取り問題（同じ音で声調だけちがう字）
const DOJO_TONE_SETS = [
  [
    { zh: "妈", py: "mā", ja: "お母さん" },
    { zh: "麻", py: "má", ja: "麻" },
    { zh: "马", py: "mǎ", ja: "馬" },
    { zh: "骂", py: "mà", ja: "ののしる" },
  ],
  [
    { zh: "八", py: "bā", ja: "8" },
    { zh: "拔", py: "bá", ja: "抜く" },
    { zh: "把", py: "bǎ", ja: "つかむ" },
    { zh: "爸", py: "bà", ja: "お父さん" },
  ],
  [
    { zh: "汤", py: "tāng", ja: "スープ" },
    { zh: "糖", py: "táng", ja: "砂糖" },
    { zh: "躺", py: "tǎng", ja: "横になる" },
    { zh: "烫", py: "tàng", ja: "熱い" },
  ],
  [
    { zh: "衣", py: "yī", ja: "服" },
    { zh: "姨", py: "yí", ja: "おば" },
    { zh: "椅", py: "yǐ", ja: "いす" },
    { zh: "意", py: "yì", ja: "意味" },
  ],
];
