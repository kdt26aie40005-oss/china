// フレーズデータ
// 追加するときは { zh: 漢字, py: ピンイン, ja: 日本語 } を items に足すだけでOK
const PHRASE_CATEGORIES = [
  {
    id: "greeting",
    name: "あいさつ",
    items: [
      { zh: "你好", py: "nǐ hǎo", ja: "こんにちは" },
      { zh: "早上好", py: "zǎoshang hǎo", ja: "おはようございます" },
      { zh: "谢谢", py: "xièxie", ja: "ありがとう" },
      { zh: "不客气", py: "bú kèqi", ja: "どういたしまして" },
      { zh: "对不起", py: "duìbuqǐ", ja: "ごめんなさい" },
      { zh: "没关系", py: "méi guānxi", ja: "大丈夫です・気にしないで" },
      { zh: "再见", py: "zàijiàn", ja: "さようなら" },
      { zh: "晚安", py: "wǎn'ān", ja: "おやすみなさい" },
    ],
  },
  {
    id: "intro",
    name: "自己紹介",
    items: [
      { zh: "你叫什么名字？", py: "nǐ jiào shénme míngzi?", ja: "お名前は何ですか？" },
      { zh: "我叫山田", py: "wǒ jiào Shāntián", ja: "私は山田といいます" },
      { zh: "我是日本人", py: "wǒ shì Rìběnrén", ja: "私は日本人です" },
      { zh: "我是学生", py: "wǒ shì xuésheng", ja: "私は学生です" },
      { zh: "认识你很高兴", py: "rènshi nǐ hěn gāoxìng", ja: "お会いできてうれしいです" },
      { zh: "我会说一点儿中文", py: "wǒ huì shuō yìdiǎnr Zhōngwén", ja: "中国語が少し話せます" },
    ],
  },
  {
    id: "conversation",
    name: "会話を続ける",
    items: [
      { zh: "好的", py: "hǎo de", ja: "わかりました・OK" },
      { zh: "是的", py: "shì de", ja: "はい、そうです" },
      { zh: "不是", py: "bú shì", ja: "いいえ、違います" },
      { zh: "我听不懂", py: "wǒ tīng bu dǒng", ja: "（聞いて）わかりません" },
      { zh: "请再说一遍", py: "qǐng zài shuō yí biàn", ja: "もう一度言ってください" },
      { zh: "请说慢一点儿", py: "qǐng shuō màn yìdiǎnr", ja: "もう少しゆっくり話してください" },
      { zh: "这个用中文怎么说？", py: "zhège yòng Zhōngwén zěnme shuō?", ja: "これは中国語で何と言いますか？" },
    ],
  },
  {
    id: "shopping",
    name: "買い物",
    items: [
      { zh: "多少钱？", py: "duōshao qián?", ja: "いくらですか？" },
      { zh: "我要这个", py: "wǒ yào zhège", ja: "これをください" },
      { zh: "太贵了", py: "tài guì le", ja: "高すぎます" },
      { zh: "便宜一点儿吧", py: "piányi yìdiǎnr ba", ja: "少し安くしてください" },
      { zh: "可以刷卡吗？", py: "kěyǐ shuā kǎ ma?", ja: "カードで払えますか？" },
      { zh: "可以用微信支付吗？", py: "kěyǐ yòng Wēixìn zhīfù ma?", ja: "WeChat Payは使えますか？" },
    ],
  },
  {
    id: "restaurant",
    name: "レストラン",
    items: [
      { zh: "服务员！", py: "fúwùyuán!", ja: "すみません！（店員さんを呼ぶ）" },
      { zh: "请给我菜单", py: "qǐng gěi wǒ càidān", ja: "メニューをください" },
      { zh: "我要一杯水", py: "wǒ yào yì bēi shuǐ", ja: "水を一杯ください" },
      { zh: "不要辣的", py: "bú yào là de", ja: "辛くしないでください" },
      { zh: "很好吃", py: "hěn hǎochī", ja: "とてもおいしいです" },
      { zh: "买单", py: "mǎidān", ja: "お会計お願いします" },
    ],
  },
  {
    id: "travel",
    name: "道・交通",
    items: [
      { zh: "厕所在哪儿？", py: "cèsuǒ zài nǎr?", ja: "トイレはどこですか？" },
      { zh: "地铁站在哪儿？", py: "dìtiězhàn zài nǎr?", ja: "地下鉄の駅はどこですか？" },
      { zh: "怎么走？", py: "zěnme zǒu?", ja: "どうやって行けばいいですか？" },
      { zh: "离这儿远吗？", py: "lí zhèr yuǎn ma?", ja: "ここから遠いですか？" },
      { zh: "请到这个地址", py: "qǐng dào zhège dìzhǐ", ja: "この住所までお願いします（タクシー）" },
    ],
  },
  {
    id: "trouble",
    name: "困ったとき",
    items: [
      { zh: "请帮帮我", py: "qǐng bāngbang wǒ", ja: "手伝ってください" },
      { zh: "我迷路了", py: "wǒ mílù le", ja: "道に迷いました" },
      { zh: "我不舒服", py: "wǒ bù shūfu", ja: "気分が悪いです" },
      { zh: "请叫警察", py: "qǐng jiào jǐngchá", ja: "警察を呼んでください" },
      { zh: "救命！", py: "jiùmìng!", ja: "助けて！" },
    ],
  },
];

// 声調の練習用データ
const TONES = [
  { zh: "妈", py: "mā", ja: "お母さん", tone: "第1声", desc: "高く平らにのばす" },
  { zh: "麻", py: "má", ja: "麻", tone: "第2声", desc: "低めから一気に上げる（「えぇ？」と聞き返す感じ）" },
  { zh: "马", py: "mǎ", ja: "馬", tone: "第3声", desc: "低く抑える（がっかりした「あ〜あ」の感じ）" },
  { zh: "骂", py: "mà", ja: "ののしる", tone: "第4声", desc: "高いところから一気に下げる（カラスの「カァ！」）" },
];
