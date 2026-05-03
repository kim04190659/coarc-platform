// =====================================================
//  src/data/contacts-sample.ts
//  問い合わせ管理 サンプルデータ（4社分）
//
//  ■ データ構造
//    Contact型: 問い合わせ1件の情報
//
//  ■ 本番化するときの手順
//    このファイルを Notion DB からの取得に差し替える。
//    companyId でフィルタリングするクエリは
//    src/app/api/contacts/route.ts に実装予定。
// =====================================================

/** 問い合わせチャネル */
export type ContactChannel = 'メール' | '電話' | 'Web' | '店頭' | 'LINE'

/** 問い合わせカテゴリ */
export type ContactCategory = '苦情' | '問い合わせ' | '要望' | '感謝' | 'その他'

/** 対応ステータス */
export type ContactStatus = '未対応' | '対応中' | '完了'

/** 優先度 */
export type ContactPriority = '高' | '中' | '低'

/** 問い合わせ1件の型定義 */
export type Contact = {
  id: string
  companyId: string          // 企業ID（CompanyContext と対応）
  date: string               // 受付日時（ISO 8601）
  channel: ContactChannel
  category: ContactCategory
  status: ContactStatus
  priority: ContactPriority
  customerName: string       // 顧客名（個人情報のため仮名）
  subject: string            // 件名（一覧に表示）
  content: string            // 本文（詳細画面に表示）
  assignee?: string          // 担当者名（未割当の場合は undefined）
  response?: string          // 対応済みの返答内容（あれば）
}

// ──────────────────────────────────────────────────
//  🏨 北野リゾートホテル（kitano-resort）
// ──────────────────────────────────────────────────
const KITANO_CONTACTS: Contact[] = [
  {
    id: 'KR-001',
    companyId: 'kitano-resort',
    date: '2025-04-28T09:15:00',
    channel: 'Web',
    category: '苦情',
    status: '未対応',
    priority: '高',
    customerName: '田中 美咲',
    subject: 'チェックイン待ち時間が長すぎる',
    content: `4月27日にチェックインしましたが、フロントで45分以上待たされました。
連休中とはいえ、スタッフの配置が明らかに不足していたと思います。
事前にオンラインチェックインを選択していたにもかかわらず、
同じ列に並ばされたことも納得がいきません。
改善を強くお願いします。`,
    assignee: undefined,
  },
  {
    id: 'KR-002',
    companyId: 'kitano-resort',
    date: '2025-04-27T14:30:00',
    channel: '電話',
    category: '問い合わせ',
    status: '完了',
    priority: '低',
    customerName: '鈴木 健一',
    subject: 'プールの営業時間と予約方法を教えてほしい',
    content: `5月のゴールデンウィークに宿泊予定です。
屋外プールの営業時間と、小学生の子供が一緒に利用できるか確認したいです。
また、事前予約は必要でしょうか？`,
    assignee: '山田 スタッフ',
    response: `ご連絡ありがとうございます。屋外プールの営業時間は9:00〜20:00（最終入場19:30）です。
お子様（小学生以上）はご利用いただけます。GW期間中は混雑が予想されますので、
フロントへのご予約をお勧めしております。ご不明な点はお気軽にお声がけください。`,
  },
  {
    id: 'KR-003',
    companyId: 'kitano-resort',
    date: '2025-04-29T22:45:00',
    channel: 'メール',
    category: '苦情',
    status: '対応中',
    priority: '高',
    customerName: '佐藤 浩子',
    subject: '部屋にGが出た。すぐ対応してほしい',
    content: `503号室に宿泊中です。深夜にバスルームでゴキブリが出ました。
一匹ではなく複数います。女性一人旅で大変怖い思いをしています。
今すぐ部屋を変えてもらうか、駆除してほしいです。
この状況では到底ゆっくり休めません。`,
    assignee: '夜勤 マネージャー',
  },
  {
    id: 'KR-004',
    companyId: 'kitano-resort',
    date: '2025-04-26T11:00:00',
    channel: 'Web',
    category: '感謝',
    status: '完了',
    priority: '低',
    customerName: '伊藤 良太',
    subject: '朝食と接客スタッフが素晴らしかった',
    content: `先週末に宿泊しました。朝食のビュッフェが地元食材をふんだんに使っており、
とても美味しかったです。特に対応してくれた朝食担当の女性スタッフ（ネームプレートに「木村」とありました）が
丁寧で笑顔が素敵でした。また利用させていただきます。ありがとうございました。`,
    assignee: '渉外 担当',
    response: `この度は温かいお言葉をいただきまして、誠にありがとうございます。
木村スタッフへも伝えました。またのお越しをスタッフ一同心よりお待ちしております。`,
  },
  {
    id: 'KR-005',
    companyId: 'kitano-resort',
    date: '2025-04-30T16:20:00',
    channel: 'LINE',
    category: '要望',
    status: '未対応',
    priority: '中',
    customerName: '高橋 恵美',
    subject: 'バリアフリー対応の部屋・設備を増やしてほしい',
    content: `母（車いす利用）と二人で宿泊を検討しています。
ホームページを確認しましたが、バリアフリー対応室が1部屋しかなく、
すでに満室でした。また、大浴場への動線も段差があるとの口コミを見て心配です。
施設改善を要望します。また、次回の予約に向けて優先予約の仕組みも検討いただけないでしょうか。`,
    assignee: undefined,
  },
  {
    id: 'KR-006',
    companyId: 'kitano-resort',
    date: '2025-04-25T10:05:00',
    channel: 'Web',
    category: '苦情',
    status: '未対応',
    priority: '中',
    customerName: '渡辺 直樹',
    subject: 'Wi-Fiが全く繋がらない',
    content: `4泊滞在中ですが、客室のWi-Fiが初日から繋がりません。
フロントに相談しましたが「調査中」のまま2日が経過しています。
テレワーク中のため業務に支障が出ています。早急な対応を求めます。
接続できない場合はキャンセルも検討しています。`,
    assignee: undefined,
  },
]

// ──────────────────────────────────────────────────
//  🏥 さくら医療グループ（sakura-medical）
// ──────────────────────────────────────────────────
const SAKURA_CONTACTS: Contact[] = [
  {
    id: 'SM-001',
    companyId: 'sakura-medical',
    date: '2025-04-29T08:30:00',
    channel: '電話',
    category: '苦情',
    status: '未対応',
    priority: '高',
    customerName: '中村 一郎',
    subject: '予約電話が繋がらない（10回以上かけている）',
    content: `内科の定期受診の予約を取りたいのですが、先週から毎日電話をかけても
話し中か、繋がっても10分以上保留にされてしまいます。
高齢の父を連れて行きたいのですが、予約が取れずに困っています。
Web予約もありますが、父がスマートフォンを使えないため電話しか手段がありません。
早急に電話受付の改善をお願いします。`,
    assignee: undefined,
  },
  {
    id: 'SM-002',
    companyId: 'sakura-medical',
    date: '2025-04-28T15:45:00',
    channel: 'Web',
    category: '問い合わせ',
    status: '対応中',
    priority: '中',
    customerName: '松本 洋子',
    subject: '診察費の明細・領収書の再発行について',
    content: `3月に受診した際の診察費の明細書を確認したいです。
医療費控除の申告に必要なため、領収書の再発行も合わせてお願いしたいです。
郵送での対応は可能でしょうか？また、手数料はかかりますか？`,
    assignee: '医事 担当',
  },
  {
    id: 'SM-003',
    companyId: 'sakura-medical',
    date: '2025-04-30T13:00:00',
    channel: '店頭',
    category: '苦情',
    status: '未対応',
    priority: '高',
    customerName: '吉田 明美',
    subject: '2時間以上の待ち時間。事前連絡がなかった',
    content: `本日10時に予約していましたが、12時15分まで待たされました。
待合室のスタッフに確認しても「もう少しお待ちください」と繰り返すだけで、
具体的な待ち時間を教えてもらえませんでした。
急用があり、待ち時間が分かれば外出できたのに、その配慮もありませんでした。
このような運営では次回の来院を考え直してしまいます。`,
    assignee: undefined,
  },
  {
    id: 'SM-004',
    companyId: 'sakura-medical',
    date: '2025-04-27T17:20:00',
    channel: 'メール',
    category: '感謝',
    status: '完了',
    priority: '低',
    customerName: '小林 誠',
    subject: '担当医師の説明が非常に丁寧で安心できた',
    content: `先日、整形外科を受診しました。担当の山田先生が、
専門用語を使わずにわかりやすく病状と治療方針を説明してくださいました。
また、質問をしやすい雰囲気を作ってくださり、不安が大幅に解消されました。
このような先生がいるクリニックを選んで良かったです。今後もよろしくお願いします。`,
    assignee: '渉外 担当',
    response: `山田医師へもお伝えしました。今後もご丁寧なサービスを心がけてまいります。`,
  },
  {
    id: 'SM-005',
    companyId: 'sakura-medical',
    date: '2025-04-30T09:55:00',
    channel: 'Web',
    category: '問い合わせ',
    status: '未対応',
    priority: '高',
    customerName: '加藤 由美',
    subject: '処方薬（〇〇錠）の副作用について至急相談したい',
    content: `昨日処方いただいた血圧の薬（アムロジピン錠5mg）を服用し始めたところ、
今朝から動悸とめまいが続いています。添付文書を確認しましたが心配で。
これは副作用でしょうか？服用を中止すべきか、先生に相談したいです。
できれば今日中にご連絡いただけると助かります。`,
    assignee: undefined,
  },
]

// ──────────────────────────────────────────────────
//  🍜 麺屋フードチェーン（mensho-food）
// ──────────────────────────────────────────────────
const MENSHO_CONTACTS: Contact[] = [
  {
    id: 'MF-001',
    companyId: 'mensho-food',
    date: '2025-04-29T20:10:00',
    channel: 'Web',
    category: '苦情',
    status: '未対応',
    priority: '中',
    customerName: '西村 大輔',
    subject: '〇〇店の味が以前と全然違う。スープが薄くなった',
    content: `新宿店に週2〜3回通っている常連です。先週から突然スープの味が薄くなり、
以前の濃厚なコクがなくなっています。スープの仕込み方法や材料が変わりましたか？
麺屋さんのラーメンが大好きで通い続けてきたのに、とても残念です。
改善をお願いします。もし変更があったのであれば理由も教えてください。`,
    assignee: undefined,
  },
  {
    id: 'MF-002',
    companyId: 'mensho-food',
    date: '2025-04-28T12:00:00',
    channel: 'LINE',
    category: '問い合わせ',
    status: '完了',
    priority: '低',
    customerName: '岡田 花子',
    subject: 'テイクアウトの注文方法と受け取り時間について',
    content: `テイクアウトを初めて利用したいのですが、注文方法を教えてください。
アプリからの注文は可能ですか？また、注文してから何分程度で受け取れますか？
当日の利用を考えています。`,
    assignee: '本部 CS担当',
    response: `LINEからのご注文はこちらのリンクから可能です。当日注文の場合は
15〜20分でご用意できます。混雑時は30分ほどお待ちいただく場合があります。`,
  },
  {
    id: 'MF-003',
    companyId: 'mensho-food',
    date: '2025-04-30T11:30:00',
    channel: 'メール',
    category: '問い合わせ',
    status: '未対応',
    priority: '高',
    customerName: '橋本 智子',
    subject: 'アレルギー対応：小麦・卵・乳アレルギーのメニューはありますか',
    content: `小学校2年生の子供が小麦・卵・乳製品のアレルギーを持っています。
麺屋さんのお店に連れて行きたいのですが、対応可能なメニューや
調理時の配慮について教えていただけますか？
もし対応が難しい場合は、その旨もお知らせください。`,
    assignee: undefined,
  },
  {
    id: 'MF-004',
    companyId: 'mensho-food',
    date: '2025-04-27T14:15:00',
    channel: '店頭',
    category: '感謝',
    status: '完了',
    priority: '低',
    customerName: '藤井 健太',
    subject: '渋谷店スタッフの対応が親切で感動した',
    content: `昨日、渋谷店を訪れました。財布を忘れたことに気づき、困っていたところ、
店長さんが「次回いらした際にお支払いいただければ結構です」と声をかけてくださいました。
感動してその場でお金をATMから下ろしてお支払いしました。
こんな親切な対応をしてくださるお店には一生通い続けます。ありがとうございます。`,
    assignee: '渉外 担当',
    response: `温かいお言葉、誠にありがとうございます。渋谷店スタッフにも伝えました。`,
  },
  {
    id: 'MF-005',
    companyId: 'mensho-food',
    date: '2025-04-29T18:50:00',
    channel: 'Web',
    category: '苦情',
    status: '対応中',
    priority: '中',
    customerName: '山口 敏郎',
    subject: '予約確認メールが届かない。ドタキャン扱いにされた',
    content: `先日、Web予約をして確認画面まで進みましたが、確認メールが届きませんでした。
当日来店したところ「予約が入っていない」と言われ、席を用意してもらえませんでした。
結局、友人グループ5名でお断りされ、別の店舗に行くことになりました。
予約システムの不具合なのか、メール設定の問題なのかを確認してほしいです。`,
    assignee: 'システム 担当',
  },
]

// ──────────────────────────────────────────────────
//  🛒 ハナマルストア（hanamaru-store）
// ──────────────────────────────────────────────────
const HANAMARU_CONTACTS: Contact[] = [
  {
    id: 'HM-001',
    companyId: 'hanamaru-store',
    date: '2025-04-30T10:25:00',
    channel: '電話',
    category: '苦情',
    status: '未対応',
    priority: '高',
    customerName: '中島 美穂',
    subject: '購入した炊飯器が初期不良。すぐ交換してほしい',
    content: `4月28日に〇〇店で炊飯器（メーカー：△△、型番：RC-10）を購入しました。
自宅で開封したところ、電源ボタンが反応しません。明らかな初期不良です。
レシートはあります。店舗に持ち込まずに宅配便で交換対応できますか？
またいつ頃の配送になりますか？急ぎで使いたいのでできるだけ早くお願いします。`,
    assignee: undefined,
  },
  {
    id: 'HM-002',
    companyId: 'hanamaru-store',
    date: '2025-04-28T11:00:00',
    channel: 'Web',
    category: '問い合わせ',
    status: '完了',
    priority: '低',
    customerName: '森田 俊介',
    subject: 'ポイントカードの有効期限と残高確認方法',
    content: `ハナマルポイントカードを3年ほど使っていませんでした。
有効期限はあるのでしょうか？また残高を確認する方法を教えてください。
アプリでも確認できますか？`,
    assignee: 'CS 担当',
    response: `ポイントの有効期限は最終ご利用日より2年間です。残高はアプリまたは
店頭のカードリーダーでご確認いただけます。アプリのDLはこちら→[URL]`,
  },
  {
    id: 'HM-003',
    companyId: 'hanamaru-store',
    date: '2025-04-29T15:40:00',
    channel: 'メール',
    category: '問い合わせ',
    status: '対応中',
    priority: '中',
    customerName: '村上 幸子',
    subject: '未開封商品の返品・交換手続きの確認',
    content: `先日購入した洗濯洗剤（未開封）が自宅に在庫があり不要になりました。
未開封ですが、購入から2週間が経過しています。返品は可能でしょうか？
レシートは手元にあります。また、別商品との交換は可能ですか？`,
    assignee: 'CS 担当',
  },
  {
    id: 'HM-004',
    companyId: 'hanamaru-store',
    date: '2025-04-30T16:00:00',
    channel: '店頭',
    category: '苦情',
    status: '未対応',
    priority: '中',
    customerName: '三宅 一夫',
    subject: 'レジ待ちが30分。有人レジを減らしすぎでは',
    content: `本日夕方17時頃に〇〇店を訪れました。レジが2台しか稼働しておらず、
セルフレジも5台中3台が故障中とのことで、30分近く待ちました。
最近どの店舗でも有人レジを減らしてセルフ化が進んでいますが、
機械が故障した時のバックアップ体制が全くできていません。
抜本的な改善を求めます。`,
    assignee: undefined,
  },
  {
    id: 'HM-005',
    companyId: 'hanamaru-store',
    date: '2025-04-27T13:30:00',
    channel: 'Web',
    category: '感謝',
    status: '完了',
    priority: '低',
    customerName: '石井 陽子',
    subject: 'スタッフが迷子の子供を親切に助けてくれた',
    content: `先週末、子供（5歳）が店内で迷子になり、パニックになっていたところ、
男性スタッフ（〇〇店・40代くらいの方）が見つけてくださり、放送で私を呼んでくださいました。
子供が怖がらないよう声をかけながら一緒にいてくれて、本当に感謝しています。
スタッフの方にお礼を伝えたいのですが、どのようにすればよいですか？`,
    assignee: '渉外 担当',
    response: `温かいお言葉、誠にありがとうございます。スタッフにも伝えました。お礼のお申し出も、
気持ちだけで十分です。またのご来店をお待ちしております。`,
  },
  {
    id: 'HM-006',
    companyId: 'hanamaru-store',
    date: '2025-04-30T09:00:00',
    channel: 'LINE',
    category: '要望',
    status: '未対応',
    priority: '低',
    customerName: '池田 修',
    subject: 'ネットスーパーの配送エリアを拡大してほしい',
    content: `ハナマルのネットスーパーが便利で使いたいのですが、
私の住む地域（〇〇市△△区）が配送エリア外です。
近隣のスーパーはすでにネット注文に対応しているため、
このままだと他社に乗り換えざるを得ません。
エリア拡大の予定があれば教えてください。`,
    assignee: undefined,
  },
]

// ──────────────────────────────────────────────────
//  全社のデータをまとめてエクスポート
// ──────────────────────────────────────────────────
export const ALL_CONTACTS: Contact[] = [
  ...KITANO_CONTACTS,
  ...SAKURA_CONTACTS,
  ...MENSHO_CONTACTS,
  ...HANAMARU_CONTACTS,
]

/**
 * 企業IDで問い合わせをフィルタリングして返す
 * @param companyId 企業ID（例: 'kitano-resort'）
 */
export function getContactsByCompany(companyId: string): Contact[] {
  return ALL_CONTACTS.filter(c => c.companyId === companyId)
}

/**
 * IDで問い合わせを1件取得する
 * @param id 問い合わせID（例: 'KR-001'）
 */
export function getContactById(id: string): Contact | undefined {
  return ALL_CONTACTS.find(c => c.id === id)
}
