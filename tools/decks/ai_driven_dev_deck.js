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
pres.title = 'AI ドリブン開発の裏側';
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
    { text: { text: 'Nirvana Lab ・ AI ドリブン開発の裏側', options: { x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 9, color: C.accent6, margin: 0 } } },
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

// 1. タイトル
pres.addSection({ title: 'はじめに' });
let s = pres.addSlide({ masterName: 'TITLE_DARK', sectionTitle: 'はじめに' });
s.addText('AI ドリブン開発の裏側', { placeholder: 'title' });
s.addText('Claude がニルヴァーナ ラボで、依頼から main への取り込みまで何をしているか', { placeholder: 'body' });
hex(s, 7.75, 0.45, 0.9, C.accent1, '情', 'motif hex info');
hex(s, 8.55, 0.95, 0.65, C.accent2, '注', 'motif hex warn');
hex(s, 7.95, 1.25, 0.5, C.accent3, '警', 'motif hex alert', C.background1);
txt(s, '2026-11-20', { x: 0.6, y: 4.7, w: 4, h: 0.3, fontSize: 12, color: C.accent6 });
s.addNotes('このデッキは、ニルヴァーナ ラボの開発で Claude が裏側で何をしているかをまとめたものです。依頼は一言、そこから調査・実装・テスト・本物のツールでの確認・GitHub の CI・main への取り込みまでを Claude が進めます。');

// 2. 要旨
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'はじめに' });
s.addText('一言の依頼が、確かめられた変更として main に入る', { placeholder: 'title' });
const pillars = [
  ['任せる', C.accent1, '人は「何をしたいか」を一言で。Claude がコードを読み、作り、テストを書く'],
  ['確かめる', C.accent2, '単体テストに加えて、本物のサーバーと本物のツール(snmpwalk・gnmic・ブラウザ)で動きを見る'],
  ['直し切る', C.accent3, 'テストが落ちたら再実行で済ませず、原因を再現してから直す'],
];
pillars.forEach(([head, col, body], i) => {
  const x = 0.5 + i * 3.05;
  card(s, x, 1.3, 2.85, 3.5, 'pillar card ' + (i + 1));
  hex(s, x + 0.3, 1.6, 0.75, col, String(i + 1), 'pillar hex ' + (i + 1));
  txt(s, head, { x: x + 0.3, y: 2.45, w: 2.3, h: 0.5, fontSize: 20, bold: true, color: C.background1 });
  txt(s, body, { x: x + 0.3, y: 3.0, w: 2.3, h: 1.65, fontSize: 13 });
});
s.addNotes('要点は三つです。任せる、確かめる、直し切る。今日の作業(SNMP のポートカウンタ、gNMI、STP の修正)もこの流れで進めました。');

// 3. 開発ループ
pres.addSection({ title: '進め方' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '進め方' });
s.addText('1 つの依頼が通る 8 つの工程', { placeholder: 'title' });
const steps = [
  ['依頼', '一言で方向を伝える'], ['読む', 'コードを調べる'], ['作る', '実装する'], ['単体テスト', 'サンドボックス内'],
  ['本物で確認', 'サンドボックス内の本物のツールで'], ['全体テスト', '約 2,100 件・17 分'], ['PR と CI', 'GitHub で同じテストをもう一度'], ['取り込み', '緑なら main へ'],
];
steps.forEach(([h, b], i) => {
  const row = Math.floor(i / 4), col = i % 4;
  const x = 0.5 + col * 2.3, y = 1.3 + row * 1.85;
  hex(s, x, y, 0.6, i === 4 ? C.accent2 : C.accent1, String(i + 1), 'step hex ' + (i + 1));
  txt(s, h, { x: x + 0.72, y: y + 0.02, w: 1.45, h: 0.35, fontSize: 15, bold: true, color: C.background1 });
  txt(s, b, { x: x + 0.72, y: y + 0.4, w: 1.45, h: 0.9, fontSize: 11, color: C.background2 });
});
txt(s, '4〜6 は LLM サンドボックス(次のスライド)の中で動かす。落ちたら「読む」に戻る', { x: 0.5, y: 4.85, w: 9, h: 0.3, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('工程は 8 つです。特徴は 5 番目の「本物で確認」です。単体テストが通っても、実際に起動したサーバーに本物の snmpwalk や gnmic を当てて、数字が期待どおり動くかを見ます。ここで見つかるバグが多いです。');

// 3b. LLM サンドボックス
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '進め方' });
s.addText('テストを動かす場所: LLM サンドボックス', { placeholder: 'title' });
// 左: 流れの図
const flow = [
  ['Claude', '読む・書く・判断する', C.accent1, 0.95],
  ['LLM サンドボックス', 'クラウド上の使い捨ての Linux コンテナ', C.accent2, 2.1],
  ['GitHub', 'push・PR・CI', C.accent4, 3.95],
];
flow.forEach(([h, b, col, y], i) => {
  const hh = i === 1 ? 1.65 : 0.8;
  s.addShape(SH.ROUNDED_RECTANGLE, { x: 0.5, y: y + 0.25, w: 4.4, h: hh, rectRadius: 0.08, fill: { color: C.text2 }, line: { color: col, width: 1.5 }, objectName: 'flow box ' + (i + 1) });
  txt(s, h, { x: 0.7, y: y + 0.32, w: 4.0, h: 0.35, fontSize: 15, bold: true, color: col });
  txt(s, b, { x: 0.7, y: y + 0.65, w: 4.0, h: 0.3, fontSize: 11, color: C.background2 });
});
const chips = ['エミュレータ', 'pytest', 'snmpwalk', 'gnmic', 'Playwright'];
chips.forEach((t, i) => {
  const cx = 0.7 + (i % 3) * 1.4, cy = 3.05 + Math.floor(i / 3) * 0.38;
  s.addShape(SH.ROUNDED_RECTANGLE, { x: cx, y: cy, w: 1.3, h: 0.3, rectRadius: 0.05, fill: { color: C.text1 }, line: { color: C.accent2, width: 0.75 }, objectName: 'chip ' + t });
  txt(s, t, { x: cx, y: cy, w: 1.3, h: 0.3, fontSize: 9, align: 'center', valign: 'middle', color: C.background1 });
});
// 右: 特徴
const feats = [
  ['隔離されている', 'あなたの PC や実機には触れない'],
  ['本物を動かせる', 'サーバーを起動し、snmpwalk などを当てる'],
  ['外への通信は許可制', 'PyTorch の配布元などは届かない'],
  ['使い捨て', '途中で入れ替わることも。残す物は Git へ'],
];
feats.forEach(([h, b], i) => {
  const y = 1.25 + i * 0.92;
  hex(s, 5.25, y, 0.45, C.accent2, String(i + 1), 'feat hex ' + (i + 1));
  txt(s, h, { x: 5.85, y: y - 0.02, w: 3.65, h: 0.32, fontSize: 14, bold: true, color: C.background1 });
  txt(s, b, { x: 5.85, y: y + 0.3, w: 3.65, h: 0.55, fontSize: 11 });
});
s.addNotes('4 から 6 の工程は、LLM サンドボックスの中で動いています。クラウド上に用意された使い捨ての Linux コンテナで、Claude はここでエミュレータのサーバーを起動し、net-snmp や gnmic、Playwright を入れて本物のツールを当てます。ユーザーの PC や実機からは隔離されていて、外への通信は許可されたものだけです。コンテナは使い捨てなので、残したい物は Git に push します。今日も途中でコンテナが入れ替わり、依存を入れ直しました。');

// 3b2. サンドボックスは Claude だけのもの?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '進め方' });
s.addText('サンドボックスは Claude だけのもの?', { placeholder: 'title' });
const HD = { bold: true, color: C.text1, fill: { color: C.accent2 }, fontSize: 11 };
const yes = (t) => ({ text: t, options: { color: THEME.colors.accent5, bold: true } });
const no = (t) => ({ text: t, options: { color: THEME.colors.accent3, bold: true } });
const nm = (t) => ({ text: t, options: { bold: true, color: C.background1 } });
s.addTable([
  [{ text: '製品', options: HD }, { text: '作業場所', options: HD }, { text: 'どこで動くか・外への通信', options: HD }],
  [nm('Claude Code(クラウド版、今回)'), yes('あり'), { text: 'Anthropic のコンテナ。許可制のプロキシ経由' }],
  [nm('OpenAI Codex(クラウド版)'), yes('あり'), { text: 'タスクごとのコンテナ。作業中の通信は既定でオフ' }],
  [nm('ChatGPT のコード実行'), yes('あり'), { text: 'Python 専用の隔離環境。外へは基本出ない' }],
  [nm('GitHub Copilot のコーディングエージェント'), yes('あり'), { text: 'GitHub Actions の使い捨て環境。ファイアウォールで制御' }],
  [nm('Jules・Devin・Cursor の裏方など'), yes('あり'), { text: '各社のクラウドの仮想環境' }],
  [nm('エディタ内の Copilot / Claude Code(PC 版)'), no('なし'), { text: '利用者の PC で直接動く' }],
], { x: 0.5, y: 1.1, w: 9.0, colW: [3.3, 0.9, 4.8], fontSize: 10.5, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.4, valign: 'middle', objectName: 'sandbox table' });
txt(s, '理由はどこも同じ: 安全(PC や本番を壊さない)・使い捨て(毎回まっさら)・出入りを絞れる(許可した宛先だけ)', { x: 0.5, y: 4.05, w: 9, h: 0.4, fontSize: 11 });
txt(s, '特別なのはサンドボックスがあることではなく、その中で本物のツールを動かして確かめた使い方', { x: 0.5, y: 4.5, w: 9, h: 0.35, fontSize: 12, italic: true, color: C.accent2 });
txt(s, '2026-11-22 時点。製品の機能・名前はよく変わる(出典は docs/ai-agent-sandboxes.md)', { x: 0.5, y: 4.88, w: 9, h: 0.28, fontSize: 9, color: C.accent6 });
s.addNotes('このサンドボックスは Claude だけのものではありません。OpenAI の Codex のクラウド版はタスクごとにコンテナを用意し、作業中の外への通信は既定でオフです。GitHub Copilot のコーディングエージェントは、GitHub Actions の使い捨て環境で作業して PR を出します。ChatGPT のコード実行も、Python 専用の隔離環境です。一方、エディタの中で動く Copilot や PC 版の Claude Code は、利用者の PC で直接動くのでサンドボックスではありません。サンドボックスを使う理由はどこも同じで、安全、使い捨て、出入りを絞れることです。この開発で特別だったのは、サンドボックスがあること自体ではなく、その中で本物のツールを動かして確かめながら進めた使い方の方です。');

// 3c. サンドボックスの中身と、さばける量
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '進め方' });
s.addText('サンドボックスの中身と、さばける量', { placeholder: 'title' });
const SPEC = { bold: true, color: C.text1, fill: { color: C.accent2 }, fontSize: 12 };
const sp = (a, b) => [{ text: a, options: { bold: true, color: C.background1 } }, { text: b }];
s.addTable([
  [{ text: '項目', options: SPEC }, { text: '2026-11-20 時点', options: SPEC }],
  sp('OS', 'Ubuntu 24.04.5 LTS'),
  sp('CPU', '4 コア(Xeon 2.1 GHz)'),
  sp('メモリ', '15 GB'),
  sp('ディスク', '空き 27 GB(使い切ると書き込めない)'),
  sp('言語', 'Python 3.11 ・ Node 22 ・ Go 1.24'),
  sp('外への通信', '許可制のプロキシ経由'),
], { x: 0.5, y: 1.2, w: 4.4, colW: [1.2, 3.2], fontSize: 11, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.42, valign: 'middle', objectName: 'spec table' });
s.addChart(pres.charts.BAR, [{ name: '失敗率(%)', labels: ['20 同時', '50 同時', '200 同時'], values: [0, 0.09, 4.73] }], {
  x: 5.15, y: 1.15, w: 4.35, h: 2.55, barDir: 'col', objectName: 'k6 failure chart',
  showTitle: true, title: '同時アクセス数と失敗率(%)', titleFontSize: 11, titleColor: THEME.colors.lt1, titleFontFace: '+mn-lt',
  chartColors: [THEME.colors.accent3], showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: THEME.colors.lt1, dataLabelFontSize: 10, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '0.00',
  catAxisLabelColor: THEME.colors.lt2, valAxisLabelColor: THEME.colors.lt2, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
  catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
  valGridLine: { color: THEME.colors.dk2, size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false,
});
card(s, 5.15, 3.85, 4.35, 1.15, 'cps card');
txt(s, '約 100/秒', { x: 5.35, y: 3.92, w: 1.75, h: 0.6, fontSize: 24, bold: true, color: C.accent2, valign: 'middle' });
txt(s, '新規接続(SSH)の上限。超えると失敗が急増', { x: 7.1, y: 3.95, w: 2.3, h: 0.6, fontSize: 11 });
txt(s, '壁はサンドボックスでなく、エミュレータの中継の作り', { x: 5.35, y: 4.55, w: 4.05, h: 0.4, fontSize: 10, color: C.accent6 });
s.addNotes('サンドボックスは Ubuntu 24.04.5 LTS、4 コア、メモリ 15 GB です。以前 k6 で ALB のエミュレータに負荷をかけたとき、同時 20 アクセスなら失敗 0%、50 で 0.09%、200 で 4.73% でした。SSH の新規接続は 1 秒あたり約 100 で頭打ちです。どちらも、壁はサンドボックスの性能ではなく、エミュレータの中継部分が 1 接続ごとにスレッドを 2 本使う作りであることが原因です。数百〜数千の同時接続を試すには、非同期 I/O への作り替えが次の一手になります。');

// 3d. サンドボックスと性能の壁(11/22 実測)
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '進め方' });
s.addText('サンドボックスと性能の壁(11/22 実測)', { placeholder: 'title' });
const chartBase = {
  barDir: 'col', showTitle: true, titleFontSize: 11, titleColor: THEME.colors.lt1, titleFontFace: '+mn-lt',
  showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: THEME.colors.lt1, dataLabelFontSize: 10, dataLabelFontFace: '+mn-lt',
  catAxisLabelColor: THEME.colors.lt2, valAxisLabelColor: THEME.colors.lt2, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
  catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
  valGridLine: { color: THEME.colors.dk2, size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false,
};
card(s, 0.5, 1.1, 4.35, 2.95, 'direct card');
card(s, 5.15, 1.1, 4.35, 2.95, 'relay card');
s.addChart(pres.charts.BAR, [{ name: '万 pps', labels: ['1 プロセス', '2 プロセス', '4 プロセス'], values: [76, 147, 285] }],
  Object.assign({}, chartBase, { x: 0.6, y: 1.15, w: 4.15, h: 2.3, objectName: 'direct chart', title: '中継なしの送信(万 pps)',
    chartColors: [THEME.colors.accent5], dataLabelFormatCode: '0' }));
txt(s, 'コアを足すとそのまま伸びる(3.7 倍)', { x: 0.75, y: 3.5, w: 3.9, h: 0.45, fontSize: 12, bold: true, color: C.accent5 });
s.addChart(pres.charts.BAR, [{ name: 'req/s', labels: ['中継に 1 コア', '中継に 2 コア'], values: [2300, 1300] }],
  Object.assign({}, chartBase, { x: 5.25, y: 1.15, w: 4.15, h: 2.3, objectName: 'relay chart', title: 'BIG-IP の中継経由の HTTP(req/s)',
    chartColors: [THEME.colors.accent3], dataLabelFormatCode: '#,##0' }));
txt(s, 'コアを足すと約半分に落ちる(GIL の取り合い)', { x: 5.4, y: 3.5, w: 3.9, h: 0.45, fontSize: 12, bold: true, color: C.accent3 });
txt(s, '200 同時の p95: 直接 4 ms / 中継経由 約 1 秒。中継の CPU は 1 コアの約 7 割で、使い切ってはいない(原因は調査中)', { x: 0.5, y: 4.2, w: 9, h: 0.4, fontSize: 11 });
txt(s, '壁はサンドボックスの性能ではなく、エミュレータの中継の作り(Python のスレッド)', { x: 0.5, y: 4.7, w: 9, h: 0.35, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('前の数字が、サンドボックスの性能で決まっていたのかを測り直しました。中継を通さずに送るだけなら、ルートインジェクターの送信は 1 プロセス 76 万 pps から 4 プロセス 285 万 pps へ、コアに比例して 3.7 倍に伸びます。9 月に測ったときも 58 万から 224 万で 3.9 倍でした。一方、BIG-IP の中継は Python のスレッドで動くので、2 コアを渡すと GIL の取り合いで処理量が約半分に落ちます。なお 1 コアのときの 2,300 は、負荷をかける側(Python)の上限で、中継の上限ではありません。200 同時になると、中継を通したときだけ p95 が約 1 秒に跳ねます。このとき中継の CPU には余裕があり、待ち受けの列を広げても変わらなかったので、原因はまだ調査中です。詳しくは docs/sandbox-performance-wall.md にあります。');

// 3e. 運ぶ量(Gbps)で見ると
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '進め方' });
s.addText('運ぶ量(Gbps)で見ると', { placeholder: 'title' });
card(s, 0.5, 1.1, 5.5, 3.45, 'gbps card');
s.addChart(pres.charts.BAR, [{ name: 'Gbps', labels: ['UDP 送るだけ\n(ルートインジェクター)', 'TCP 直接\n(iperf3)', 'TCP 中継経由\n1 コア', 'TCP 中継経由\n2 コア・4 本'], values: [9.0, 17.2, 6.5, 3.6] }],
  Object.assign({}, chartBase, { x: 0.6, y: 1.15, w: 5.3, h: 3.35, objectName: 'gbps chart', title: '2 つの IP の間(Gbps、同じ機械の中)',
    chartColors: [THEME.colors.accent1], dataLabelFormatCode: '0.0', catAxisLabelFontSize: 9 }));
card(s, 6.25, 1.1, 3.25, 3.45, 'gbps note card');
txt(s, '小さな接続をたくさん', { x: 6.45, y: 1.25, w: 2.9, h: 0.35, fontSize: 13, bold: true, color: C.accent2 });
txt(s, '1,300 req/s ≒ 3〜10 Mbps。重いのは運ぶ量ではなく、接続 1 本ごとの手間', { x: 6.45, y: 1.6, w: 2.9, h: 0.8, fontSize: 11 });
txt(s, '大きなデータを 1 本で', { x: 6.45, y: 2.45, w: 2.9, h: 0.35, fontSize: 13, bold: true, color: C.accent1 });
txt(s, '中継経由は直接の約 4 割(17 → 6.5 Gbps)。中継は 1 コアを使い切る(97%)。2 コアだとさらに落ちる', { x: 6.45, y: 2.8, w: 2.9, h: 0.95, fontSize: 11 });
txt(s, '見つけた実バグ: 中継が TCP の半クローズを扱えず、iperf3 の最後のやり取りが切れる', { x: 6.45, y: 3.8, w: 2.9, h: 0.7, fontSize: 10, color: C.accent3 });
txt(s, 'サンドボックスの中は 1 本で約 17 Gbps 出る。中継を通すと 6.5 Gbps、小さな接続だと Mbps 単位', { x: 0.5, y: 4.7, w: 9, h: 0.35, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('req/s は帯域の試験ではないので、Gbps に直しました。前の HTTP の試験は 1 回あたり数百バイトなので、1,300 req/s は 3〜10 Mbps にしかなりません。大きなデータを 2 つの IP の間で流すと、ルートインジェクターで UDP を送るだけなら 1 プロセス約 9 Gbps、iperf3 の TCP 1 本で直接 17.2 Gbps、BIG-IP の中継経由で 6.5 Gbps でした。中継は 1 コアを使い切っていて、2 コアを渡すと 4 本で 3.6 Gbps に落ちました。ラボの装置は VM ではなく、1 つのコンテナの中で別々の IP を持っているだけなので、これは同じ機械の中の本物の TCP の値です。測る途中で、中継が TCP の半クローズを扱えないバグも見つけました。');

// 4. テストの 4 層
pres.addSection({ title: 'テスト' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'テスト' });
s.addText('テストは 4 層。下ほど数が多く、上ほど本物に近い', { placeholder: 'title' });
const layers = [
  ['GitHub CI', 'push と PR のたびに自動', C.accent4, 4.4],
  ['本物のツールで確認', 'snmpwalk・gnmic・Playwright', C.accent2, 5.0],
  ['シナリオ回帰', '本物のサーバーで 12 シナリオ・62 チェック', C.accent5, 5.6],
  ['pytest', '172 ファイル・約 2,160 件', C.accent1, 6.2],
];
layers.forEach(([h, b, col, w], i) => {
  const y = 1.2 + i * 0.92;
  const x = 0.5 + (6.2 - w) / 2;
  s.addShape(SH.ROUNDED_RECTANGLE, { x, y, w, h: 0.8, rectRadius: 0.08, fill: { color: col }, line: { color: col, width: 0 }, objectName: 'layer ' + h });
  txt(s, [{ text: h, options: { bold: true, fontSize: 15, breakLine: true } }, { text: b, options: { fontSize: 11 } }],
      { x, y, w, h: 0.8, align: 'center', valign: 'middle', color: C.text1 });
});
txt(s, [
  { text: 'なぜ 4 層か', options: { bold: true, color: C.background1, fontSize: 15, breakLine: true } },
  { text: 'pytest は速く何度でも回せるが、作り物の中で完結する。', options: { breakLine: true } },
  { text: '本物のツールは、実機の監視ツールから見て正しいかを確かめる。', options: { breakLine: true } },
  { text: 'CI は「自分の環境では通る」を防ぐ最後の関門。', options: {} },
], { x: 7.0, y: 1.3, w: 2.5, h: 3.5, fontSize: 12, paraSpaceAfter: 8 });
s.addNotes('テストは 4 層です。一番下の pytest が約 2,160 件。その上のシナリオ回帰は、本物のサーバーを起動して OSPF・BGP・STP などを 12 シナリオで確かめます。さらに本物のツールでの確認、最後に GitHub の CI で同じテストをもう一度回します。');

// 4b. pytest と仲間の道具 / PyTorch の位置づけ
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'テスト' });
s.addText('テストの道具と、テストされる側の PyTorch', { placeholder: 'title' });
const tools4 = [
  ['pytest', 'テストを集めて実行する本体'],
  ['pytest-asyncio', '時間で動く処理(BGP など)'],
  ['pytest-cov', 'テストがコードのどこまでを通ったか'],
  ['TestClient', '起動せずに API を呼ぶ'],
  ['ruff', 'コードの書き方チェック'],
];
txt(s, 'テストの道具(CI も同じ一式を入れる)', { x: 0.5, y: 1.15, w: 5.2, h: 0.35, fontSize: 13, bold: true, color: C.accent1 });
tools4.forEach(([h, b], i) => {
  const y = 1.6 + i * 0.66;
  hex(s, 0.5, y, 0.42, C.accent1, '', 'tool hex ' + (i + 1));
  txt(s, h, { x: 1.05, y: y - 0.02, w: 1.65, h: 0.4, fontSize: 13, bold: true, color: C.background1, valign: 'middle' });
  txt(s, b, { x: 2.75, y: y - 0.02, w: 3.0, h: 0.4, fontSize: 11, valign: 'middle' });
});
card(s, 6.0, 1.15, 3.5, 3.85, 'torch card');
hex(s, 6.25, 1.35, 0.5, C.accent4, '', 'torch hex');
txt(s, 'PyTorch', { x: 6.9, y: 1.37, w: 2.4, h: 0.42, fontSize: 16, bold: true, color: C.background1, valign: 'middle' });
txt(s, [
  { text: 'テストの道具ではなく、異常検知(CPU などの「いつもと違う」)に使う側', options: { bullet: true, breakLine: true } },
  { text: '配布元に届かないため、手元で落としたものを GitHub の Release に置いて入れた', options: { bullet: true, breakLine: true } },
  { text: '本体には不要。入っていなければテスト 8 件を飛ばす', options: { bullet: true, breakLine: true } },
  { text: '既定は NumPy 版で、こちらは毎回テストしている', options: { bullet: true } },
], { x: 6.25, y: 2.0, w: 3.05, h: 2.9, fontSize: 11, paraSpaceAfter: 6 });
s.addNotes('テストの道具は pytest が中心で、時間で動く処理には pytest-asyncio、どこまでテストが通ったかは pytest-cov、サーバーを起動せずに API を呼ぶには FastAPI の TestClient、書き方のチェックに ruff を使います。CI も同じ一式を入れています。PyTorch はテストの道具ではなく、異常検知に使うテストされる側のライブラリです。サンドボックスからは配布元に届かないため、手元で落としたファイルを GitHub の Release 経由で入れる回り道をしました。本体には不要なので、入っていない環境ではそのテストを飛ばします。');

// 5. 数字
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'テスト' });
s.addText('今日の全体テスト', { placeholder: 'title' });
const stats = [
  ['2,134', 'passed / 失敗 0', C.accent5],
  ['17 分', '全体テストの所要時間', C.accent1],
  ['172', 'テストファイル', C.accent4],
  ['62', 'シナリオの確認項目', C.accent2],
];
stats.forEach(([n, l, col], i) => {
  const x = 0.5 + i * 2.3;
  card(s, x, 1.35, 2.1, 2.4, 'stat card ' + (i + 1));
  txt(s, n, { x: x + 0.15, y: 1.65, w: 1.8, h: 1.0, align: 'center', valign: 'middle', fontSize: 40, bold: true, color: col });
  txt(s, l, { x: x + 0.15, y: 2.8, w: 1.8, h: 0.7, align: 'center', fontSize: 12, color: C.background2 });
});
txt(s, '新しく足したテスト: gNMI のカウンタ 5 件・ポートカウンタ 12 件・STP 3 件', { x: 0.5, y: 4.2, w: 9, h: 0.4, fontSize: 14, color: C.background1 });
s.addNotes('今日の全体テストは 2,134 件が通り、失敗は 0 件でした。所要時間は約 17 分です。今日の作業で新しく足したテストは、gNMI のカウンタ、ポートカウンタ、STP の合わせて 20 件です。');

// 6. 本物のツール
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'テスト' });
s.addText('本物のツールを当てて確かめる', { placeholder: 'title' });
const H = { bold: true, color: C.text1, fill: { color: C.accent1 }, fontSize: 13 };
const R = (a, b, c) => [{ text: a, options: { bold: true, color: C.background1 } }, { text: b }, { text: c, options: { color: C.accent2 } }];
s.addTable([
  [{ text: 'ツール', options: H }, { text: '確かめたこと', options: H }, { text: '結果', options: H }],
  R('snmpwalk / snmpget', '待機中のアップリンクの IF-MIB', 'BPDU が 2 秒ごとに増加'),
  R('snmpget', 'PC から ping 10 回(1000 B)', 'ユニキャスト 10 個・10,280 B'),
  R('gnmic', 'gNMI の 1 秒ストリーム', '1 秒ごとに届き、ping の分だけ増加'),
  R('Playwright', '/cyber-view の演出', '起動演出と FX の切り替え、エラー 0'),
  R('uvicorn + curl', '本物のサーバーに CLI を流す', 'show の出力と API の値が一致'),
  R('pyATS / Genie', 'show の出力を実機用の解析器で読む', '読めない形を見つけて直した(以前)'),
  R('Batfish / GoBGP', '経路計算と本物の BGP と突き合わせ', '食い違いを見つけて直した(以前)'),
], { x: 0.5, y: 1.25, w: 9.0, colW: [2.1, 3.4, 3.5], fontSize: 12, color: C.background2, fill: { color: C.text2 }, border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.45, valign: 'middle', objectName: 'tools table' });
s.addNotes('単体テストは作り物の中で完結するので、実機の監視ツールから見て正しいかは別に確かめます。今日は net-snmp の snmpwalk、gnmic、Playwright を使いました。');

// 6b. 試験の全体像
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'テスト' });
s.addText('試験の全体像: 作り物の中と、外から本物で', { placeholder: 'title' });
const OV = { bold: true, color: C.text1, fill: { color: C.accent1 }, fontSize: 12 };
const ov = (a, b, c, inside) => [{ text: a, options: { bold: true, color: C.background1 } }, { text: b },
  { text: c, options: { color: inside ? C.accent1 : C.accent2 } }];
s.addTable([
  [{ text: '試験', options: OV }, { text: '何を確かめるか', options: OV }, { text: '道具', options: OV }],
  ov('単体・結合', '1 つ 1 つの部品が正しく動くか', 'pytest(約 2,160 件)', true),
  ov('シナリオ回帰', '本物のサーバーで OSPF・BGP・STP が通しで動くか', 'scenario_regression(12 本)', true),
  ov('機種×プロトコル', '3 機種 × 4 プロトコルの正常・障害・復旧・フラップ', '総当たり 144 項目', true),
  ov('LLM による判定', '文字列の一致では書きにくい「意味として正しいか」', 'llm_judge', true),
  ov('本物のツール', '監視・自動化ツールから見て正しいか', 'snmpwalk・gnmic・pyATS など', false),
  ov('ルートインジェクター', '外から本物の RIP / BGP を打ち込み、受け取って広めるか', 'route_injector_cli', false),
  ov('実環境', '自宅の本物の Catalyst で SNMP・trap・応答なし', '単体版 + 実機', false),
  ov('CI', '「自分の環境では通る」を防ぐ', 'GitHub Actions', false),
], { x: 0.5, y: 1.15, w: 9.0, colW: [1.9, 4.4, 2.7], fontSize: 11, color: C.background2, fill: { color: C.text2 },
     border: { type: 'solid', pt: 1, color: C.text1 }, rowH: 0.39, valign: 'middle', objectName: 'overview table' });
txt(s, [{ text: '水色', options: { color: C.accent1, bold: true } }, { text: ' = 作り物の中で確かめる   ' },
        { text: '橙', options: { color: C.accent2, bold: true } }, { text: ' = 外から本物で叩く。片方で漏れたバグをもう片方が拾う' }],
    { x: 0.5, y: 4.82, w: 9, h: 0.3, fontSize: 11 });
s.addNotes('試験は大きく 8 種類あります。上の 4 つは作り物の中で確かめる試験、下の 4 つは外から本物で叩く試験です。今日の STP の 2 件も、単体試験は通っていて、本物のツールで数値を見て初めて見つかりました。両方あることで漏れが減ります。');

// 6c. 画面で見る試験の様子
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'テスト' });
s.addText('試験の様子をニルヴァーナの画面で見る', { placeholder: 'title' });
s.addImage({ path: 'docs/images/cyber-view-test-run.jpg', x: 0.5, y: 1.15, w: 6.2, h: 3.68, objectName: 'test run screenshot',
             altText: 'ニルヴァーナの ROUTER LINKS 画面。装置の上に紫の「試」・緑の PASS・赤の「警」のプレート、左下に TEST RUN パネル' });
const legend = [
  ['試(紫)', 'どの装置に何を当てたか', C.accent4],
  ['試(緑)', 'チェックが通った', C.accent5],
  ['警(赤)', 'チェックが落ちた。理由も出す', C.accent3],
  ['TEST RUN', '件数と直近の結果。終了後 60 秒で消える', C.accent1],
];
legend.forEach(([h, b, col], i) => {
  const y = 1.2 + i * 0.9;
  hex(s, 6.95, y, 0.42, col, '', 'legend hex ' + (i + 1));
  txt(s, h, { x: 7.5, y: y - 0.03, w: 2.0, h: 0.32, fontSize: 13, bold: true, color: C.background1 });
  txt(s, b, { x: 7.5, y: y + 0.28, w: 2.0, h: 0.55, fontSize: 10 });
});
s.addNotes('Claude が裏で回している試験を、ニルヴァーナの画面でそのまま見られるようにしました。シナリオ回帰を流すと、装置の上にどのコマンドを当てたかが紫の「試」で、通ったら緑、落ちたら赤の「警」で出ます。左下の TEST RUN パネルには件数と直近の結果が流れます。pytest も環境変数 NETLAB_ACTIVITY_URL を指定すれば同じように流せます。');

// 7. CI が落ちたとき
pres.addSection({ title: '失敗への対応' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '失敗への対応' });
s.addText('CI が落ちたら、再実行ではなく原因を探す', { placeholder: 'title' });
const cases = [
  ['L2 ループ', '裏の定期処理が、テストより先に警報を出していた', 'テスト中は定期処理を止め、検知を直接呼ぶ', C.accent2],
  ['STP の復旧ログ', 'no shutdown の途中で BPDU がポートを作り直し、相手側の up ログが出ない', 'エミュレータの実バグ。落としたポートは復旧処理だけが作り直す', C.accent3],
  ['RIP のシナリオ', 'フィルタより先に経路が隣へ届くことがあった', 'distribute-list を network の前に入れる', C.accent2],
];
cases.forEach(([h, cause, fix, col], i) => {
  const x = 0.5 + i * 3.05;
  card(s, x, 1.25, 2.85, 3.65, 'case card ' + (i + 1));
  hex(s, x + 0.25, 1.45, 0.5, col, i === 1 ? '警' : '注', 'case hex ' + (i + 1), i === 1 ? C.background1 : C.text1);
  txt(s, h, { x: x + 0.9, y: 1.5, w: 1.8, h: 0.45, fontSize: 15, bold: true, color: C.background1, valign: 'middle' });
  txt(s, '原因', { x: x + 0.25, y: 2.15, w: 2.4, h: 0.3, fontSize: 11, bold: true, color: C.accent6 });
  txt(s, cause, { x: x + 0.25, y: 2.45, w: 2.4, h: 1.05, fontSize: 12 });
  txt(s, '直し方', { x: x + 0.25, y: 3.5, w: 2.4, h: 0.3, fontSize: 11, bold: true, color: C.accent6 });
  txt(s, fix, { x: x + 0.25, y: 3.8, w: 2.4, h: 1.0, fontSize: 12, color: C.background1 });
});
s.addNotes('今日、GitHub の CI で落ちたのは 3 件です。どれも「時々落ちる」で片付けず、原因を突き止めました。2 件目の STP は、テストではなくエミュレータ自体の実バグでした。');

// 8. 再現してから直す
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '失敗への対応' });
s.addText('まず同じ失敗を手元で再現する', { placeholder: 'title' });
card(s, 0.5, 1.25, 4.35, 3.2, 'before card');
card(s, 5.15, 1.25, 4.35, 3.2, 'after card');
txt(s, '直す前のコード', { x: 0.8, y: 1.45, w: 3.8, h: 0.4, fontSize: 16, bold: true, color: C.accent3 });
txt(s, '「ループを閉じた直後に 2.5 秒待つ」をテストに一時的に足すと、CI と全く同じ失敗が毎回起きる', { x: 0.8, y: 1.95, w: 3.8, h: 1.1, fontSize: 13 });
s.addText('assert (0 == 1)\n1 failed', { x: 0.8, y: 3.2, w: 3.8, h: 0.9, fontFace: 'Courier New', fontSize: 14, color: C.accent3, fill: { color: C.text1 }, margin: 8, isTextBox: true, objectName: 'before output' });
txt(s, '直した後のコード', { x: 5.45, y: 1.45, w: 3.8, h: 0.4, fontSize: 16, bold: true, color: C.accent5 });
txt(s, '同じ 2.5 秒の待ちを入れても通る。待ちを外して全体テストと CI でもう一度確かめる', { x: 5.45, y: 1.95, w: 3.8, h: 1.1, fontSize: 13 });
s.addText('29 passed', { x: 5.45, y: 3.2, w: 3.8, h: 0.9, fontFace: 'Courier New', fontSize: 14, color: C.accent5, fill: { color: C.text1 }, margin: 8, isTextBox: true, objectName: 'after output' });
txt(s, '再現できない修正は「たまたま通った」と区別がつかない', { x: 0.5, y: 4.65, w: 9, h: 0.35, fontSize: 13, italic: true, color: C.accent2 });
s.addNotes('時々しか落ちないテストは、落ちる条件を意図的に作って再現します。今回は待ち時間を 2.5 秒足すと、CI と同じ assert (0 == 1) が毎回出ました。直した後は同じ条件でも通ることを確かめています。');

// 9. 見つかった実バグ
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '失敗への対応' });
s.addText('確かめる中で見つかった実バグ(今日の分)', { placeholder: 'title' });
const bugs = [
  ['STP', 'SVI のサブネットが違うと BPDU が届かず、2 台とも「ルート」のまま'],
  ['STP', 'no shutdown で戻したとき、相手側の up ログが出ず LINK DOWN が残る'],
  ['カウンタ', '1/30 を 60 回足すと 1.999… になり、LLDP を 1 個少なく数えていた'],
  ['SNMP', 'L2 のアクセスポートが IF-MIB に出ず、流量を読めなかった'],
  ['PC', 'ping -c / -s でカウンタが動かず、ifconfig で IP が設定されなかった'],
  ['単体版', 'linkUp の trap を取りこぼすと、LINK DOWN が消えない'],
];
bugs.forEach(([tag, b], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.5 + col * 4.6, y = 1.25 + row * 1.2;
  hex(s, x, y, 0.55, C.accent3, '!', 'bug hex ' + (i + 1), C.background1);
  txt(s, tag, { x: x + 0.7, y: y + 0.0, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: C.accent3 });
  txt(s, b, { x: x + 0.7, y: y + 0.3, w: 3.7, h: 0.8, fontSize: 12 });
});
s.addNotes('作った機能を本物のツールで確かめると、関係する別の場所のバグも見つかります。今日見つけて直した実バグがこの 6 件です。STP の 1 件目は、SNMP のカウンタを確かめている最中に気づきました。');

// 9b. ある 1 日の実況
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '失敗への対応' });
s.addText('ある 1 日の実況(2026-11-20)', { placeholder: 'title' });
const day = [
  ['CI', '午前の PR で、GitHub の試験が 3 件落ちる', C.accent3],
  ['再現して直す', '手元で同じ失敗を再現。うち 1 件は STP の実バグ(復旧ログが出ない)', C.accent3],
  ['依頼', '「各機器のポートの SNMP カウンタを」', C.accent1],
  ['作る・確かめる', '全体 2,134 件が通る。snmpwalk で「STP が 2 台ともルート」に気づく', C.accent2],
  ['原因', 'BPDU が「同じ IP サブネットか」の判定に入っていた。外して直す', C.accent3],
  ['取り込み', '緑を確かめて main へ。この資料にまとめる', C.accent5],
];
day.forEach(([h, b, col], i) => {
  const y = 1.12 + i * 0.64;
  hex(s, 0.6, y, 0.48, col, String(i + 1), 'day hex ' + (i + 1), col === C.accent3 ? C.background1 : C.text1);
  txt(s, h, { x: 1.25, y: y + 0.04, w: 1.75, h: 0.35, fontSize: 14, bold: true, color: C.background1 });
  txt(s, b, { x: 3.0, y: y + 0.04, w: 6.5, h: 0.35, fontSize: 12 });
});
s.addNotes('今日 1 日の流れです。午前は、PR の GitHub の試験が 3 件落ちました。手元で同じ失敗を再現して直し、うち 1 件は STP の復旧ログが出ないエミュレータの実バグでした。午後はポートの SNMP カウンタを頼まれて実装し、全体試験も通りました。ところが本物の snmpwalk で数値を見ていると、STP が 2 台ともルートのままになっていることに気づきました。原因は、L2 の BPDU が IP のサブネット判定に入っていたことでした。直して緑を確かめ、main に取り込みました。');

// 9c. 知らないうちに CI/CD
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '失敗への対応' });
s.addText('知らないうちに CI/CD を回している', { placeholder: 'title' });
const cicdFlow = [
  ['人', '「やって」', C.accent2],
  ['Claude', '作業ブランチに push', C.accent1],
  ['CI', 'GitHub が全試験を自動で', C.accent5],
  ['人', '「取り込んで」', C.accent2],
  ['CD', 'main を Render が公開', C.accent4],
];
cicdFlow.forEach(([who, what, col], i) => {
  const x = 0.55 + i * 1.86;
  hex(s, x + 0.35, 1.15, 0.62, col, String(i + 1), 'flow hex ' + (i + 1));
  txt(s, who, { x, y: 1.75, w: 1.32, h: 0.3, fontSize: 13, bold: true, color: C.background1, align: 'center' });
  txt(s, what, { x, y: 2.05, w: 1.32, h: 0.5, fontSize: 11, align: 'center' });
  if (i < cicdFlow.length - 1) {
    s.addShape(SH.RIGHT_ARROW, { x: x + 1.38, y: 1.38, w: 0.4, h: 0.22, fill: { color: C.accent6 }, line: { color: C.accent6, width: 0 }, objectName: 'flow arrow ' + (i + 1) });
  }
});
card(s, 0.5, 2.75, 4.35, 2.05, 'ci card');
card(s, 5.15, 2.75, 4.35, 2.05, 'cd card');
txt(s, 'CI(継続的インテグレーション)', { x: 0.75, y: 2.9, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: C.accent5 });
txt(s, '変更を小さく何度も混ぜ、そのたびに自動で全部試す。ここでは push のたびに GitHub Actions が pytest 約 2,200 件とシナリオ回帰を回す(約 20 分)。赤なら直すまで取り込まない', { x: 0.75, y: 3.3, w: 3.9, h: 1.4, fontSize: 11.5 });
txt(s, 'CD(継続的デリバリー)', { x: 5.4, y: 2.9, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: C.accent4 });
txt(s, '試験に通ったものを、いつでも出せる状態に保って出す。ここでは main を常に緑に保ち、Render の公開版(network-lab-emulator.onrender.com)が main から作られる', { x: 5.4, y: 3.3, w: 3.9, h: 1.4, fontSize: 11.5 });
txt(s, '例: 設定例を変えたのに試験を直し忘れた push を、CI が赤で止めた(11/21)', { x: 0.75, y: 4.2, w: 3.9, h: 0.5, fontSize: 11, color: C.accent5 });
txt(s, '例: 赤いコミットのある PR は、緑になるまで「取り込んで」を待つ', { x: 5.4, y: 4.2, w: 3.9, h: 0.5, fontSize: 11, color: C.accent4 });
txt(s, '用語を知らなくても、「やって」と「取り込んで」の 2 つの言葉が CI/CD のスイッチになっている', { x: 0.5, y: 4.88, w: 9, h: 0.3, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('CI/CD という言葉を意識しなくても、この開発は CI/CD の形で回っています。人が「やって」と言うと、Claude が作業ブランチに push し、そのたびに GitHub Actions が約 2,200 件の試験とシナリオ回帰を自動で流します。これが CI です。緑になってから人が「取り込んで」と言うと main に入り、公開版は main から作られます。これが CD です。人は用語を知らなくても、2 つの言葉で承認の関門を握っています。');

// 9d. 知らないものを作った後の確かめ
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: '失敗への対応' });
s.addText('作るより、確かめる方が大変', { placeholder: 'title' });
txt(s, '人も Claude も初めて使う道具を組み合わせると、出来上がったものが「正しく動いているか」を、聞きながら確かめることになる', { x: 0.5, y: 1.05, w: 9, h: 0.5, fontSize: 13, color: C.accent1 });
card(s, 0.5, 1.65, 4.35, 3.1, 'hard card');
card(s, 5.15, 1.65, 4.35, 3.1, 'ease card');
txt(s, '大変だったこと(実機 3650 + WSL)', { x: 0.75, y: 1.8, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: C.accent3 });
const hard = [
  'Claude は実機に触れない。画面写真と貼り付けた出力の往復で状態を知る',
  '「正しい画面」を誰も知らない。gnmic・NetFlow v9・Loki など、OK の見た目から聞き合う',
  '環境の壁が次々に出る: 再起動で設定が消える、PowerShell の .\\、WSL が OSPF を受けない、管理者権限',
  '外のサービスの仕様変更: IHR の API 移転、Groq の 403(User-Agent)',
];
txt(s, hard.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < hard.length - 1 } })), { x: 0.75, y: 2.2, w: 3.95, h: 2.5, fontSize: 11, paraSpaceAfter: 5 });
txt(s, 'やわらげた工夫', { x: 5.4, y: 1.8, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: C.accent5 });
const ease = [
  '確かめを道具に入れる: 起動スクリプトが OK / NG と原因の目安を出す',
  '設定画面に版番号。「古い画面が答えていた」をすぐ見分ける',
  '先に模擬装置と本物のツール(Prometheus・Loki・Grafana・Cacti)で通しておく',
  '実機で分かったことは、その日のうちにドキュメントと試験に残す',
];
txt(s, ease.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < ease.length - 1 } })), { x: 5.4, y: 2.2, w: 3.95, h: 2.5, fontSize: 11, paraSpaceAfter: 5 });
txt(s, '「聞きながら進める」往復は手抜きではなく、計画に最初から入れておく工程', { x: 0.5, y: 4.85, w: 9, h: 0.3, fontSize: 12, italic: true, color: C.accent2 });
s.addNotes('実装そのものは早く進みます。時間がかかるのは、出来上がったものが本当に正しく動いているかを確かめるところです。Claude は自宅の実機に触れないので、画面の写真や貼り付けた出力をやり取りして状態を知ります。gnmic や NetFlow v9、Loki のように人も初めて使う道具だと、そもそも正しい画面がどう見えるのかを、お互いに聞き合いながら確かめることになりました。再起動で設定が消える、PowerShell では .\\ が要る、WSL は OSPF を受け取れない、といった環境の壁も次々に出ました。そこで、起動スクリプト自身が OK と NG と原因の目安を出す、設定画面に版番号を出す、先に模擬装置と本物のツールで通しておく、分かったことをその日のうちに残す、という工夫をしています。');

// 10. 役割分担
pres.addSection({ title: 'まとめ' });
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('人が決めること、Claude が進めること', { placeholder: 'title' });
card(s, 0.5, 1.25, 4.35, 3.6, 'human card');
card(s, 5.15, 1.25, 4.35, 3.6, 'claude card');
hex(s, 0.8, 1.45, 0.55, C.accent2, '人', 'human hex');
hex(s, 5.45, 1.45, 0.55, C.accent1, 'AI', 'claude hex');
txt(s, '人', { x: 1.5, y: 1.5, w: 3, h: 0.45, fontSize: 18, bold: true, color: C.background1, valign: 'middle' });
txt(s, 'Claude', { x: 6.15, y: 1.5, w: 3, h: 0.45, fontSize: 18, bold: true, color: C.background1, valign: 'middle' });
const humanList = ['何を作るか・優先順位を決める', '画面の見た目を判断する', '自宅の実機(Catalyst)で試す', '「main に取り込んで」と決める'];
const claudeList = ['コードを読み、実装し、テストを書く', '本物のツールで動きを確かめる', 'CI の失敗の原因を探して直す', 'ドキュメントと変更まとめを書く'];
txt(s, humanList.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < humanList.length - 1 } })), { x: 0.8, y: 2.25, w: 3.8, h: 2.4, fontSize: 14, paraSpaceAfter: 8 });
txt(s, claudeList.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < claudeList.length - 1 } })), { x: 5.45, y: 2.25, w: 3.8, h: 2.4, fontSize: 14, paraSpaceAfter: 8 });
s.addNotes('人が決めるのは方向と判断です。何を作るか、見た目はどうか、自宅の実機で試すか、main に取り込むか。手を動かして確かめる部分は Claude が進めます。');

// 11. 安全装置
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('勝手に進めすぎないための決まり', { placeholder: 'title' });
const rules = [
  ['main への取り込みは、人が頼んだときだけ', 'CI が緑でも、指示が無ければマージしない'],
  ['履歴を書き換えない', '強制 push が止められたときは、普通のマージで対応した'],
  ['秘密はコミットしない', 'API キーは環境変数。証明書は .gitignore'],
  ['テストを消して緑にしない', '落ちたテストは原因を直す。スキップや無効化はしない'],
];
rules.forEach(([h, b], i) => {
  const y = 1.25 + i * 0.9;
  hex(s, 0.5, y, 0.6, C.accent5, String(i + 1), 'rule hex ' + (i + 1));
  txt(s, h, { x: 1.3, y: y + 0.02, w: 8, h: 0.35, fontSize: 15, bold: true, color: C.background1 });
  txt(s, b, { x: 1.3, y: y + 0.38, w: 8, h: 0.4, fontSize: 12 });
});
s.addNotes('AI に任せる範囲が広いほど、決まりが大事です。今日も、強制 push は環境側で止められ、通常のマージで対応しました。main への取り込みは「取り込んで」と言われたときだけ行います。');

// 11b. AI ドリブンで AWS を作るなら
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('AI ドリブンで AWS を作るなら', { placeholder: 'title' });
const awsFlow = [
  ['人', '要件を言う', C.accent2],
  ['Claude', 'Terraform などを書く', C.accent1],
  ['サンドボックス', 'fmt・validate・plan、模擬環境で試す', C.accent2],
  ['CI', 'lint・セキュリティ検査・plan を PR に', C.accent5],
  ['人', 'plan を見て apply を承認', C.accent2],
  ['Claude', 'describe で確かめ、記録を残す', C.accent1],
];
awsFlow.forEach(([who, what, col], i) => {
  const x = 0.5 + i * 1.53;
  hex(s, x + 0.4, 1.1, 0.55, col, String(i + 1), 'aws hex ' + (i + 1));
  txt(s, who, { x, y: 1.65, w: 1.45, h: 0.3, fontSize: 12, bold: true, color: C.background1, align: 'center' });
  txt(s, what, { x, y: 1.95, w: 1.45, h: 0.7, fontSize: 9.5, align: 'center' });
});
card(s, 0.5, 2.8, 4.35, 2.2, 'aws done card');
card(s, 5.15, 2.8, 4.35, 2.2, 'aws guard card');
txt(s, 'このラボで実際にやったこと', { x: 0.75, y: 2.92, w: 3.9, h: 0.35, fontSize: 13, bold: true, color: C.accent5 });
const awsDone = [
  'ALB を aws-cli の構文で作れる模擬装置にし、本物の HTTP で振り分けを確認',
  'aws-cli が読む定義(botocore)と突き合わせ、足りない項目を直した',
  'AWS の IP 範囲(ip-ranges.json)を地図に重ねた',
  '本物の AWS への構築はまだしていない',
];
txt(s, awsDone.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < awsDone.length - 1 } })), { x: 0.75, y: 3.3, w: 3.95, h: 1.65, fontSize: 10.5, paraSpaceAfter: 4 });
txt(s, '本番の AWS で守ること', { x: 5.4, y: 2.92, w: 3.9, h: 0.35, fontSize: 13, bold: true, color: C.accent3 });
const awsGuard = [
  'AI に渡す鍵は plan(読み取り)用だけ。apply は人の承認のあと',
  '鍵はチャットに貼らない。期限付きの権限(OIDC など)を使う',
  '外への通信は許可制: AWS の API に出る宛先だけ開ける',
  '費用と削除(destroy)は、必ず人が確かめる',
];
txt(s, awsGuard.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < awsGuard.length - 1 } })), { x: 5.4, y: 3.3, w: 3.95, h: 1.65, fontSize: 10.5, paraSpaceAfter: 4 });
s.addNotes('AWS の構築も、この資料と同じ流れで AI ドリブンにできます。人が要件を言い、Claude が Terraform などを書き、サンドボックスで fmt・validate・plan を流し、模擬環境で試します。CI で lint やセキュリティ検査を通し、plan の結果を PR に載せます。人が plan を見て apply を承認し、Claude が aws の describe 系コマンドで出来上がりを確かめて記録を残します。このラボで実際にやったのは、ALB を aws-cli の構文で作れる模擬装置にして本物の HTTP で振り分けを確かめたこと、aws-cli が読む定義と突き合わせたこと、AWS の IP 範囲を地図に重ねたことまでで、本物の AWS への構築はまだしていません。本番でやるなら、AI に渡す鍵は読み取り用だけにして apply は人の承認のあとにする、鍵はチャットに貼らない、外への通信は AWS の API だけ開ける、費用と削除は人が確かめる、の 4 つを守ります。詳しくは docs/ai-driven-aws.md にあります。');

// 11c. AWS の Kiro で開発するなら
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
s.addText('AWS の Kiro で開発するなら', { placeholder: 'title' });
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
txt(s, 'AWS 構築なら: Specs に要件、design に構成図、tasks に Terraform/SAM の作業を分け、前のスライドの流れ(plan → 人の承認 → apply)に乗せる', { x: 0.5, y: 4.3, w: 9, h: 0.45, fontSize: 11 });
txt(s, '注意: Kiro のクラウドの隔離環境は、既定で外への通信が制限なし(今回のサンドボックスは許可制)。鍵の扱いは同じく慎重に', { x: 0.5, y: 4.75, w: 9, h: 0.4, fontSize: 10.5, color: C.accent3 });
s.addNotes('AWS には Kiro という AI 開発ツールがあります。VS Code 系のエディタのほか、CLI や Web でも使えます。特徴は、コードを書く前に仕様を作ることで、依頼から requirements、design、tasks の 3 つの Markdown を作り、タスクの順に実装します。プロジェクトの決まりを毎回渡す Steering は、この開発の CLAUDE.md に当たります。保存などのたびに裏で作業を走らせる Hooks は、Claude Code の hooks に当たります。クラウドセッションや自律エージェントは、管理されたクラウドの隔離環境で作業を続ける仕組みで、今回の LLM サンドボックスと同じ考え方です。AWS の構築に使うなら、Specs に要件、design に構成、tasks に Terraform や SAM の作業を分け、前のスライドの流れに乗せます。注意点として、Kiro のクラウドの隔離環境は既定で外への通信に制限が無いので、鍵の扱いは慎重にします。この資料では Kiro を実際には動かしていません。内容は 2026 年 11 月時点の公式ドキュメントで確かめたものです。');

// 11d. Kiro で AWS 構築は楽になる?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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

// 11f4. 要件定義書も Kiro で作れる?
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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
s = pres.addSlide({ masterName: 'CONTENT_DARK', sectionTitle: 'まとめ' });
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

// 12. 次の一手
s = pres.addSlide({ masterName: 'TITLE_DARK', sectionTitle: 'まとめ' });
s.addText('次の一手', { placeholder: 'title' });
s.addText([
  { text: 'gNMI の 1 秒カウンタをニルヴァーナの画面へ', options: { bullet: true, breakLine: true } },
  { text: 'Streamlit でカウンタ履歴のページ', options: { bullet: true, breakLine: true } },
  { text: '全体テストの並列化で 17 分を短く', options: { bullet: true } },
], { placeholder: 'body', paraSpaceAfter: 6 });
hex(s, 7.75, 0.45, 0.9, C.accent1, '', 'motif hex 1');
hex(s, 8.55, 0.95, 0.65, C.accent2, '', 'motif hex 2');
hex(s, 7.95, 1.25, 0.5, C.accent3, '', 'motif hex 3');
s.addNotes('次は、今日作った gNMI の 1 秒カウンタをニルヴァーナの画面に取り込むこと、Streamlit でカウンタ履歴のページを作ること、全体テストを並列化して 17 分を短くすることを考えています。');

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
