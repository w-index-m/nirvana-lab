const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/root/.claude/skills/synced/873d3bbd-f5ee-4b8c-9a98-2572553cb7c0_eea210e2-e365-400d-9ef2-489ddbf84912/pptx/scripts/apply_theme.js');

const OUT = process.argv[2] || 'deck.pptx';
const THEME = {
  name: 'Nirvana Behind',
  headFontFace: 'Meiryo',
  bodyFontFace: 'Meiryo',
  colors: {
    dk1: '070D17', lt1: 'FFFFFF', dk2: '13213A', lt2: 'DBE6F3',
    accent1: '4FD6E8', accent2: 'F2A93B', accent3: 'FF5A6A', accent4: 'A98BFF',
    accent5: '5FE0A0', accent6: '8BA0B8', hlink: '4FD6E8', folHlink: 'A98BFF',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Kiro で AWS を作る';
pres.author = 'Claude Code';
const C = pres.SchemeColor;
const SH = pres.shapes;

// ── layouts ──
pres.defineSlideMaster({
  title: 'TITLE_DARK',
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.55, w: 8.8, h: 1.4, fontSize: 36, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 3.05, w: 8.8, h: 1.5, fontSize: 16, color: C.accent1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT_DARK',
  background: { color: C.text1 },
  margin: [0.5, 0.5, 0.5, 0.5],
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.3, w: 9.0, h: 0.7, fontSize: 26, bold: true, color: C.background1, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
    { text: { text: 'Nirvana Lab ・ Kiro で AWS を作る', options: { x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 9, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 9, color: C.accent6, align: 'right' },
});

// ── helpers ──
function hex(slide, x, y, size, color, label, name, labelColor) {
  slide.addShape(SH.HEXAGON, { x, y, w: size, h: size * 0.88, fill: { color }, line: { color, width: 0 }, objectName: name });
  if (label) {
    slide.addText(label, { x, y, w: size, h: size * 0.88, align: 'center', valign: 'middle', fontSize: Math.round(size * 18), bold: true, color: labelColor || C.text1, margin: 0, isTextBox: true, objectName: name + ' label' });
  }
}
function card(slide, x, y, w, h, name) {
  slide.addShape(SH.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: C.text2 }, line: { color: C.text2, width: 0 }, objectName: name });
}
function txt(slide, text, opt) {
  slide.addText(text, Object.assign({ isTextBox: true, margin: 0, color: C.background2, fontSize: 14, valign: 'top' }, opt));
}

// タイトル
pres.addSection({ title: 'はじめに' });
let s = pres.addSlide({ masterName: 'TITLE_DARK', sectionTitle: 'はじめに' });
s.addText('Kiro で AWS を作る', { placeholder: 'title' });
s.addText('VPC・Direct Connect・ALB・NLB の構築と、要件定義書・設計書の作り方(2026-11-22 時点)', { placeholder: 'body' });
hex(s, 7.75, 0.45, 0.9, C.accent1, '', 'motif hex 1');
hex(s, 8.55, 0.95, 0.65, C.accent2, '', 'motif hex 2');
hex(s, 7.95, 1.25, 0.5, C.accent3, '', 'motif hex 3');
s.addNotes('この資料は、AWS の AI 開発ツール Kiro で AWS の構築を進めるときの整理です。Kiro とは何か、AWS の構築で何が楽になり何が人に残るか、VPC・Direct Connect・ALB・NLB の注意点、要件定義書と設計書の作り方を順に見ます。内容は 2026 年 11 月時点の公式ドキュメントで確かめたもので、Kiro 自体は実際には動かしていません。設計書の自動作成だけは、ラボの ALB の模擬装置で実際に試しました。親の資料「AI ドリブン開発の裏側」の続きにあたります。');

pres.addSection({ title: 'Kiro とは' });
// 11c. AWS の Kiro で開発するなら
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'Kiro とは' });
s.addText('Kiro とは: 仕様から入る AI 開発ツール', { placeholder: 'title' });
txt(s, 'Kiro: AWS の AI 開発ツール(VS Code 系のエディタ・CLI・Web)。コードの前に「仕様」を作るのが特徴', { x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 12, color: C.accent1 });
const KH = { bold: true, color: C.text1, fill: { color: C.accent2 }, fontSize: 11 };
const kn = (t) => ({ text: t, options: { bold: true, color: C.background1 } });
s.addTable([
  [{ text: 'Kiro の仕組み', options: KH }, { text: '何をするか', options: KH }, { text: 'この開発(Claude Code)での相当', options: KH }],
  [kn('Specs(仕様)'), { text: '依頼から requirements.md・design.md・tasks.md を先に作り、タスク順に実装' }, { text: '要件は会話で決め、結果を docs/ に残す' }],
  [kn('Steering'), { text: 'プロジェクトの決まりを Markdown で毎回渡す' }, { text: 'CLAUDE.md' }],
  [kn('Hooks'), { text: '保存・作成などのたびに、裏で決まった作業を走らせる' }, { text: 'Claude Code の hooks(例: 終わる前に commit・push を促す)' }],
  [kn('クラウドセッション / 自律エージェント'), { text: '管理されたクラウドの隔離環境で、手元を閉じても作業を続ける' }, { text: 'LLM サンドボックス(今回の作業場所)' }],
  [kn('MCP・Powers'), { text: '外部の道具をつなぐ。Powers は SAM など AWS 向けの手引き付き' }, { text: 'MCP(GitHub など)・skills' }],
], { x: 0.5, y: 1.45, w: 9.0, colW: [2.3, 3.6, 3.1], fontSize: 10, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.46, valign: 'middle', objectName: 'kiro table' });
txt(s, 'AWS 構築なら: Specs に要件、design に構成図、tasks に Terraform/SAM の作業を分け、親の資料「AI ドリブンで AWS を作るなら」の流れ(plan → 人の承認 → apply)に乗せる', { x: 0.5, y: 4.3, w: 9, h: 0.45, fontSize: 11 });
txt(s, '注意: Kiro のクラウドの隔離環境は、既定で外への通信が制限なし(今回のサンドボックスは許可制)。鍵の扱いは同じく慎重に', { x: 0.5, y: 4.75, w: 9, h: 0.4, fontSize: 10.5, color: C.accent3 });
s.addNotes('AWS には Kiro という AI 開発ツールがあります。VS Code 系のエディタのほか、CLI や Web でも使えます。特徴は、コードを書く前に仕様を作ることで、依頼から requirements、design、tasks の 3 つの Markdown を作り、タスクの順に実装します。プロジェクトの決まりを毎回渡す Steering は、この開発の CLAUDE.md に当たります。保存などのたびに裏で作業を走らせる Hooks は、Claude Code の hooks に当たります。クラウドセッションや自律エージェントは、管理されたクラウドの隔離環境で作業を続ける仕組みで、今回の LLM サンドボックスと同じ考え方です。AWS の構築に使うなら、Specs に要件、design に構成、tasks に Terraform や SAM の作業を分け、親の資料の「AI ドリブンで AWS を作るなら」の流れに乗せます。注意点として、Kiro のクラウドの隔離環境は既定で外への通信に制限が無いので、鍵の扱いは慎重にします。この資料では Kiro を実際には動かしていません。内容は 2026 年 11 月時点の公式ドキュメントで確かめたものです。');

pres.addSection({ title: 'AWS の構築' });
// 11d. Kiro で AWS 構築は楽になる?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'AWS の構築' });
s.addText('Kiro で AWS の構築は楽になる?', { placeholder: 'title' });
card(s, 0.5, 1.1, 4.35, 3.4, 'kiro easy card');
card(s, 5.15, 1.1, 4.35, 3.4, 'kiro hard card');
txt(s, '楽になる工程', { x: 0.75, y: 1.25, w: 3.9, h: 0.35, fontSize: 15, bold: true, color: C.accent5 });
const kEasy = [
  ['書く', '依頼から CDK・CloudFormation・Terraform を作る。Powers(CDK/CFn・SAM・Terraform)に手引きと道具が入っている'],
  ['調べる', 'AWS の MCP サーバーで、ドキュメントや今のリソースを調べながら作る'],
  ['出す', 'AWS MCP Server のデプロイ手順(SOP)で、CDK を作って CloudFormation でデプロイまで(プレビュー)'],
];
kEasy.forEach(([h, b], i) => {
  const y = 1.7 + i * 0.9;
  txt(s, h, { x: 0.75, y, w: 0.9, h: 0.3, fontSize: 13, bold: true, color: C.background1 });
  txt(s, b, { x: 1.6, y, w: 3.1, h: 0.85, fontSize: 10.5 });
});
txt(s, '楽にならない・増える工程', { x: 5.4, y: 1.25, w: 3.9, h: 0.35, fontSize: 15, bold: true, color: C.accent3 });
const kHard = [
  ['仕様を作る', 'Specs(要件・設計・タスク)を先に作るので、最初の工程は増える。その代わり作り直しが減る'],
  ['判断する', 'ネットワーク構成・権限・費用は人が決める'],
  ['確かめる', 'plan の確認と出来上がりの確認は人。「作るより確かめる方が大変」は Kiro でも同じ'],
];
kHard.forEach(([h, b], i) => {
  const y = 1.7 + i * 0.9;
  txt(s, h, { x: 5.4, y, w: 1.15, h: 0.3, fontSize: 13, bold: true, color: C.background1 });
  txt(s, b, { x: 6.55, y, w: 2.8, h: 0.85, fontSize: 10.5 });
});
txt(s, '速くなるのは「書く・調べる・出す」。決めることと確かめることは人に残る', { x: 0.5, y: 4.7, w: 9, h: 0.35, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('Kiro を使うと、AWS の構築のうち、書く、調べる、出すの 3 つが楽になります。依頼から CDK や CloudFormation、Terraform のコードを作れ、AWS 向けの Powers には手引きと道具がまとめて入っています。AWS の MCP サーバーを使えば、ドキュメントや今のリソースを調べながら作れ、デプロイ手順の SOP を使うと CDK を作って CloudFormation でデプロイするところまで進められます。ただしこれはプレビュー機能です。一方で、Specs を先に作るので最初の工程はむしろ増えます。ネットワーク構成や権限、費用の判断、plan と出来上がりの確認は人に残ります。');

// 11e. 条件と、AWS を変更する 2 つの方法
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'AWS の構築' });
s.addText('条件はシビア? AWS の変更は Kiro からできる?', { placeholder: 'title' });
txt(s, '使い始めるのは難しくない。厳しく考えるべきなのは AWS の権限の渡し方', { x: 0.5, y: 1.0, w: 9, h: 0.35, fontSize: 12, color: C.accent1 });
s.addTable([
  [{ text: '項目', options: KH }, { text: '条件', options: KH }],
  [kn('Kiro へのサインイン'), { text: 'GitHub・Google・AWS Builder ID・IAM Identity Center のどれか。会社で使うなら IAM Identity Center が前提' }],
  [kn('プラン'), { text: '無料枠は月 50 クレジットと少ない。本格的に使うなら有料プラン(会社なら AWS 請求の Enterprise)' }],
  [kn('AWS への変更'), { text: 'その PC に有効な AWS の認証情報と、変更に足る IAM 権限が要る' }],
], { x: 0.5, y: 1.4, w: 9.0, colW: [2.0, 7.0], fontSize: 10.5, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.42, valign: 'middle', objectName: 'kiro cond table' });
txt(s, 'AWS の変更はできる。方法は 2 つ', { x: 0.5, y: 3.25, w: 9, h: 0.35, fontSize: 13, bold: true, color: C.accent5 });
card(s, 0.5, 3.65, 4.35, 1.05, 'kiro way1 card');
card(s, 5.15, 3.65, 4.35, 1.05, 'kiro way2 card');
hex(s, 0.65, 3.8, 0.4, C.accent1, '1', 'kiro way1 hex');
hex(s, 5.3, 3.8, 0.4, C.accent1, '2', 'kiro way2 hex');
txt(s, 'ターミナルの命令で', { x: 1.15, y: 3.75, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: C.background1 });
txt(s, 'aws・cdk deploy・terraform apply などを実行', { x: 1.15, y: 4.08, w: 3.6, h: 0.55, fontSize: 10.5 });
txt(s, 'AWS MCP Server 経由で', { x: 5.8, y: 3.75, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: C.background1 });
txt(s, 'AWS の API を直接呼ぶ。認証は SigV4(MCP Proxy for AWS)か AWS Sign-in の OAuth', { x: 5.8, y: 4.08, w: 3.6, h: 0.55, fontSize: 10.5 });
txt(s, 'どちらも、認証は Kiro ではなくその PC の AWS の設定(~/.aws・環境変数・IAM ロール)を使う', { x: 0.5, y: 4.8, w: 9, h: 0.35, fontSize: 11, italic: true, color: C.accent2 });
s.addNotes('Kiro を使い始める条件は難しくありません。サインインは GitHub、Google、AWS Builder ID、IAM Identity Center のどれかで、会社で使うなら IAM Identity Center が前提です。無料枠は月 50 クレジットと少ないので、本格的に使うなら有料プランになります。厳しく考えるべきなのは AWS の権限の渡し方です。AWS の変更は Kiro からできます。方法は 2 つで、ターミナルで aws や cdk deploy、terraform apply を実行する方法と、AWS MCP Server 経由で AWS の API を直接呼ぶ方法です。どちらの場合も、認証は Kiro 自体ではなく、その PC の AWS の設定を使います。');

// 11f. 必要なものと安全のためのおすすめ
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'AWS の構築' });
s.addText('Kiro で AWS を変更するのに必要なもの', { placeholder: 'title' });
card(s, 0.5, 1.1, 4.35, 3.75, 'kiro need card');
card(s, 5.15, 1.1, 4.35, 3.75, 'kiro safe card');
txt(s, '必要なもの', { x: 0.75, y: 1.25, w: 3.9, h: 0.35, fontSize: 15, bold: true, color: C.accent1 });
const kNeed = [
  ['Kiro', 'エディタか CLI と、サインイン用のアカウント'],
  ['AWS CLI と認証情報', 'SSO(IAM Identity Center)の一時的なものがよい'],
  ['構築の道具', 'CDK 2.x か Terraform。SAM を使うならその CLI'],
  ['MCP の設定', '~/.kiro/settings/mcp.json か Powers で入れる'],
  ['IAM 権限', '作るリソースに必要な分だけ'],
];
kNeed.forEach(([h, b], i) => {
  const y = 1.7 + i * 0.62;
  hex(s, 0.75, y, 0.36, C.accent1, String(i + 1), 'need hex ' + (i + 1));
  txt(s, h, { x: 1.2, y: y - 0.04, w: 3.5, h: 0.28, fontSize: 11.5, bold: true, color: C.background1 });
  txt(s, b, { x: 1.2, y: y + 0.24, w: 3.5, h: 0.3, fontSize: 10 });
});
txt(s, '安全のためのおすすめ', { x: 5.4, y: 1.25, w: 3.9, h: 0.35, fontSize: 15, bold: true, color: C.accent3 });
const kSafe = [
  '最初は検証用の AWS アカウントで試す',
  'Kiro に渡す権限は読み取り用。本番への apply は人が承認してから(または CI から)',
  'AWS Budgets で費用の上限アラートを設定しておく',
  'Kiro のクラウドの隔離環境は既定で外への通信に制限がない。そこに強い鍵を置かない',
];
txt(s, kSafe.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < kSafe.length - 1 } })), { x: 5.4, y: 1.7, w: 3.95, h: 3.0, fontSize: 11.5, paraSpaceAfter: 8 });
s.addNotes('Kiro から AWS を変更するのに必要なものは 5 つです。Kiro 本体とサインイン用のアカウント、AWS CLI とその PC で有効な認証情報、CDK や Terraform などの構築の道具、AWS MCP Server などの設定、そして作るリソースに必要な分だけの IAM 権限です。認証情報は、IAM Identity Center の一時的なものがおすすめです。安全のためには、最初は検証用のアカウントで試すこと、Kiro に渡す権限は読み取り用にして本番への apply は人が承認してから行うこと、AWS Budgets で費用の上限アラートを設定しておくこと、Kiro のクラウドの隔離環境には強い鍵を置かないことの 4 つをおすすめします。');

// 11f2. VPC・Direct Connect・ALB・NLB を Kiro で作るなら
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'AWS の構築' });
s.addText('VPC・DX・ALB・NLB を Kiro で作るなら', { placeholder: 'title' });
const PH = { bold: true, color: C.text1, fill: { color: C.accent2 }, fontSize: 10 };
const pc = (t, color) => ({ text: t, options: color ? { color } : {} });
s.addTable([
  [{ text: '部品', options: PH }, { text: 'Kiro に任せられること', options: PH }, { text: '人がやること・決めること', options: PH }, { text: '特に注意すること', options: PH }],
  [kn('VPC'), pc('CIDR・サブネット(複数 AZ)・ルートテーブル・NAT・VPC エンドポイント・フローログのコード化'), pc('CIDR の設計(オンプレや他 VPC と重ならないか)、AZ の数、NAT の数(費用)'), pc('CIDR・サブネットは後から変えると作り直し。最初の設計が一番大事', THEME.colors.accent2)],
  [kn('Direct Connect'), pc('DX ゲートウェイ、VGW / TGW との関連付け、VIF(専用接続)、ルート伝搬のコード化'), pc('回線の申し込み・LOA・構内の配線・事業者とのやり取り。BGP の ASN・VLAN・認証キー。オンプレ側ルーターの BGP 設定'), pc('物理と契約はコードにできない。経路を間違えると本番通信が止まる', THEME.colors.accent3)],
  [kn('ALB'), pc('リスナー・ルール・ターゲットグループ・ヘルスチェック・SG・WAF の関連付け'), pc('証明書(ACM の DNS 検証)、公開範囲、ルールの優先順位の設計'), pc('DNS 検証は DNS 側の作業が要る。ルールの順番違いで別のサーバーへ', THEME.colors.accent2)],
  [kn('NLB'), pc('リスナー・ターゲットグループ・AZ ごとの固定 IP(EIP)・クロスゾーン・TLS のコード化'), pc('固定 IP の要否、送信元 IP を残すか(ターゲットの種類で変わる)、ヘルスチェックの方式'), pc('サブネットや EIP の変更は作り直しになりやすい。送信元 IP の扱いでサーバー側の SG が変わる', THEME.colors.accent2)],
], { x: 0.4, y: 1.0, w: 9.2, colW: [1.35, 2.75, 2.75, 2.35], fontSize: 8.5, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: [0.32, 0.72, 0.72, 0.72, 0.72], valign: 'middle', objectName: 'aws parts table' });
txt(s, 'Kiro が書くのはコード。物理・契約・設計の判断・本番への反映の承認は人', { x: 0.4, y: 4.88, w: 9.2, h: 0.3, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('VPC、Direct Connect、ALB、NLB の 4 つを部品ごとに整理しました。VPC は CIDR やサブネット、ルートテーブルなどをコードにするところは Kiro に任せられますが、CIDR の設計は人が決めます。後から変えると作り直しになるので、最初の設計が一番大事です。Direct Connect は性質が違い、回線の申し込みや配線、事業者とのやり取り、オンプレ側ルーターの BGP 設定はコードにできません。経路を間違えると本番通信が止まります。ALB は証明書の DNS 検証とルールの順番、NLB は固定 IP と送信元 IP の扱いが注意点です。');

// 11f3. 4 つを進めるときの決まりごと・ラボで先に試せること
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'AWS の構築' });
s.addText('この 4 つを Kiro で進めるときの決まりごと', { placeholder: 'title' });
card(s, 0.5, 1.1, 5.1, 3.85, 'aws rules card');
card(s, 5.8, 1.1, 3.7, 3.85, 'aws lab card');
const awsRules = [
  ['作り直し(replace)が出たら止める', 'plan に forces replacement が出たら人が判断するまで進めない。Steering に書くか Hooks で検出(VPC・サブネット・NLB で起きやすい)'],
  ['Direct Connect の経路は二重に確かめる', '広告する経路・受け取る経路・優先度を design に表で書かせ、オンプレ側の設定と突き合わせる'],
  ['本番への反映は作業時間を決めて CI/CD から', 'VPC のルートや DX の変更は全体に影響する。Kiro から直接 apply しない'],
  ['値は表で管理する', 'CIDR・ASN・VLAN・EIP はパラメータシートを正とし、コードはそこから。反映後は describe で確かめる'],
];
awsRules.forEach(([h, b], i) => {
  const y = 1.22 + i * 0.92;
  hex(s, 0.65, y + 0.02, 0.4, C.accent3, String(i + 1), 'aws rule hex ' + (i + 1));
  txt(s, h, { x: 1.15, y: y - 0.02, w: 4.35, h: 0.3, fontSize: 11.5, bold: true, color: C.background1 });
  txt(s, b, { x: 1.15, y: y + 0.28, w: 4.35, h: 0.6, fontSize: 9.5 });
});
txt(s, 'このラボで先に試せること', { x: 6.0, y: 1.22, w: 3.35, h: 0.32, fontSize: 12.5, bold: true, color: C.accent5 });
const awsLab = [
  ['ALB', '模擬装置で振り分け・ヘルスチェック・設計書の自動作成まで'],
  ['NLB', '専用の模擬は無い。L4 の振り分けは BIG-IP の模擬装置で似た動き'],
  ['DX の BGP', 'Cisco・Catalyst は本物の BGP(TCP 179)。オンプレ側の広告・フィルター・AS パスを事前に'],
  ['VPC', '模擬は無い。CIDR の重なりや経路表のチェックは小さな道具で'],
];
awsLab.forEach(([h, b], i) => {
  const y = 1.62 + i * 0.82;
  txt(s, h, { x: 6.0, y, w: 3.35, h: 0.28, fontSize: 11, bold: true, color: C.background1 });
  txt(s, b, { x: 6.0, y: y + 0.27, w: 3.35, h: 0.52, fontSize: 9.5 });
});
s.addNotes('この 4 つを Kiro で進めるときは、4 つの決まりごとを置きます。plan に作り直しが出たら人が判断するまで止める。Direct Connect の経路は、広告する経路と受け取る経路、優先度を表に書かせ、オンプレ側と突き合わせる。本番への反映は作業時間を決めて CI/CD から行い、Kiro から直接 apply しない。CIDR や ASN、VLAN、EIP などの値はパラメータシートを正として、反映後は describe で確かめる。このラボでは、ALB は模擬装置で設計書の自動作成まで、Direct Connect のオンプレ側の BGP は本物の BGP を話す Cisco や Catalyst で事前に試せます。');

pres.addSection({ title: '要件定義書と設計書' });
// 11f4. 要件定義書も Kiro で作れる?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '要件定義書と設計書' });
s.addText('要件定義書も Kiro で作れる?', { placeholder: 'title' });
txt(s, '下書きなら作れる。Kiro の requirements.md は「機能 1 つ分の要件」。日本の要件定義書はもっと広いので、足りない章を補う', { x: 0.5, y: 0.98, w: 9, h: 0.45, fontSize: 11.5, color: C.accent1 });
s.addTable([
  [{ text: '要件定義書の章', options: KH }, { text: 'Kiro の requirements.md で', options: KH }, { text: '補い方', options: KH }],
  [kn('機能要件'), { text: '得意(ユーザーストーリー + EARS の受け入れ条件)' }, { text: 'そのまま使える。粒度を人が揃える' }],
  [kn('業務要件・背景・範囲'), { text: '依頼に書いた分だけ' }, { text: 'Steering の章立てで項目を立て、人が埋める' }],
  [kn('非機能要件'), { text: '頼まないと薄い' }, { text: 'IPA の非機能要求グレードを Steering に入れ、項目ごとに質問させる' }],
  [kn('移行・運用・制約・前提'), { text: 'ほぼ出ない' }, { text: 'ひな形の章として持たせる' }],
], { x: 0.5, y: 1.48, w: 9.0, colW: [2.3, 3.2, 3.5], fontSize: 10, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.42, valign: 'middle', objectName: 'req table' });
card(s, 0.5, 3.92, 9.0, 0.98, 'req nw card');
txt(s, 'VPC・DX・ALB・NLB の要件で聞き漏らしやすいもの', { x: 0.7, y: 3.98, w: 8.6, h: 0.3, fontSize: 12, bold: true, color: C.accent5 });
txt(s, '接続する拠点と帯域・冗長(DX は 2 回線か、VPN を予備にするか)・止まってよい時間(SLA)・既存の IP 帯との重なり・公開範囲と証明書・ログの保管期間・費用の上限', { x: 0.7, y: 4.28, w: 8.6, h: 0.6, fontSize: 10.5 });
txt(s, 'AI は聞き漏らしを減らす役。決めるのは、業務と予算を知っている人', { x: 0.5, y: 4.95, w: 9, h: 0.28, fontSize: 11.5, italic: true, color: C.accent2 });
s.addNotes('要件定義書も、下書きなら Kiro で作れます。ただし Kiro の requirements.md は、機能 1 つ分のユーザーストーリーと受け入れ条件で、日本の要件定義書よりずっと狭いものです。機能要件は得意ですが、業務要件や背景、非機能要件、移行や運用、制約や前提はほとんど出ません。会社の章立てを Steering に入れ、非機能要件は IPA の非機能要求グレードを項目表として持たせて、項目ごとに質問させると漏れが減ります。今回の VPC、Direct Connect、ALB、NLB では、拠点と帯域、冗長、止まってよい時間、既存の IP 帯との重なり、公開範囲と証明書、ログの保管期間、費用の上限が聞き漏らしやすい項目です。AI は聞き漏らしを減らす役で、決めるのは業務と予算を知っている人です。');

// 11g. 設計書も Kiro で作れる?(Specs と日本の設計書)
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '要件定義書と設計書' });
s.addText('基本設計書・詳細設計書も Kiro で作れる?', { placeholder: 'title' });
txt(s, '作れる。ただし出るのは「開発用の設計メモ」で、日本の SIer の設計書の形そのものではない。下書きを作らせ、形と中身は人が整える', { x: 0.5, y: 0.98, w: 9, h: 0.45, fontSize: 11.5, color: C.accent1 });
const specs = [
  ['requirements.md', 'ユーザーストーリーと受け入れ条件(EARS という決まった書き方)'],
  ['design.md', '構成・部品・データの形・エラー処理・テストの方針'],
  ['tasks.md', '実装の手順を、チェックボックス付きの作業に分けたもの'],
];
txt(s, 'Kiro が標準で作るもの(Specs)', { x: 0.5, y: 1.45, w: 9, h: 0.3, fontSize: 12.5, bold: true, color: C.background1 });
specs.forEach(([h, b], i) => {
  const x = 0.5 + i * 3.05;
  card(s, x, 1.8, 2.9, 0.95, 'spec card ' + (i + 1));
  txt(s, h, { x: x + 0.15, y: 1.86, w: 2.6, h: 0.3, fontSize: 12, bold: true, color: C.accent2 });
  txt(s, b, { x: x + 0.15, y: 2.16, w: 2.6, h: 0.55, fontSize: 9.5 });
});
s.addTable([
  [{ text: '日本の設計書', options: KH }, { text: 'Kiro で近いもの', options: KH }, { text: '足りない部分', options: KH }],
  [kn('要件定義書'), { text: 'requirements.md' }, { text: '非機能要件(性能・可用性・運用)は頼まないと薄くなる' }],
  [kn('基本設計書'), { text: 'design.md の構成・方針' }, { text: '表紙・改訂履歴・会社の章立て' }],
  [kn('詳細設計書・パラメータシート'), { text: 'design.md の一部' }, { text: '1 項目ずつの値の表(サブネット・SG のルール・ALB の設定値など)' }],
], { x: 0.5, y: 2.9, w: 9.0, colW: [2.4, 2.4, 4.2], fontSize: 10.5, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.42, valign: 'middle', objectName: 'kiro doc table' });
s.addNotes('基本設計書や詳細設計書も Kiro で作れます。ただし Kiro が出すのは開発用の設計メモで、日本の SIer でよく使う設計書の形そのものではありません。Kiro が標準で作るのは 3 つの Markdown です。requirements.md はユーザーストーリーと受け入れ条件を EARS という決まった書き方で書いたもの、design.md は構成や部品、データの形、エラー処理、テストの方針、tasks.md は実装の手順をチェックボックス付きの作業に分けたものです。日本の設計書と比べると、requirements.md は要件定義書、design.md の構成と方針は基本設計書に近く、詳細設計書やパラメータシートは design.md の一部に当たります。足りないのは、非機能要件、表紙や改訂履歴や会社の章立て、そして 1 項目ずつの値の表です。');

// 11h. 設計書を会社の形に寄せる
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '要件定義書と設計書' });
s.addText('設計書を会社の形に寄せるには', { placeholder: 'title' });
const docHow = [
  ['Steering にひな形を入れる', '会社の設計書の章立てと書き方を Steering(Markdown)に書いておくと、毎回その形で下書きを作れる'],
  ['値は「現物」から起こす', '値は AI に考えさせず、IaC のコードと describe 系の結果(aws elbv2 describe-load-balancers など)から機械的に作る。設計書と実物の食い違いを防ぐ'],
  ['Excel・Word で納める', 'Kiro が書くのは Markdown。pandoc などで Word に、Python などの小さな変換スクリプトで Excel のパラメータシートにする'],
];
docHow.forEach(([h, b], i) => {
  const y = 1.1 + i * 1.02;
  hex(s, 0.55, y + 0.05, 0.5, C.accent5, String(i + 1), 'dochow hex ' + (i + 1));
  txt(s, h, { x: 1.2, y, w: 4.6, h: 0.32, fontSize: 13, bold: true, color: C.background1 });
  txt(s, b, { x: 1.2, y: y + 0.33, w: 4.7, h: 0.66, fontSize: 10 });
});
card(s, 6.05, 1.1, 3.45, 2.9, 'doc warn card');
txt(s, '気をつける点', { x: 6.25, y: 1.22, w: 3.1, h: 0.32, fontSize: 13, bold: true, color: C.accent3 });
const docWarn = [
  { h: '人の確認が要る', b: '設計書は合意と承認のための書類。AI の下書きには、存在しない設定項目や古い仕様など、もっともらしい間違いが混ざる。レビューは省けない' },
  { h: '秘密は書かせない', b: 'アカウント ID・IP 設計・鍵などの機密を、そのまま外部の AI に渡してよいかは会社のルールを確認' },
];
docWarn.forEach((w, i) => {
  const y = 1.62 + i * 1.18;
  txt(s, w.h, { x: 6.25, y, w: 3.1, h: 0.3, fontSize: 11.5, bold: true, color: C.background1 });
  txt(s, w.b, { x: 6.25, y: y + 0.3, w: 3.1, h: 0.85, fontSize: 9.5 });
});
txt(s, 'このラボでも実際に試した(次のスライド): ALB の模擬装置の describe の出力から、基本設計書とパラメータシートを起こす', { x: 0.5, y: 4.2, w: 9, h: 0.4, fontSize: 11 });
txt(s, 'AI は下書きと転記を速くする。中身の正しさを決めるのは人と「現物」', { x: 0.5, y: 4.7, w: 9, h: 0.35, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('Kiro の設計メモを会社の設計書の形に寄せる方法は 3 つです。まず、会社の設計書の章立てと書き方を Steering に書いておくと、毎回その形で下書きを作れます。次に、パラメータシートの値は AI に考えさせず、IaC のコードや aws elbv2 describe-load-balancers のような describe 系の命令の結果から機械的に起こします。これで設計書と実物の食い違いを防げます。最後に、Kiro が書くのは Markdown なので、Word は pandoc などで、Excel のパラメータシートは小さな変換スクリプトで作ります。気をつける点は 2 つです。設計書は合意と承認のための書類なので、AI の下書きに混ざるもっともらしい間違いを人がレビューする必要があります。また、アカウント ID や IP 設計、鍵などの機密を外部の AI に渡してよいかは、会社のルールで確かめてください。');

// 11i. このラボで試した: 現物から設計書を起こす
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '要件定義書と設計書' });
s.addText('ラボで試した: 現物から設計書を起こす', { placeholder: 'title' });
s.addImage({ path: 'docs/images/design-docs-parameter-sheet.png', x: 0.5, y: 1.05, w: 5.6, h: 2.45, altText: 'describe の出力から自動で作ったパラメータシート(Excel)。ターゲットグループ・ターゲット・ルールの表', objectName: 'param sheet image' });
txt(s, 'できたパラメータシート(Excel)。値はすべて describe の出力から', { x: 0.5, y: 3.55, w: 5.6, h: 0.3, fontSize: 9.5, color: C.accent6 });
const tried = [
  ['組む', 'aws-cli の構文で ALB を作る(web-tg・api-tg、/api/* のルール)'],
  ['確かめる', '本物の HTTP で /index.html は web1・web2 に交互、/api/* は api1'],
  ['起こす', 'describe を読み、基本設計書(Markdown)とパラメータシート(Excel)を自動で作る'],
];
tried.forEach(([h, b], i) => {
  const y = 1.1 + i * 0.85;
  hex(s, 6.35, y, 0.45, C.accent1, String(i + 1), 'tried hex ' + (i + 1));
  txt(s, h, { x: 6.9, y: y - 0.03, w: 2.6, h: 0.3, fontSize: 12.5, bold: true, color: C.background1 });
  txt(s, b, { x: 6.9, y: y + 0.27, w: 2.6, h: 0.55, fontSize: 9.5 });
});
card(s, 0.5, 3.95, 9.0, 0.95, 'tried note card');
txt(s, [
  { text: '基本設計書: ', options: { bold: true, color: C.accent5 } },
  { text: '構成図・負荷分散・ルール・ヘルスチェックの方針は値から組み立て、目的と範囲・非機能要件・確認事項は「人が書く」欄に。', options: { breakLine: true } },
  { text: '道具: ', options: { bold: true, color: C.accent5 } },
  { text: 'tools/design_docs/alb_design_docs.py。呼ぶのは describe だけ(読み取り)。--lab はラボ、--aws は本物の AWS(こちらは未確認)' },
], { x: 0.7, y: 4.03, w: 8.6, h: 0.82, fontSize: 10.5 });
s.addNotes('前のスライドの「値は現物から起こす」を、このラボで実際にやりました。aws-cli の構文で ALB を組み、Web 用と API 用の 2 つのターゲットグループと、/api/ を API 側へ送るルールを作りました。本物の HTTP で、/index.html は web1 と web2 に交互に、/api/ は api1 に振り分けられることを確かめてから、describe の出力を読んで基本設計書とパラメータシートを自動で作りました。値はすべて describe から転記するので、設計書と実物が食い違いません。基本設計書のうち、構成図や方針は値から組み立て、目的や非機能要件は人が書く欄として残しています。同じ道具は本物の AWS にも向けられるように作りましたが、そちらはまだ試していません。');

// まとめ
pres.addSection({ title: 'まとめ' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('まとめ', { placeholder: 'title' });
const sumItems = [
  ['Kiro は AWS 向けの道具がそろった AI 開発ツール', 'Specs・Steering・Hooks・MCP・Powers。仕様から入るので文書が残る'],
  ['速くなるのは書く・調べる・出す', '決めること(CIDR・経路・権限・費用)と確かめることは人に残る'],
  ['権限の渡し方がいちばん大事', '読み取り用だけ渡し、本番は人の承認のあと CI/CD から反映'],
  ['Direct Connect は物理と契約が絡む', 'コードにできるのは AWS 側の一部。経路は二重に確かめる'],
  ['要件定義書・設計書は下書きまで', '値は現物(IaC・describe)から起こし、レビューと承認は人'],
];
sumItems.forEach(([h, b], i) => {
  const y = 1.1 + i * 0.78;
  hex(s, 0.55, y, 0.45, C.accent1, String(i + 1), 'sum hex ' + (i + 1));
  txt(s, h, { x: 1.15, y: y - 0.03, w: 8.3, h: 0.32, fontSize: 13.5, bold: true, color: C.background1 });
  txt(s, b, { x: 1.15, y: y + 0.29, w: 8.3, h: 0.35, fontSize: 11 });
});
s.addNotes('まとめです。Kiro は AWS 向けの道具がそろった AI 開発ツールで、仕様から入るので文書が残ります。速くなるのは書く、調べる、出すの部分で、決めることと確かめることは人に残ります。いちばん大事なのは権限の渡し方で、Kiro には読み取り用だけを渡し、本番への反映は人が承認したあと CI/CD から行います。Direct Connect は物理と契約が絡むので、コードにできるのは AWS 側の一部です。要件定義書や設計書は下書きまでで、値は現物から起こし、レビューと承認は人が行います。');

// 出典
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('出典と、確かめていないこと', { placeholder: 'title' });
const srcs = [
  'Kiro Docs(CLI・Cloud sessions・Autonomous agent の sandbox・Authentication)、Kiro FAQ・Pricing — kiro.dev',
  'AWS MCP Server(Deployment SOPs・Getting started) — docs.aws.amazon.com',
  'AWS IaC MCP Server の紹介 — aws.amazon.com/blogs/devops',
  'HashiCorp の Terraform power — hashicorp.com/blog',
  'AWS Builder Center・SD Times の Kiro の記事',
];
txt(s, srcs.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < srcs.length - 1 } })), { x: 0.5, y: 1.1, w: 9, h: 2.3, fontSize: 11.5, paraSpaceAfter: 6 });
card(s, 0.5, 3.55, 9.0, 1.35, 'src note card');
txt(s, '確かめていないこと', { x: 0.7, y: 3.65, w: 8.6, h: 0.3, fontSize: 12.5, bold: true, color: C.accent3 });
txt(s, 'Kiro 自体は動かしていない(内容は 2026-11-22 時点の公式情報)。設計書を作る道具の --aws(本物の AWS)は未確認。版の番号・プラン・プレビュー機能の範囲はよく変わるので、使う前に最新の Docs で確かめる。リンクの一覧は docs/ai-driven-aws.md', { x: 0.7, y: 3.98, w: 8.6, h: 0.85, fontSize: 10.5 });
s.addNotes('出典は、Kiro の公式ドキュメント、AWS MCP Server のドキュメント、AWS と HashiCorp のブログなどです。Kiro 自体は実際には動かしていません。設計書を作る道具の本物の AWS 向けの使い方も、まだ試していません。版やプラン、プレビュー機能の範囲はよく変わるので、使う前に最新のドキュメントで確かめてください。');

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
