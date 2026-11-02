// シナリオ会話のデータ
//
// steps の1つ = 相手のセリフ1つと、それへの返事の候補
//   id           : セリフの名前（分かれ道の行き先に使う）
//   zh / py / ja : 相手のセリフ（漢字・ピンイン・日本語訳）
//   hint         : どう返せばいいかのヒント（日本語・中国語）
//   answers      : 正解にする返事 [漢字, ピンイン, 日本語訳, 次のセリフのid（省略可）]
//                  ピンインは「1文字に1音節」で、漢字と同じ数だけ書く（発音のアドバイスに使う）
//                  「＿＿」の部分は自由（例: 我叫＿＿。→ 自分の名前を言えばOK）
//   next         : 返事に行き先がないときに進むセリフの id（省略可）
//
// 次に進むセリフの決まり方
//   1. 返事の4番目に id があればそこへ
//   2. なければセリフの next へ
//   3. それもなければ、配列の次のセリフへ
//   行き先を "end" にすると会話が終わる
//   分かれ道の先のセリフには next を書いて、本筋に戻すのを忘れないこと
const SCENARIOS = [
  {
    id: "intro",
    title: { ja: "自己紹介", zh: "自我介绍" },
    partner: { ja: "新しい友達", zh: "新朋友", icon: "🧑" },
    steps: [
      {
        id: "hello",
        zh: "你好！", py: "nǐ hǎo!", ja: "こんにちは！",
        hint: { ja: "あいさつを返そう", zh: "回应问候" },
        answers: [["你好！", "nǐ hǎo", "こんにちは！"]],
      },
      {
        id: "name",
        zh: "我叫李明。你叫什么名字？", py: "wǒ jiào Lǐ Míng. nǐ jiào shénme míngzi?", ja: "私は李明です。あなたのお名前は？",
        hint: { ja: "「我叫〜」で名前を言おう", zh: "用“我叫……”说名字" },
        answers: [["我叫＿＿。", "wǒ jiào", "私は〜といいます"]],
      },
      {
        id: "country",
        zh: "你是哪国人？", py: "nǐ shì nǎ guó rén?", ja: "どこの国の人ですか？",
        hint: { ja: "国籍を答えよう", zh: "说说你的国籍" },
        answers: [["我是日本人。", "wǒ shì Rì běn rén", "私は日本人です"]],
      },
      {
        id: "job",
        zh: "你是学生吗？", py: "nǐ shì xuésheng ma?", ja: "あなたは学生ですか？",
        hint: { ja: "学生か社会人かを答えよう", zh: "说你是学生还是上班族" },
        answers: [
          ["是，我是学生。", "shì wǒ shì xué sheng", "はい、学生です", "study"],
          ["对，我是学生。", "duì wǒ shì xué sheng", "そうです、学生です", "study"],
          ["不是，我是公司职员。", "bú shì wǒ shì gōng sī zhí yuán", "いいえ、会社員です", "work"],
        ],
      },
      {
        id: "study",
        zh: "你学什么？", py: "nǐ xué shénme?", ja: "何を勉強しているの？",
        hint: { ja: "専攻を答えよう", zh: "说你的专业" },
        answers: [
          ["我学中文。", "wǒ xué Zhōng wén", "中国語を勉強しています"],
          ["我学电脑。", "wǒ xué diàn nǎo", "コンピューターを勉強しています"],
          ["我学经济。", "wǒ xué jīng jì", "経済を勉強しています"],
        ],
        next: "why",
      },
      {
        id: "work",
        zh: "你做什么工作？", py: "nǐ zuò shénme gōngzuò?", ja: "どんな仕事をしているの？",
        hint: { ja: "仕事を答えよう", zh: "说你的工作" },
        answers: [
          ["我是工程师。", "wǒ shì gōng chéng shī", "エンジニアです"],
          ["我是老师。", "wǒ shì lǎo shī", "教師です"],
          ["我在公司工作。", "wǒ zài gōng sī gōng zuò", "会社で働いています"],
        ],
        next: "why",
      },
      {
        id: "why",
        zh: "你为什么学中文？", py: "nǐ wèishénme xué Zhōngwén?", ja: "どうして中国語を勉強しているの？",
        hint: { ja: "「因为〜（なぜなら〜）」で理由を言おう", zh: "用“因为……”说理由" },
        answers: [
          ["因为我喜欢中国菜。", "yīn wèi wǒ xǐ huan Zhōng guó cài", "中華料理が好きだからです"],
          ["因为我想去中国旅游。", "yīn wèi wǒ xiǎng qù Zhōng guó lǚ yóu", "中国に旅行したいからです"],
          ["因为工作需要。", "yīn wèi gōng zuò xū yào", "仕事で必要だからです"],
        ],
      },
      {
        id: "nice",
        zh: "认识你很高兴！", py: "rènshi nǐ hěn gāoxìng!", ja: "お会いできてうれしいです！",
        hint: { ja: "「私もうれしいです」と返そう", zh: "说“我也很高兴”" },
        answers: [
          ["我也很高兴。", "wǒ yě hěn gāo xìng", "私もうれしいです"],
          ["认识你我也很高兴。", "rèn shi nǐ wǒ yě hěn gāo xìng", "お会いできて私もうれしいです"],
        ],
      },
      {
        id: "meal",
        zh: "有时间一起吃饭吧！", py: "yǒu shíjiān yìqǐ chī fàn ba!", ja: "時間があったら一緒にご飯を食べよう！",
        hint: { ja: "誘いに乗るか、断ろう", zh: "接受或者拒绝邀请" },
        answers: [
          ["好啊！", "hǎo a", "いいね！", "end"],
          ["好的！", "hǎo de", "いいよ！", "end"],
          ["不好意思，我最近很忙。", "bù hǎo yì si wǒ zuì jìn hěn máng", "ごめんなさい、最近忙しいんです", "busy"],
        ],
      },
      {
        id: "busy",
        zh: "没关系，下次吧！", py: "méi guānxi, xià cì ba!", ja: "大丈夫、また今度ね！",
        hint: { ja: "「また今度」と返そう", zh: "说“下次见”" },
        answers: [
          ["好的，下次见！", "hǎo de xià cì jiàn", "うん、また今度！"],
          ["谢谢，再见！", "xiè xie zài jiàn", "ありがとう、またね！"],
        ],
        next: "end",
      },
    ],
  },
  {
    id: "restaurant",
    title: { ja: "レストラン", zh: "在餐厅" },
    partner: { ja: "店員さん", zh: "服务员", icon: "🧑‍🍳" },
    steps: [
      {
        id: "seat",
        zh: "欢迎光临！几位？", py: "huānyíng guānglín! jǐ wèi?", ja: "いらっしゃいませ！何名様ですか？",
        hint: { ja: "人数を答えよう", zh: "说人数" },
        answers: [
          ["两位。", "liǎng wèi", "2人です"],
          ["一个人。", "yí ge rén", "1人です"],
          ["三位。", "sān wèi", "3人です"],
        ],
      },
      {
        id: "order",
        zh: "这是菜单。您想吃什么？", py: "zhè shì càidān. nín xiǎng chī shénme?", ja: "こちらがメニューです。何を召し上がりますか？",
        hint: { ja: "「我要〜」で注文しよう（宮保鶏丁は辛い料理）", zh: "用“我要……”点菜" },
        answers: [
          ["我要一个宫保鸡丁。", "wǒ yào yí ge gōng bǎo jī dīng", "宮保鶏丁を1つください", "spicy"],
          ["我要饺子。", "wǒ yào jiǎo zi", "餃子をください", "drink"],
          ["我要炒饭。", "wǒ yào chǎo fàn", "チャーハンをください", "drink"],
        ],
      },
      {
        id: "spicy",
        zh: "宫保鸡丁有点儿辣，没问题吗？", py: "gōngbǎo jīdīng yǒudiǎnr là, méi wèntí ma?", ja: "宮保鶏丁は少し辛いですが、大丈夫ですか？",
        hint: { ja: "辛さの好みを伝えよう", zh: "说说你能不能吃辣" },
        answers: [
          ["没问题，我喜欢吃辣的。", "méi wèn tí wǒ xǐ huan chī là de", "大丈夫、辛いのが好きです"],
          ["请做得不要太辣。", "qǐng zuò de bú yào tài là", "あまり辛くしないでください"],
          ["那不要辣的。", "nà bú yào là de", "じゃあ辛くしないでください"],
        ],
      },
      {
        id: "drink",
        zh: "要喝点儿什么吗？", py: "yào hē diǎnr shénme ma?", ja: "何かお飲みになりますか？",
        hint: { ja: "飲み物を頼むか、断ろう", zh: "点饮料，或者说不用" },
        answers: [
          ["我要一杯茶。", "wǒ yào yì bēi chá", "お茶を1杯ください", "taste"],
          ["一瓶啤酒。", "yì píng pí jiǔ", "ビールを1本", "taste"],
          ["不用了，谢谢。", "bú yòng le xiè xie", "けっこうです、ありがとう", "water"],
        ],
      },
      {
        id: "water",
        zh: "好的，那给您一杯水吧。", py: "hǎo de, nà gěi nín yì bēi shuǐ ba.", ja: "かしこまりました。ではお水をお持ちしますね。",
        hint: { ja: "お礼を言おう", zh: "说谢谢" },
        answers: [
          ["好的，谢谢。", "hǎo de xiè xie", "はい、ありがとう"],
          ["谢谢！", "xiè xie", "ありがとう！"],
        ],
        next: "taste",
      },
      {
        id: "taste",
        zh: "菜怎么样？", py: "cài zěnmeyàng?", ja: "お料理はいかがですか？",
        hint: { ja: "味の感想を言おう", zh: "说说味道怎么样" },
        answers: [
          ["很好吃！", "hěn hǎo chī", "とてもおいしいです！", "more"],
          ["非常好吃！", "fēi cháng hǎo chī", "すごくおいしいです！", "more"],
          ["有点辣。", "yǒu diǎn là", "ちょっと辛いです", "hot"],
        ],
      },
      {
        id: "hot",
        zh: "要不要再来一杯水？", py: "yào bu yào zài lái yì bēi shuǐ?", ja: "お水をもう1杯お持ちしましょうか？",
        hint: { ja: "水がほしいか答えよう", zh: "说要不要水" },
        answers: [
          ["要，谢谢。", "yào xiè xie", "お願いします"],
          ["不用了。", "bú yòng le", "大丈夫です"],
        ],
        next: "more",
      },
      {
        id: "more",
        zh: "还需要别的吗？", py: "hái xūyào bié de ma?", ja: "ほかに何かご入用ですか？",
        hint: { ja: "お会計をお願いするか、追加で注文しよう", zh: "结账，或者再点一些" },
        answers: [
          ["不用了，买单。", "bú yòng le mǎi dān", "大丈夫です、お会計をお願いします", "bill"],
          ["买单，谢谢。", "mǎi dān xiè xie", "お会計をお願いします", "bill"],
          ["再来一瓶啤酒。", "zài lái yì píng pí jiǔ", "ビールをもう1本ください", "beer"],
        ],
      },
      {
        id: "beer",
        zh: "好的，马上来！", py: "hǎo de, mǎshàng lái!", ja: "かしこまりました、すぐお持ちします！",
        hint: { ja: "お礼を言おう", zh: "说谢谢" },
        answers: [["谢谢！", "xiè xie", "ありがとう！"]],
        next: "more",
      },
      {
        id: "bill",
        zh: "一共八十五块。", py: "yígòng bāshíwǔ kuài.", ja: "全部で85元です。",
        hint: { ja: "支払い方法を伝えよう", zh: "说怎么付钱" },
        answers: [
          ["可以用微信吗？", "kě yǐ yòng Wēi xìn ma", "WeChat Payは使えますか？"],
          ["给你钱。", "gěi nǐ qián", "お金をどうぞ"],
        ],
      },
      {
        id: "bye",
        zh: "谢谢，欢迎下次光临！", py: "xièxie, huānyíng xià cì guānglín!", ja: "ありがとうございました、またお越しください！",
        hint: { ja: "あいさつをしよう", zh: "说再见" },
        answers: [
          ["谢谢，再见！", "xiè xie zài jiàn", "ありがとう、さようなら！"],
          ["再见！", "zài jiàn", "さようなら！"],
        ],
        next: "end",
      },
    ],
  },
  {
    id: "shopping",
    title: { ja: "買い物", zh: "买东西" },
    partner: { ja: "お店の人", zh: "店员", icon: "🧑‍💼" },
    steps: [
      {
        id: "welcome",
        zh: "你好，想买点儿什么？", py: "nǐ hǎo, xiǎng mǎi diǎnr shénme?", ja: "いらっしゃい、何をお探しですか？",
        hint: { ja: "買いたい物を伝えるか「見ているだけ」と言おう", zh: "说想买什么，或者说随便看看" },
        answers: [
          ["我想买这个。", "wǒ xiǎng mǎi zhè ge", "これが買いたいです", "count"],
          ["我随便看看。", "wǒ suí biàn kàn kan", "ちょっと見ているだけです", "browse"],
        ],
      },
      {
        id: "browse",
        zh: "好的。这个很受欢迎，你看看？", py: "hǎo de. zhège hěn shòu huānyíng, nǐ kànkan?", ja: "どうぞ。これは人気ですよ、見てみますか？",
        hint: { ja: "すすめられた物を買うか、断ろう", zh: "买还是不买" },
        answers: [
          ["好，我要这个。", "hǎo wǒ yào zhè ge", "じゃあ、これにします", "count"],
          ["不用了，谢谢。", "bú yòng le xiè xie", "けっこうです、ありがとう", "leave"],
        ],
      },
      {
        id: "count",
        zh: "好的。你要几个？", py: "hǎo de. nǐ yào jǐ ge?", ja: "かしこまりました。いくつにしますか？",
        hint: { ja: "個数を答えよう（2つは「两个」）", zh: "说数量" },
        answers: [
          ["我要两个。", "wǒ yào liǎng ge", "2つください"],
          ["一个。", "yí ge", "1つ"],
          ["我要三个。", "wǒ yào sān ge", "3つください"],
        ],
      },
      {
        id: "price",
        zh: "一共一百二十块。", py: "yígòng yìbǎi èrshí kuài.", ja: "全部で120元です。",
        hint: { ja: "値切ってみよう。そのまま買ってもOK", zh: "试试讲价，直接买也可以" },
        answers: [
          ["太贵了！便宜一点吧。", "tài guì le pián yi yì diǎn ba", "高すぎます！少し安くしてください", "discount"],
          ["能便宜一点吗？", "néng pián yi yì diǎn ma", "少し安くできますか？", "discount"],
          ["好，我买了。", "hǎo wǒ mǎi le", "じゃあ買います", "pay"],
        ],
      },
      {
        id: "discount",
        zh: "那一百块吧。", py: "nà yìbǎi kuài ba.", ja: "じゃあ100元でいいですよ。",
        hint: { ja: "買うか、もっと値切ろう", zh: "买，或者再讲讲价" },
        answers: [
          ["好，我买了。", "hǎo wǒ mǎi le", "じゃあ買います", "pay"],
          ["好的，我要了。", "hǎo de wǒ yào le", "はい、それにします", "pay"],
          ["还是太贵了。", "hái shì tài guì le", "やっぱり高いです", "last"],
        ],
      },
      {
        id: "last",
        zh: "最低九十块，不能再便宜了。", py: "zuìdī jiǔshí kuài, bù néng zài piányi le.", ja: "90元が限界です、これ以上は無理ですよ。",
        hint: { ja: "買うか、あきらめよう", zh: "买还是不买" },
        answers: [
          ["好吧，我买了。", "hǎo ba wǒ mǎi le", "わかりました、買います", "pay"],
          ["那算了，谢谢。", "nà suàn le xiè xie", "じゃあやめておきます、ありがとう", "leave"],
        ],
      },
      {
        id: "pay",
        zh: "你怎么付钱？", py: "nǐ zěnme fù qián?", ja: "お支払いはどうしますか？",
        hint: { ja: "支払い方法を伝えよう", zh: "说怎么付钱" },
        answers: [
          ["我用微信。", "wǒ yòng Wēi xìn", "WeChat Payで"],
          ["用支付宝。", "yòng Zhī fù bǎo", "Alipayで"],
          ["现金。", "xiàn jīn", "現金で"],
        ],
      },
      {
        id: "thanks",
        zh: "谢谢，欢迎下次再来！", py: "xièxie, huānyíng xià cì zài lái!", ja: "ありがとうございます、またどうぞ！",
        hint: { ja: "お礼とあいさつをしよう", zh: "说谢谢和再见" },
        answers: [
          ["谢谢，再见！", "xiè xie zài jiàn", "ありがとう、さようなら！"],
          ["再见！", "zài jiàn", "さようなら！"],
        ],
        next: "end",
      },
      {
        id: "leave",
        zh: "好吧，欢迎再来看看！", py: "hǎo ba, huānyíng zài lái kànkan!", ja: "わかりました、またのぞいてくださいね！",
        hint: { ja: "あいさつをしよう", zh: "说再见" },
        answers: [
          ["好的，再见！", "hǎo de zài jiàn", "はい、さようなら！"],
          ["再见！", "zài jiàn", "さようなら！"],
        ],
        next: "end",
      },
    ],
  },
  {
    id: "directions",
    title: { ja: "道を尋ねる", zh: "问路" },
    partner: { ja: "通りすがりの人", zh: "路人", icon: "🚶" },
    steps: [
      {
        id: "ask",
        zh: "你好，有什么事吗？", py: "nǐ hǎo, yǒu shénme shì ma?", ja: "こんにちは、どうかしましたか？",
        hint: { ja: "行きたい場所を聞こう（地下鉄の駅・トイレ）", zh: "问地铁站或者厕所在哪里" },
        answers: [
          ["请问，地铁站在哪里？", "qǐng wèn dì tiě zhàn zài nǎ lǐ", "すみません、地下鉄の駅はどこですか？", "subway"],
          ["地铁站在哪里？", "dì tiě zhàn zài nǎ lǐ", "地下鉄の駅はどこですか？", "subway"],
          ["请问，厕所在哪里？", "qǐng wèn cè suǒ zài nǎ lǐ", "すみません、トイレはどこですか？", "toilet"],
        ],
      },
      {
        id: "subway",
        zh: "一直往前走，到红绿灯往左拐。", py: "yìzhí wǎng qián zǒu, dào hónglǜdēng wǎng zuǒ guǎi.", ja: "まっすぐ行って、信号を左に曲がってください。",
        hint: { ja: "遠いかどうか聞くか、聞き取れなかったらもう一度言ってもらおう", zh: "问远不远，或者请对方再说一遍" },
        answers: [
          ["远不远？", "yuǎn bu yuǎn", "遠いですか？", "far"],
          ["走路要多长时间？", "zǒu lù yào duō cháng shí jiān", "歩いてどのくらいかかりますか？", "far"],
          ["对不起，请再说一遍。", "duì bu qǐ qǐng zài shuō yí biàn", "すみません、もう一度言ってください", "again"],
        ],
      },
      {
        id: "again",
        zh: "一直走，然后左拐。", py: "yìzhí zǒu, ránhòu zuǒ guǎi.", ja: "まっすぐ行って、それから左です。",
        hint: { ja: "わかったと伝えるか、遠いか聞こう", zh: "说明白了，或者问远不远" },
        answers: [
          ["明白了，谢谢！", "míng bai le xiè xie", "わかりました、ありがとう！", "welcome"],
          ["远吗？", "yuǎn ma", "遠いですか？", "far"],
        ],
      },
      {
        id: "far",
        zh: "不远，走路五分钟。", py: "bù yuǎn, zǒu lù wǔ fēnzhōng.", ja: "遠くないですよ、歩いて5分です。",
        hint: { ja: "お礼を言おう", zh: "说谢谢" },
        answers: [
          ["谢谢你！", "xiè xie nǐ", "ありがとうございます！"],
          ["太好了，谢谢！", "tài hǎo le xiè xie", "よかった、ありがとう！"],
        ],
        next: "welcome",
      },
      {
        id: "toilet",
        zh: "厕所在那边，咖啡店旁边。", py: "cèsuǒ zài nàbiān, kāfēidiàn pángbiān.", ja: "トイレはあちらの、カフェの隣です。",
        hint: { ja: "お礼を言おう", zh: "说谢谢" },
        answers: [
          ["谢谢你！", "xiè xie nǐ", "ありがとうございます！"],
          ["明白了，谢谢！", "míng bai le xiè xie", "わかりました、ありがとう！"],
        ],
      },
      {
        id: "welcome",
        zh: "不客气！", py: "bú kèqi!", ja: "どういたしまして！",
        hint: { ja: "さよならを言おう", zh: "说再见" },
        answers: [["再见！", "zài jiàn", "さようなら！"]],
        next: "end",
      },
    ],
  },
  {
    id: "hotel",
    title: { ja: "ホテル", zh: "在酒店" },
    partner: { ja: "フロント係", zh: "前台", icon: "🛎️" },
    steps: [
      {
        id: "reserve",
        zh: "您好，请问有预订吗？", py: "nín hǎo, qǐngwèn yǒu yùdìng ma?", ja: "いらっしゃいませ、ご予約はありますか？",
        hint: { ja: "予約があるか答えよう（あれば名前も）", zh: "说有没有预订" },
        answers: [
          ["有，我叫＿＿。", "yǒu wǒ jiào", "あります、〜といいます", "passport"],
          ["有预订。", "yǒu yù dìng", "予約しています", "passport"],
          ["没有。", "méi yǒu", "ありません", "room"],
        ],
      },
      {
        id: "room",
        zh: "今天还有房间。您要单人间还是双人间？", py: "jīntiān hái yǒu fángjiān. nín yào dānrénjiān háishi shuāngrénjiān?", ja: "本日はまだお部屋があります。シングルとツイン、どちらにしますか？",
        hint: { ja: "部屋の種類を選ぼう", zh: "选房间" },
        answers: [
          ["单人间。", "dān rén jiān", "シングルで"],
          ["双人间。", "shuāng rén jiān", "ツインで"],
        ],
      },
      {
        id: "passport",
        zh: "请给我看一下您的护照。", py: "qǐng gěi wǒ kàn yíxià nín de hùzhào.", ja: "パスポートを見せていただけますか。",
        hint: { ja: "「どうぞ」と渡そう", zh: "说“给你”" },
        answers: [
          ["好的，给你。", "hǎo de gěi nǐ", "はい、どうぞ"],
          ["给你。", "gěi nǐ", "どうぞ"],
        ],
      },
      {
        id: "nights",
        zh: "您住几个晚上？", py: "nín zhù jǐ ge wǎnshang?", ja: "何泊されますか？",
        hint: { ja: "泊数を答えよう（2泊は「两个晚上」）", zh: "说住几个晚上" },
        answers: [
          ["两个晚上。", "liǎng ge wǎn shang", "2泊です"],
          ["一个晚上。", "yí ge wǎn shang", "1泊です"],
          ["三个晚上。", "sān ge wǎn shang", "3泊です"],
        ],
      },
      {
        id: "key",
        zh: "这是您的房卡。早餐在二楼，七点开始。", py: "zhè shì nín de fángkǎ. zǎocān zài èr lóu, qī diǎn kāishǐ.", ja: "こちらがルームキーです。朝食は2階で、7時からです。",
        hint: { ja: "お礼を言うか、気になることを聞こう", zh: "说谢谢，或者问问题" },
        answers: [
          ["好的，谢谢。", "hǎo de xiè xie", "わかりました、ありがとう", "enjoy"],
          ["无线网密码是多少？", "wú xiàn wǎng mì mǎ shì duō shao", "Wi-Fiのパスワードは何ですか？", "wifi"],
          ["早餐几点结束？", "zǎo cān jǐ diǎn jié shù", "朝食は何時までですか？", "breakfast"],
        ],
      },
      {
        id: "wifi",
        zh: "密码在房卡的后面。", py: "mìmǎ zài fángkǎ de hòumian.", ja: "パスワードはルームキーの裏に書いてあります。",
        hint: { ja: "お礼を言おう", zh: "说谢谢" },
        answers: [
          ["好的，谢谢。", "hǎo de xiè xie", "わかりました、ありがとう"],
          ["谢谢！", "xiè xie", "ありがとう！"],
        ],
        next: "enjoy",
      },
      {
        id: "breakfast",
        zh: "早餐到十点。", py: "zǎocān dào shí diǎn.", ja: "朝食は10時までです。",
        hint: { ja: "お礼を言おう", zh: "说谢谢" },
        answers: [
          ["好的，谢谢。", "hǎo de xiè xie", "わかりました、ありがとう"],
          ["谢谢！", "xiè xie", "ありがとう！"],
        ],
        next: "enjoy",
      },
      {
        id: "enjoy",
        zh: "祝您住得愉快！", py: "zhù nín zhù de yúkuài!", ja: "どうぞごゆっくりお過ごしください！",
        hint: { ja: "お礼を言おう", zh: "说谢谢" },
        answers: [["谢谢！", "xiè xie", "ありがとう！"]],
        next: "end",
      },
    ],
  },
];
