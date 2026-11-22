"""
/cyber-view: 警報の確認(ACK)と、AI ボタンでの自動解析

- ACK: 直近10分の未確認の「警」があると、画面下に「警 × N ・ ACK」の六角ボタン。押すと ALERT ACKNOWLEDGED の演出で
  消える。確認済みの時刻はブラウザに覚え(cvAckT)、装置やサーバーの状態は変えない(新しい警報はまた出る)
- AI: AI ボタンで窓を開いたら、そのまま解析を始める。解析中は手順と経過秒数を出す
ラボの本物の画面で、ボタン→押す→消える、AI の自動解析(と、応答を遅らせたときの解析中の表示)を Playwright で確かめた。
"""
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def _page(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def test_ack_button_hides_acknowledged_alerts_only_in_this_browser():
    s = _page('static/cyber_view.html')
    assert 'id="ack"' in s and 'ALERT ACKNOWLEDGED' in s and "localStorage.setItem('cvAckT'" in s
    assert 'if (now - a.t > 600 || !unacked(a)) continue;' in s          # NETWORK のパネル
    assert 'l.alerts.filter(unacked).length' in s                       # ROUTER LINKS のリンク
    assert "'testpanel', 'ack']" in s                                   # プレートがボタンに重ならない
    assert 'pointer-events: auto;' in s.split('#ack {', 1)[1].split('}', 1)[0]   # .hud は既定で押せない


def test_ai_panel_analyzes_on_open_and_shows_progress():
    s = _page('static/cyber_view.html')
    assert "if (aiStatus.provider !== 'unavailable' && !aiBusy) aiAnalyze();" in s
    assert 'AI ANALYZING // 解析中' in s and "id=\"aiEl\"" in s


def test_standalone_page_is_the_same_file():
    assert _page('static/cyber_view.html') == _page('cyber-view-standalone/web/cyber_view.html')
