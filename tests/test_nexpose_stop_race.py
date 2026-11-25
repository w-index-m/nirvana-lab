"""スキャンの stop が最後の装置の評価中に届いても、finished で上書きしないこと。

CI の全体テストで test_nexpose_real_scan.py::test_async_scan_can_really_be_stopped が
「stop を受け付けたのに、最後に finished になった」で落ちたことがある。最後の装置を評価中に
stop が来るとループが自然に終わり、stopped が立たないまま finished を書いていた。
ここでは評価そのものを差し替えて、その順番を決まった形で再現する。
"""
import os
import sys
import threading
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from engine.nexpose import NexposeEngine  # noqa: E402


def _dev(ip):
    return types.SimpleNamespace(interfaces={'Gi0/0': {'ip': ip}})


def _fake_asset():
    return {'vulnerabilities': {'critical': 0, 'severe': 0, 'moderate': 0, 'total': 0},
            'credentialStatus': 'no-credential', 'riskScore': 0.0}


def _run(stop_during_call):
    eng = NexposeEngine()
    sid, err = eng.create_site({'name': 'race'})
    assert err is None
    devices = {'d1': _dev('10.9.0.1'), 'd2': _dev('10.9.0.2')}
    calls = {'n': 0}
    holder = {}
    started = threading.Event()

    def fake_assess(*_a, **_k):
        calls['n'] += 1
        if calls['n'] == stop_during_call:
            started.wait(5)
            ok, msg = eng.set_scan_status(holder['id'], 'stop')
            assert ok, msg
        return _fake_asset()

    eng._assess = fake_assess
    scan_id, err = eng.start_scan(sid, devices, {'async': True, 'probe': False})
    assert err is None
    holder['id'] = scan_id
    started.set()
    for _ in range(100):
        if eng.scans[scan_id].get('duration'):
            break
        threading.Event().wait(0.05)
    return eng.scans[scan_id], calls['n']


def test_stop_during_last_device_stays_stopped():
    scan, n = _run(stop_during_call=2)
    assert n == 2
    assert scan['status'] == 'stopped'      # 以前は finished に戻っていた
    assert scan['assets'] == 2              # 評価中だった最後の1台は終わってよい


def test_stop_during_first_device_skips_the_rest():
    scan, n = _run(stop_during_call=1)
    assert n == 1                           # 2台目には進まない
    assert scan['status'] == 'stopped'
    assert scan['assets'] == 1
