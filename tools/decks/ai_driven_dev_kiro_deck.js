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
s.addText('VPC・Direct Connect・ALB・NLB の構築、要件定義書・設計書・手順書、操作手順と変更の進め方(2026-11-22 時点)', { placeholder: 'body' });
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

// 操作手順
pres.addSection({ title: '使い方と運用' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('操作手順: Kiro で AWS を作るまで', { placeholder: 'title' });
const steps = [
  ['人', '準備', 'Kiro を入れてサインイン。Git のリポジトリを開く'],
  ['人', 'Steering', 'product.md・tech.md・structure.md を作らせ、会社の決まり・作り直しで止めるルールを足す'],
  ['人', 'AWS の設定', 'MCP・Powers を入れ、読み取り用の AWS プロファイル(SSO)を用意'],
  ['Kiro', 'Spec を作る', '依頼から requirements → design → tasks。各段階を人が読んで承認'],
  ['Kiro', 'タスクを実行', 'Supervised モードで。ファイルを変えるたびに人が確認'],
  ['Kiro', 'plan まで', 'fmt・validate・plan。作り直し(replace)が出たら止める'],
  ['人', '反映', 'PR → CI の検査 → 人の承認 → CI/CD から apply'],
  ['Kiro', '確かめる', 'describe で確認し、設計書・パラメータシートを作り直す'],
];
steps.forEach(([who, h, b], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.5 + col * 4.6, y = 1.05 + row * 0.98;
  const c = who === '人' ? C.accent2 : C.accent1;
  hex(s, x, y + 0.02, 0.45, c, String(i + 1), 'step hex ' + (i + 1));
  txt(s, `${h}(${who})`, { x: x + 0.55, y: y - 0.02, w: 3.85, h: 0.3, fontSize: 12, bold: true, color: C.background1 });
  txt(s, b, { x: x + 0.55, y: y + 0.28, w: 3.85, h: 0.62, fontSize: 9.5 });
});
txt(s, 'Kiro が既定で使うのは Autopilot(任せる)。重要なコードや慣れないうちは Supervised(確認しながら)', { x: 0.5, y: 5.0, w: 9, h: 0.25, fontSize: 9.5, color: C.accent6 });
s.addNotes('Kiro で AWS を作るまでの操作手順です。まず Kiro を入れてサインインし、Git のリポジトリを開きます。次に Steering として product.md、tech.md、structure.md を作らせ、会社の決まりや、作り直しが出たら止めるルールを書き足します。MCP や Powers を入れ、AWS は読み取り用のプロファイルを用意します。ここから Kiro に依頼して Spec を作らせ、要件、設計、タスクの各段階を人が読んで承認します。タスクの実行は Supervised モードにして、ファイルを変えるたびに確認します。Kiro にやらせるのは plan までで、作り直しが出たら止めます。反映は PR と CI を通し、人が承認したあと CI/CD から行います。最後に describe で確かめ、設計書とパラメータシートを作り直します。Kiro の既定は Autopilot なので、慣れないうちは Supervised に切り替えるのがおすすめです。');

// Kiro で作ったら変更も Kiro?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('Kiro で作ったら、変更も Kiro でないとだめ?', { placeholder: 'title' });
txt(s, 'だめではない。Kiro が作るのは普通の IaC コードと Markdown で、Git に入る。人の手でも他の道具でも変えられる。Kiro をやめてもインフラは動き続ける', { x: 0.5, y: 0.98, w: 9, h: 0.5, fontSize: 11.5, color: C.accent1 });
card(s, 0.5, 1.6, 4.35, 3.3, 'change must card');
card(s, 5.15, 1.6, 4.35, 3.3, 'change kiro card');
txt(s, 'どの道具で変えても守ること', { x: 0.75, y: 1.72, w: 3.9, h: 0.32, fontSize: 13, bold: true, color: C.accent3 });
const chMust = [
  '変更は必ず IaC から。コンソールで直接変えない(コードと実物がずれる)',
  'ずれは定期的に見つける: terraform plan / CloudFormation のドリフト検出',
  'Kiro 以外で変えたら、Spec と設計書も直す',
  '本番への反映は、いつでも PR → CI → 人の承認 → CI/CD',
];
txt(s, chMust.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < chMust.length - 1 } })), { x: 0.75, y: 2.1, w: 3.95, h: 2.7, fontSize: 10.5, paraSpaceAfter: 6 });
txt(s, 'Kiro で変えると楽なこと', { x: 5.4, y: 1.72, w: 3.9, h: 0.32, fontSize: 13, bold: true, color: C.accent5 });
const chKiro = [
  '変更も Spec から: requirements と design を直してから tasks を作らせると、仕様と実物が揃ったまま残る',
  'Steering と Hooks の決まり(作り直しで止める など)が、毎回自動で効く',
  '前回の Spec が残っているので、なぜその構成にしたかを追える',
];
txt(s, chKiro.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < chKiro.length - 1 } })), { x: 5.4, y: 2.1, w: 3.95, h: 2.7, fontSize: 10.5, paraSpaceAfter: 6 });
txt(s, '大事なのは道具をそろえることより、「変更は IaC から・仕様と実物を揃える」を守ること', { x: 0.5, y: 4.98, w: 9, h: 0.28, fontSize: 11.5, italic: true, color: C.accent2 });
s.addNotes('Kiro で作ったら変更も Kiro でないといけない、ということはありません。Kiro が作るのは普通の IaC のコードと Markdown で、Git に入ります。人の手でも、ほかの道具でも変えられますし、Kiro をやめてもインフラは動き続けます。どの道具で変えるにしても守ることは、変更は必ず IaC から行いコンソールで直接変えないこと、ずれを定期的に見つけること、Kiro 以外で変えたら Spec と設計書も直すこと、本番への反映はいつでも PR と CI と人の承認を通すことです。Kiro で変えると、Spec を直してからタスクを作るので仕様と実物が揃ったまま残り、Steering や Hooks の決まりも毎回効くので楽になります。');

// 操作手順書も作れる?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('作業手順書・運用手順書も Kiro で作れる?', { placeholder: 'title' });
txt(s, '下書きなら作れる。IaC のコードと tasks.md・describe の結果から、コマンドと確認方法の入った手順書を起こせる', { x: 0.5, y: 0.98, w: 9, h: 0.42, fontSize: 11.5, color: C.accent1 });
s.addTable([
  [{ text: '手順書の章', options: KH }, { text: 'Kiro に書かせる中身', options: KH }, { text: '人が確かめること', options: KH }],
  [kn('事前確認'), { text: '今の状態を見る describe・plan のコマンドと、期待する結果' }, { text: '作業してよい状態か(連絡・作業時間)' }],
  [kn('作業手順'), { text: '順番どおりのコマンド(CI/CD の実行手順を含む)' }, { text: '順番・待ち時間・止める条件' }],
  [kn('確認方法'), { text: '1 手順ごとの確認コマンドと、正しいときの出力' }, { text: '期待値が実物と合っているか' }],
  [kn('切り戻し'), { text: '前の版に戻す手順(前のコミットで apply など)' }, { text: '本当に戻せるか(作り直しは戻せないことがある)' }],
  [kn('運用(日々の手順)'), { text: '監視・アラート時の確認・証明書の更新などの手順' }, { text: '担当と連絡先、判断の基準' }],
], { x: 0.5, y: 1.45, w: 9.0, colW: [1.9, 3.85, 3.25], fontSize: 10, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.42, valign: 'middle', objectName: 'runbook table' });
card(s, 0.5, 4.1, 9.0, 0.8, 'runbook note card');
txt(s, [
  { text: 'こつ: ', options: { bold: true, color: C.accent5 } },
  { text: '会社の手順書のひな形を Steering に入れる / 値は現物から / 検証環境で手順書どおりに一度通してから本番へ / Direct Connect の物理作業は事業者の手順と合わせる' },
], { x: 0.7, y: 4.18, w: 8.6, h: 0.65, fontSize: 10.5 });
txt(s, '手順書の正しさは、検証環境で実際に通して初めてわかる', { x: 0.5, y: 4.98, w: 9, h: 0.28, fontSize: 11.5, italic: true, color: C.accent2 });
s.addNotes('作業手順書や運用手順書も、下書きなら Kiro で作れます。IaC のコードと tasks.md、describe の結果から、コマンドと確認方法の入った手順書を起こせます。事前確認、作業手順、確認方法、切り戻し、日々の運用の章ごとに、Kiro に書かせる中身と、人が確かめることを分けました。特に切り戻しは、作り直しが起きた変更だと戻せないことがあるので、人が確かめます。会社の手順書のひな形を Steering に入れ、値は現物から起こし、検証環境で手順書どおりに一度通してから本番に使ってください。Direct Connect の物理作業は、事業者の手順と合わせる必要があります。');

// チャットで firewall を変えられる?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('Claude のようにチャットで firewall も変えられる?', { placeholder: 'title' });
txt(s, 'できる。ただし「装置にログインする」のではなく、手元の AWS の権限で API を呼ぶ形。本番は直接変えず、チャット → IaC の差分 → 承認 → CI/CD が正しい', { x: 0.5, y: 0.98, w: 9, h: 0.5, fontSize: 11.5, color: C.accent1 });
card(s, 0.5, 1.6, 4.35, 3.3, 'fw direct card');
card(s, 5.15, 1.6, 4.35, 3.3, 'fw iac card');
txt(s, 'A. チャットから直接変える', { x: 0.75, y: 1.72, w: 3.9, h: 0.32, fontSize: 13, bold: true, color: C.accent3 });
const fwDirect = [
  'Kiro が aws-cli か AWS の MCP サーバーで API を呼ぶ(セキュリティグループ・NACL・Network Firewall・WAF)',
  '効くのは Kiro に渡した権限の範囲だけ。動くのは手元の PC の資格情報',
  'セキュリティグループの変更はすぐ効く。間違えると自分の接続も切れる',
  'コードと実物がずれ、レビューも残らない → 検証環境・調査まで',
];
txt(s, fwDirect.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < fwDirect.length - 1 } })), { x: 0.75, y: 2.1, w: 3.95, h: 2.7, fontSize: 10.5, paraSpaceAfter: 6 });
txt(s, 'B. チャットで IaC を直させる(本番)', { x: 5.4, y: 1.72, w: 3.95, h: 0.32, fontSize: 13, bold: true, color: C.accent5 });
const fwIac = [
  '「443 を社内だけに」と頼むと、Kiro が IaC のルールを書き換えて plan まで出す',
  '人が差分を読む(削除・0.0.0.0/0・作り直しが無いか)',
  'PR → CI → 人の承認 → CI/CD が反映。Kiro に本番の書き込み権限は渡さない',
  'オンプレの FortiGate・Palo Alto も、Terraform のプロバイダがあれば同じ流れ',
];
txt(s, fwIac.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < fwIac.length - 1 } })), { x: 5.4, y: 2.1, w: 3.95, h: 2.7, fontSize: 10.5, paraSpaceAfter: 6 });
txt(s, 'このラボの Claude も同じ: 模擬装置はチャットから直接変えたが、自宅の実機(WS-C3650)はユーザーが手で入れた', { x: 0.5, y: 4.98, w: 9, h: 0.28, fontSize: 10.5, italic: true, color: C.accent2 });
s.addNotes('Claude とのチャットのように、Kiro からも firewall などを変えられるか、という質問への答えは「できる」です。ただし装置にログインして設定するのではなく、手元の PC にある AWS の資格情報で、aws-cli や AWS の MCP サーバーを通して API を呼ぶ形になります。セキュリティグループ、ネットワーク ACL、Network Firewall、WAF などが対象で、効くのは Kiro に渡した権限の範囲だけです。チャットから直接変えるやり方は、セキュリティグループならすぐ効くので速い反面、間違えると自分の接続まで切れますし、コードと実物がずれ、レビューも残りません。検証環境や調査までにとどめます。本番では、チャットで IaC のルールを書き換えさせて plan まで出させ、人が差分を読み、PR、CI、人の承認を経て CI/CD から反映します。Kiro には本番の書き込み権限を渡しません。オンプレの FortiGate や Palo Alto も、Terraform のプロバイダがあれば同じ流れにできます。このラボの Claude も同じで、模擬装置はチャットから直接変えましたが、自宅の実機はユーザーが手で設定しました。');

// 人が介在する手順書は IaC の前と後?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('人が入る手順は、IaC の作業の前と後?', { placeholder: 'title' });
txt(s, 'ほぼ合っている。ただし「途中」もある: 差分を読んで承認するところは、IaC の真ん中に人が入る。もう一つ、IaC の外の作業も人の手順', { x: 0.5, y: 0.98, w: 9, h: 0.5, fontSize: 11.5, color: C.accent1 });
const phase3 = [
  ['作業前', C.accent2, ['変更の申請と承認・作業時間・関係者への連絡', '今のルールを記録(describe・書き出し)', '切り戻す条件を決める(何が起きたら戻すか)']],
  ['途中(承認)', C.accent3, ['plan・変更セットの差分を読む(削除・0.0.0.0/0・作り直し)', 'PR とデプロイの承認', '反映そのものは CI/CD。人も Kiro も手で apply しない']],
  ['作業後', C.accent5, ['通すべき通信が通る・止めるべき通信が止まる', 'ログで確かめる(VPC フローログ・Firewall のログ)', '監視・ずれの確認、完了の連絡。だめなら切り戻し']],
];
phase3.forEach(([h, col, items], i) => {
  const x = 0.5 + i * 3.05;
  card(s, x, 1.6, 2.9, 2.75, 'phase3 card ' + (i + 1));
  hex(s, x + 0.15, 1.72, 0.42, col, String(i + 1), 'phase3 hex ' + (i + 1));
  txt(s, h, { x: x + 0.68, y: 1.75, w: 2.1, h: 0.35, fontSize: 13, bold: true, color: col, valign: 'middle' });
  txt(s, items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })), { x: x + 0.15, y: 2.25, w: 2.65, h: 2.05, fontSize: 10, paraSpaceAfter: 5 });
});
card(s, 0.5, 4.45, 9.0, 0.5, 'outside iac card');
txt(s, [
  { text: 'IaC の外: ', options: { bold: true, color: C.accent4 } },
  { text: '相手側の firewall・DX の事業者・他チームの設定、利用者での確認も、人の作業として書く' },
], { x: 0.7, y: 4.52, w: 8.6, h: 0.4, fontSize: 10.5, valign: 'middle' });
txt(s, 'Kiro が書くのは手順書の下書きと確認のコマンド。決めて・承認して・確かめるのが人', { x: 0.5, y: 5.0, w: 9, h: 0.25, fontSize: 10, italic: true, color: C.accent2 });
s.addNotes('人が入る手順書は、IaC の作業の前と後か、という質問です。ほぼ合っていますが、もう一か所あります。IaC の途中、plan や変更セットの差分を読んで承認するところです。作業前は、変更の申請と承認、作業時間と関係者への連絡、今のルールの記録、切り戻す条件の決定です。途中は、差分の中に削除や 0.0.0.0/0 の許可、作り直しが無いかを読み、PR とデプロイを承認します。反映そのものは CI/CD が行い、人も Kiro も手で apply しません。作業後は、通すべき通信が通り、止めるべき通信が止まることを確かめ、VPC フローログや Firewall のログでも確認し、監視とずれの確認、完了の連絡をします。だめなら切り戻します。さらに、相手側の firewall や Direct Connect の事業者、他チームの設定、実際の利用者での確認のように IaC の外にある作業も、人の作業として手順書に書きます。');

// Kiro への依頼のしかた
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('設定を反映するとき、Kiro にどう頼む?', { placeholder: 'title' });
txt(s, '「反映して」とは頼まない。頼むのは「IaC を直して plan まで、PR にして」まで。反映は CI/CD', { x: 0.5, y: 0.98, w: 9, h: 0.3, fontSize: 11.5, color: C.accent1 });
card(s, 0.5, 1.38, 3.0, 3.55, 'steering card');
txt(s, '0. 先に決まりを書く', { x: 0.65, y: 1.46, w: 2.75, h: 0.3, fontSize: 12, bold: true, color: C.accent4 });
txt(s, '.kiro/steering/aws-change.md(一度だけ)', { x: 0.65, y: 1.76, w: 2.75, h: 0.25, fontSize: 9, color: C.accent6 });
const steerRules = [
  'apply と aws の書き込み系コマンドは実行しない',
  '変えるのは terraform/ の下だけ',
  'plan に削除・作り直し・0.0.0.0/0 があれば止めて報告',
  'PR 本文に plan の要約・影響範囲・切り戻し・確認コマンド',
];
txt(s, steerRules.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < steerRules.length - 1 } })), { x: 0.65, y: 2.08, w: 2.75, h: 2.3, fontSize: 9.5, paraSpaceAfter: 5 });
txt(s, 'これで毎回の依頼が短くなる', { x: 0.65, y: 4.5, w: 2.75, h: 0.3, fontSize: 9.5, italic: true, color: C.accent5 });
const asks = [
  ['Spec を作らせる', '本番の ALB 用 SG で、443 の受け付けを 0.0.0.0/0 から社内の 203.0.113.0/24 だけに絞りたい。対象は terraform/prod/network/sg_alb.tf。Spec を作って', '要件・設計・作業項目を 1 段ずつ人が承認'],
  ['plan まで', 'タスクを実行して。fmt・validate・plan まで。apply はしないで。削除・作り直し・0.0.0.0/0 があれば先に教えて', '人が plan の差分を読む(途中の承認)'],
  ['PR にさせる', 'feature/sg-alb-restrict でコミットして PR を作って。本文に plan の要約・影響範囲・切り戻し・確認コマンドを', 'CI → 人の承認 → CI/CD が反映'],
  ['反映後に確かめる', '反映が終わった。describe-security-groups で 443 のルールを確認して表で。パラメータシートも更新して', '期待どおりかを人が見る'],
];
asks.forEach(([h, q, who], i) => {
  const y = 1.38 + i * 0.9;
  hex(s, 3.7, y + 0.05, 0.4, C.accent1, String(i + 1), 'ask hex ' + (i + 1));
  txt(s, h, { x: 4.2, y: y, w: 1.9, h: 0.28, fontSize: 11.5, bold: true, color: C.background1 });
  txt(s, '→ ' + who, { x: 6.1, y: y + 0.02, w: 3.4, h: 0.26, fontSize: 9, color: C.accent2 });
  txt(s, '「' + q + '」', { x: 4.2, y: y + 0.3, w: 5.3, h: 0.55, fontSize: 9.5, color: C.background2 });
});
txt(s, 'こつ: 環境・ファイル・やりたいことを具体的に / やってほしくないことを書く / 確かめ方も頼む。「本番の SG 直しておいて」は NG', { x: 0.5, y: 5.0, w: 9, h: 0.25, fontSize: 9.5, color: C.accent6 });
s.addNotes('Kiro で設定を反映するときの頼み方です。ポイントは「反映して」とは頼まないことです。頼むのは、IaC を直して plan まで出し、PR にするところまでで、本番への反映は CI/CD が行います。まず一度だけ、Steering に決まりを書いておきます。apply や AWS の書き込み系のコマンドは実行しない、変えるのは terraform の下だけ、plan に削除や作り直し、0.0.0.0/0 の許可があれば止めて報告する、PR の本文には plan の要約と影響範囲、切り戻しと確認のコマンドを書く、といった内容です。これで毎回の依頼が短くなります。依頼は 4 回に分けます。1 回目は、環境とファイルとやりたいことを書いて Spec を作らせ、要件、設計、作業項目を 1 段ずつ承認します。2 回目は plan まで実行させ、人が差分を読みます。3 回目は PR を作らせ、CI と人の承認を経て CI/CD が反映します。4 回目は反映後に describe で確かめさせ、パラメータシートも更新させます。「本番の SG 直しておいて」のようなあいまいな頼み方は、権限があれば Kiro が API で直接変えてしまうおそれがあるので避けます。1 行の小さな変更なら、Spec を作らずチャットで頼んでも十分です。');

// 設定を入れるのは誰?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('Kiro が IaC を作り、人が aws-cli で入れる?', { placeholder: 'title' });
txt(s, '少し違う。IaC なら設定を入れるのは IaC の道具(terraform apply・変更セット・cdk deploy)。aws-cli は作業前後の確認(describe)に使う', { x: 0.5, y: 0.98, w: 9, h: 0.5, fontSize: 11.5, color: C.accent1 });
s.addTable([
  [{ text: 'やり方', options: KH }, { text: '設定を入れるもの', options: KH }, { text: '人の役割', options: KH }, { text: '気をつけること', options: KH }],
  [kn('IaC + CI/CD(おすすめ)'), { text: 'パイプラインが terraform apply など' }, { text: '差分を読んで承認' }, { text: '承認した差分だけが入る。記録が Git に残る' }],
  [kn('IaC + 手で入れる'), { text: '人が terraform apply tfplan など' }, { text: '承認したうえで自分で入れる' }, { text: 'plan -out で保存した差分をそのまま入れる。CloudFormation は変更セットを確かめて実行' }],
  [kn('手順書(IaC なし)'), { text: '人が aws-cli を貼り付け' }, { text: '手順書を確認して入れる' }, { text: 'コードが無いので実物とそろわない。切り戻しは別に書く。記録は CloudTrail だけ' }],
], { x: 0.5, y: 1.6, w: 9.0, colW: [2.1, 2.2, 1.9, 2.8], fontSize: 10, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.62, valign: 'middle', objectName: 'apply who table' });
card(s, 0.5, 4.2, 9.0, 0.7, 'apply who note card');
txt(s, [
  { text: 'CI/CD が無いとき: ', options: { bold: true, color: C.accent5 } },
  { text: 'terraform plan -out=tfplan → 人が差分を読む → terraform apply tfplan。Kiro に頼めば手順書(3 つ目)も書けるが、それは IaC ではない' },
], { x: 0.7, y: 4.27, w: 8.6, h: 0.58, fontSize: 10.5, valign: 'middle' });
txt(s, 'どのやり方でも、aws-cli は「確かめる」ために使うのが基本', { x: 0.5, y: 4.98, w: 9, h: 0.28, fontSize: 11.5, italic: true, color: C.accent2 });
s.addNotes('Kiro が IaC を作り、人が aws-cli で設定を入れる、という理解は少し違います。IaC にした場合、設定を入れるのは IaC の道具です。Terraform なら terraform apply、CloudFormation なら変更セットの実行、CDK なら cdk deploy で、本番ではこれを CI/CD が流します。aws-cli は、作業前と作業後に describe などで確かめるために使います。CI/CD が無い会社では人が手で入れますが、その場合も打つのは aws-cli ではなく、terraform plan -out で保存した差分を terraform apply tfplan でそのまま入れる形です。Kiro に aws-cli の手順書を書かせて人が貼り付けるやり方もできますが、それは IaC ではなく昔ながらの手順書の作業で、コードが無いので実物とそろわず、切り戻しも別に書く必要があり、記録は CloudTrail だけになります。');

// 設定の正しさは別の AI に確かめさせる?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('設定の正しさは、別の AI に確かめさせればよい?', { placeholder: 'title' });
txt(s, '良い方法。ただし人の承認の代わりではなく、確認を一段増やすもの。機械の検査・別の AI・人・実際の通信を重ねる', { x: 0.5, y: 0.98, w: 9, h: 0.3, fontSize: 11.5, color: C.accent1 });
const layers = [
  ['機械的な検査', 'terraform validate・tflint・checkov・cfn-lint・cfn-guard', '必ず守る規則(22 番を 0.0.0.0/0 に開けない など)。何度やっても同じ結果', C.accent4],
  ['別の AI', '要件定義書と plan の差分を突き合わせる', '要件とのずれ・書き間違い・影響範囲の見落とし', C.accent1],
  ['人', '差分を読んで承認', '社内の事情に合っているか。責任は人が持つ', C.accent2],
  ['実際の通信', 'VPC Reachability Analyzer・Network Access Analyzer・実際の接続', '本当に通るか、本当に止まるか', C.accent5],
];
layers.forEach(([h, how, what, col], i) => {
  const y = 1.4 + i * 0.6;
  hex(s, 0.5, y, 0.44, col, String(i + 1), 'layer hex ' + (i + 1));
  txt(s, h, { x: 1.05, y: y + 0.02, w: 1.5, h: 0.36, fontSize: 12, bold: true, color: col, valign: 'middle' });
  txt(s, how, { x: 2.55, y: y - 0.02, w: 3.3, h: 0.48, fontSize: 9.5, color: C.background1, valign: 'middle' });
  txt(s, what, { x: 5.95, y: y - 0.02, w: 3.55, h: 0.48, fontSize: 9.5, valign: 'middle' });
});
card(s, 0.5, 3.85, 4.4, 1.08, 'ai ask card');
txt(s, '別の AI への頼み方', { x: 0.65, y: 3.92, w: 4.1, h: 0.28, fontSize: 11, bold: true, color: C.accent1 });
txt(s, '×「これで大丈夫?」\n○「この要件とこの plan の差分を比べて、合わない点を全部挙げて」', { x: 0.65, y: 4.22, w: 4.1, h: 0.66, fontSize: 9.5 });
card(s, 5.1, 3.85, 4.4, 1.08, 'ai limit card');
txt(s, 'AI だけでは足りない', { x: 5.25, y: 3.92, w: 4.1, h: 0.28, fontSize: 11, bold: true, color: C.accent3 });
txt(s, '社内の事情(どの IP が本社か)は知らない / 間違っていても「問題なし」と答える / 書いた設定が正しくても、通るかは別', { x: 5.25, y: 4.22, w: 4.1, h: 0.66, fontSize: 9.5 });
txt(s, 'このラボでも、コードを読むだけでは見つからず、動かして初めて見つかったバグが多かった', { x: 0.5, y: 5.0, w: 9, h: 0.25, fontSize: 10, italic: true, color: C.accent2 });
s.addNotes('設定の正しさを別の AI に確かめさせるのは良い方法です。ただし人の承認の代わりではなく、確認を一段増やすものとして使います。おすすめは 4 段に重ねることです。1 段目は terraform validate や checkov などの機械的な検査で、22 番を 0.0.0.0/0 に開けない、のような必ず守る規則を見ます。何度やっても同じ結果になるのが強みです。2 段目が別の AI で、要件定義書と plan の差分を突き合わせ、要件とのずれや書き間違いを探させます。頼み方は「これで大丈夫?」ではなく、「合わない点を全部挙げて」とします。3 段目は人で、社内の事情に合っているかを見て承認し、責任を持ちます。4 段目は反映後の実際の通信で、VPC Reachability Analyzer や Network Access Analyzer、実際の接続で、本当に通るか、本当に止まるかを確かめます。AI は社内の事情を知らず、間違っていても問題なしと答えることがあり、書いた設定が正しくても通るかは別の話です。このラボでも、動かして初めて見つかったバグがたくさんありました。');

// Kiro から AWS の状態を見る
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '使い方と運用' });
s.addText('Kiro から AWS の状態を直接見られる?', { placeholder: 'title' });
txt(s, '見られる。Kiro のターミナルの aws-cli か AWS の MCP サーバーで読む。渡すのは読み取りの権限だけ', { x: 0.5, y: 0.98, w: 9, h: 0.3, fontSize: 11.5, color: C.accent1 });
s.addTable([
  [{ text: '見るもの', options: KH }, { text: '例', options: KH }],
  [kn('設定'), { text: 'describe-security-groups・describe-route-tables・describe-load-balancers・describe-target-health' }],
  [kn('状態・数値'), { text: 'CloudWatch のメトリクスとアラーム、Direct Connect の接続と BGP(describe-virtual-interfaces)' }],
  [kn('変更の記録'), { text: 'CloudTrail(誰がいつ何を変えたか)、AWS Config(設定の移り変わり)' }],
  [kn('IaC とのずれ'), { text: 'terraform plan -refresh-only、CloudFormation のドリフト検出' }],
], { x: 0.5, y: 1.4, w: 9.0, colW: [1.8, 7.2], fontSize: 10, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.36, valign: 'middle', objectName: 'status check table' });
card(s, 0.5, 3.35, 4.4, 1.58, 'status ask card');
txt(s, '頼み方の例', { x: 0.65, y: 3.43, w: 4.1, h: 0.28, fontSize: 11, bold: true, color: C.accent1 });
txt(s, '「本番の ALB のターゲットの状態と、ALB 用 SG の 443 番のルールを読み取りだけで確認して、表にして。設定は変えないで」', { x: 0.65, y: 3.75, w: 4.1, h: 1.1, fontSize: 10 });
card(s, 5.1, 3.35, 4.4, 1.58, 'status rule card');
txt(s, '使うときの決まり', { x: 5.25, y: 3.43, w: 4.1, h: 0.28, fontSize: 11, bold: true, color: C.accent3 });
const stRules = [
  'ViewOnlyAccess・SecurityAudit など設定だけ見る権限を、SSO の一時的な資格情報で(ReadOnlyAccess は S3 の中身なども読める)',
  '読んだ結果(IP・構成)は AI に送られる。秘密は読ませない',
  '本当に防ぐのは権限。Steering の決まりだけに頼らない',
];
txt(s, stRules.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < stRules.length - 1 } })), { x: 5.25, y: 3.73, w: 4.15, h: 1.15, fontSize: 9, paraSpaceAfter: 3 });
txt(s, 'このラボでも Claude は /api/cli で装置の状態を直接読んで確かめた。設計書の道具も describe しか呼ばない', { x: 0.5, y: 5.0, w: 9, h: 0.25, fontSize: 10, italic: true, color: C.accent2 });
s.addNotes('Kiro から AWS の状態を直接見ることはできます。Kiro は手元の PC で動くので、Kiro のターミナルから aws-cli を打つか、AWS の MCP サーバーを通して、実際の AWS を読めます。見られるのは、セキュリティグループやルートテーブル、ロードバランサー、ターゲットの状態などの設定、CloudWatch のメトリクスとアラーム、Direct Connect の接続と BGP の状態、CloudTrail と AWS Config の変更の記録、それに terraform plan の refresh-only やドリフト検出による IaC と実物のずれです。頼むときは「読み取りだけで確認して、設定は変えないで」と書きます。決まりとして、渡すのは ViewOnlyAccess や SecurityAudit のような設定だけを見る権限にし、SSO の一時的な資格情報で渡します。ReadOnlyAccess は S3 の中身など一部のデータそのものも読めてしまいます。読んだ結果は AI に送られるので、秘密は読ませません。書き込みを本当に防ぐのは権限で、Steering の決まりだけに頼りません。このラボでも Claude は装置の状態を直接読んで確かめていて、設計書の道具も describe しか呼びません。Kiro そのものでは試していません。');

// ほかの AWS の AI 開発ツール
pres.addSection({ title: 'ほかの AWS の AI ツール' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'ほかの AWS の AI ツール' });
s.addText('Kiro 以外の AWS の AI 開発ツールとの違い', { placeholder: 'title' });
s.addTable([
  [{ text: 'ツール', options: KH }, { text: '何のための道具か', options: KH }, { text: 'Kiro との違い', options: KH }],
  [kn('Kiro(エディタ・CLI・Web)'), { text: '仕様(Specs)から入って、コード・IaC を作る' }, { text: '—(この資料の主役)' }],
  [kn('Kiro CLI'), { text: 'ターミナルで使う Kiro' }, { text: 'Amazon Q Developer CLI の後継(2025-11)。q コマンドもそのまま使える' }],
  [kn('Amazon Q Developer'), { text: '今の IDE に足す補完・チャット。AWS コンソールでの質問・調査' }, { text: '仕様から入る作りは無い。コンソール連携は Q Developer 側の機能' }],
  [kn('AWS Transform'), { text: '移行・モダナイズ専用(VMware・メインフレーム・.NET)' }, { text: '新しく作る道具ではなく、今あるものを AWS へ移す道具。VMware のネットワーク変換も扱う' }],
  [kn('AWS DevOps Agent'), { text: '運用・障害対応(原因の調査、改善の提案)' }, { text: '作った後の運用の道具。2026-03 に一般提供' }],
  [kn('Amazon Bedrock(AgentCore)'), { text: '自分で AI エージェントを作る基盤' }, { text: '道具そのものではなく、道具を作るための部品' }],
], { x: 0.5, y: 1.05, w: 9.0, colW: [2.4, 3.1, 3.5], fontSize: 9.5, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.52, valign: 'middle', objectName: 'aws ai tools table' });
txt(s, '得意な場面が違う: 作る・相談する・移す・守る・自作する', { x: 0.5, y: 4.85, w: 9, h: 0.3, fontSize: 11.5, italic: true, color: C.accent2 });
s.addNotes('Kiro 以外にも、AWS には AI の開発ツールがいくつかあります。Kiro CLI は、以前の Amazon Q Developer CLI の後継で、2025 年 11 月に切り替わりました。q コマンドもそのまま使えます。Amazon Q Developer は今の IDE に足す補完やチャット、AWS コンソールでの質問や調査の道具で、仕様から入る作りはありません。AWS Transform は VMware やメインフレーム、.NET を AWS へ移すための道具で、VMware のネットワーク変換も扱います。AWS DevOps Agent は作った後の運用、障害の原因調査や改善の提案の道具で、2026 年 3 月に一般提供になりました。Amazon Bedrock の AgentCore は、自分で AI エージェントを作るための基盤です。');

s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'ほかの AWS の AI ツール' });
s.addText('VPC・DX・ALB・NLB では何を使う?', { placeholder: 'title' });
const phases = [
  ['移す', 'AWS Transform', '今の VMware 環境から移すなら、構成の洗い出し・依存関係・ネットワーク設定の変換・移行の順番づけ', C.accent4],
  ['作る', 'Kiro', '要件・設計 → VPC・DX・ALB・NLB の IaC → plan まで。手順書・設計書の下書き', C.accent1],
  ['相談する', 'Amazon Q Developer', 'AWS コンソールで「このサブネットの経路は?」などを聞く。今の IDE のまま補完', C.accent5],
  ['守る', 'AWS DevOps Agent', '障害のときの原因調査、改善の提案(どこまで触れるかは Agent Space で決める)', C.accent3],
  ['自作する', 'Amazon Bedrock', '会社独自の確認や自動化を AI エージェントにしたいとき(AgentCore)', C.accent2],
];
phases.forEach(([h, tool, b, col], i) => {
  const y = 1.05 + i * 0.75;
  hex(s, 0.5, y, 0.5, col, String(i + 1), 'phase hex ' + (i + 1));
  txt(s, h, { x: 1.15, y: y + 0.02, w: 1.1, h: 0.4, fontSize: 13, bold: true, color: C.background1, valign: 'middle' });
  txt(s, tool, { x: 2.25, y: y + 0.02, w: 2.2, h: 0.4, fontSize: 12, bold: true, color: col, valign: 'middle' });
  txt(s, b, { x: 4.45, y: y - 0.02, w: 5.05, h: 0.62, fontSize: 10, valign: 'middle' });
});
txt(s, 'どれでも同じ: 権限は最小限、本番は人の承認と CI/CD から。DX の物理と契約はどの AI もコードにできない', { x: 0.5, y: 4.88, w: 9, h: 0.28, fontSize: 10, color: C.accent6 });
s.addNotes('VPC、Direct Connect、ALB、NLB の仕事に当てはめると、使い分けはこうなります。今の VMware 環境から移すなら、AWS Transform で構成の洗い出しやネットワーク設定の変換、移行の順番づけを行います。新しく作る部分は Kiro で要件と設計を作り、IaC を書いて plan まで進めます。日々の相談は AWS コンソールの Amazon Q Developer で、作った後の障害対応は AWS DevOps Agent が担います。会社独自の確認を AI にしたいときは Amazon Bedrock で自作します。どれを使っても、権限は最小限にして、本番は人の承認と CI/CD から反映する、という決まりは同じです。この資料ではこれらのツールを実際には動かしておらず、2026 年 11 月時点の公式情報で整理しています。');

// まとめ
pres.addSection({ title: 'まとめ' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('まとめ', { placeholder: 'title' });
const sumItems = [
  ['Kiro は AWS 向けの道具がそろった AI 開発ツール', 'Specs・Steering・Hooks・MCP・Powers。仕様から入るので文書が残る'],
  ['速くなるのは書く・調べる・出す', '決めること(CIDR・経路・権限・費用)と確かめることは人に残る'],
  ['権限の渡し方がいちばん大事', '読み取り用だけ渡し、本番は人の承認のあと CI/CD から反映'],
  ['Direct Connect は物理と契約が絡む', 'コードにできるのは AWS 側の一部。経路は二重に確かめる'],
  ['要件定義書・設計書・手順書は下書きまで', '値は現物(IaC・describe)から起こし、検証環境で通して、レビューと承認は人'],
  ['変更は Kiro でなくてもよい', '成果物は普通の IaC と Markdown。変更は IaC から、仕様と実物を揃える'],
];
sumItems.forEach(([h, b], i) => {
  const y = 1.05 + i * 0.66;
  hex(s, 0.55, y, 0.45, C.accent1, String(i + 1), 'sum hex ' + (i + 1));
  txt(s, h, { x: 1.15, y: y - 0.03, w: 8.3, h: 0.32, fontSize: 13.5, bold: true, color: C.background1 });
  txt(s, b, { x: 1.15, y: y + 0.28, w: 8.3, h: 0.32, fontSize: 10.5 });
});
s.addNotes('まとめです。Kiro は AWS 向けの道具がそろった AI 開発ツールで、仕様から入るので文書が残ります。速くなるのは書く、調べる、出すの部分で、決めることと確かめることは人に残ります。いちばん大事なのは権限の渡し方で、Kiro には読み取り用だけを渡し、本番への反映は人が承認したあと CI/CD から行います。Direct Connect は物理と契約が絡むので、コードにできるのは AWS 側の一部です。要件定義書や設計書は下書きまでで、値は現物から起こし、レビューと承認は人が行います。');

// 出典
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('出典と、確かめていないこと', { placeholder: 'title' });
const srcs = [
  'Kiro Docs(CLI・Cloud sessions・Autonomous agent の sandbox・Authentication・Autopilot・Q からの移行)、Kiro FAQ・Pricing — kiro.dev',
  'Amazon Q Developer ユーザーガイド(Kiro への移行)・AWS Transform・AWS DevOps Agent の発表 — aws.amazon.com / docs.aws.amazon.com',
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
