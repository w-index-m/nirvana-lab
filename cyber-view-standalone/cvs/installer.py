"""
インストーラーの中身: いま動いている監視の仕組みを探して、Cyber View の設定ファイル(config.yaml)の下書きを作る

  python -m cvs.installer                 # 見つけたものを表示するだけ
  python -m cvs.installer --write config.yaml [--force]

探すもの(引数で場所を指定すれば、そこだけを見る):
  - Prometheus(既定 http://127.0.0.1:9090): snmp_exporter の scrape job と、その対象(装置)・インタフェース
  - Loki(既定 http://127.0.0.1:3100)
  - Zabbix(/etc/zabbix/web/zabbix.conf.php があるか、--zabbix で URL)。トークンは ${ZABBIX_TOKEN} のまま。
    環境変数 ZABBIX_TOKEN(または ZABBIX_USER / ZABBIX_PASSWORD)があれば API で監視中のホストと
    IF(「Interface …: Bits received」のアイテム)を読み、装置の下書きにする(--zabbix-group でホストグループを絞る)。
    IF の IP は Zabbix に無いので、SNMP v1/v2c のホストは ipAddrTable を読んで補う(つながりの推定に使う。
    community はホストの SNMP インタフェースの設定・マクロから。--snmp-community で指定、--no-snmp-probe で読まない)
  - MRTG(/etc/mrtg.cfg・/etc/mrtg/*.cfg): Target から装置・インタフェース・IP
  - Cacti(/var/lib/cacti/rra 等と、DB の接続情報 /etc/cacti/db.php 等): RRD と装置・インタフェースの対応は Cacti の DB から自動で読む
    ので、targets は下書き(コメント)として出す
  - Ollama(既定 http://127.0.0.1:11434)と、AI の鍵(ANTHROPIC_API_KEY / GROQ_API_KEY / OPENAI_API_KEY)
つながり(links)は、同じ /30・/31 に IP がある2台を「推定」として入れる。必ず見直すこと。
既存の設定ファイルは --force が無ければ上書きしない。秘密(トークン・パスワード)はファイルに書かない。
"""
import argparse
import glob
import ipaddress
import json
import os
import re
import sys
import urllib.parse
import urllib.request

from .cacti_db import DB_CONFIG_CANDIDATES, _client as _mysql_client, read_db_config
from .legacy_sources import CACTI_RRA_CANDIDATES, MRTG_CFG_CANDIDATES, parse_mrtg_cfg
from .link_evidence import norm_if

MRTG_CFGS = MRTG_CFG_CANDIDATES
CACTI_DIRS = CACTI_RRA_CANDIDATES


def http_json(url, timeout=3):
    req = urllib.request.Request(url, headers={'User-Agent': 'cyber-view-installer'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))      # 構内の監視基盤へは直接
    with opener.open(req, timeout=timeout) as r:
        body = r.read().decode('utf-8', 'replace')
    try:
        return json.loads(body)
    except ValueError:
        return body


def _prom(url, get, q):
    d = get(url.rstrip('/') + '/api/v1/query?' + urllib.parse.urlencode({'query': q}))
    return d['data']['result'] if isinstance(d, dict) and d.get('status') == 'success' else []


# Zabbix のテンプレート名 → この画面の装置の種類(上から順に最初に当たったもの)
ZBX_TYPE_HINTS = (('nexus', 'nexus'), ('catalyst', 'catalyst'), ('asa', 'asa'), ('cisco', 'cisco'),
                  ('arista', 'arista'), ('juniper', 'juniper'), ('junos', 'juniper'), ('fortigate', 'fortigate'),
                  ('yamaha', 'yamaha'), ('apresia', 'apresia'))
_OID_IFNAME, _OID_IFDESCR = '1.3.6.1.2.1.31.1.1.1.1', '1.3.6.1.2.1.2.2.1.2'
_OID_IPIFINDEX, _OID_IPMASK = '1.3.6.1.2.1.4.20.1.2', '1.3.6.1.2.1.4.20.1.3'


def zbx_type(templates):
    names = ' '.join(t.get('name', '') for t in templates or []).lower()
    return next((v for k, v in ZBX_TYPE_HINTS if k in names), 'cisco')


def snmp_if_ips(host, community, walk=None, timeout=1.5):
    """{IF 名: (ip, prefix)}(ipAddrTable と ifName/ifDescr。SNMP v1/v2c)"""
    if walk is None:
        from .snmp_client import walk
    kw = {'timeout': timeout, 'retries': 0}
    names = {}
    for root in (_OID_IFDESCR, _OID_IFNAME):            # ifName があれば ifName を優先(Zabbix のアイテム名と同じ)
        for o, v in walk(host, community, root, **kw):
            names[o.rsplit('.', 1)[1]] = v.decode('utf-8', 'replace') if isinstance(v, bytes) else str(v)
    masks = {o[len(_OID_IPMASK) + 1:]: v for o, v in walk(host, community, _OID_IPMASK, **kw)}
    out = {}
    for o, idx in walk(host, community, _OID_IPIFINDEX, **kw):
        ip = o[len(_OID_IPIFINDEX) + 1:]
        if ip.startswith('127.') or str(idx) not in names:
            continue
        m = masks.get(ip)
        try:
            plen = ipaddress.IPv4Network(f'0.0.0.0/{m}').prefixlen if m else 24
        except ValueError:
            plen = 24
        out[names[str(idx)]] = (ip, plen)
    return out


def _zbx_community(iface, macros):
    c = str(((iface or {}).get('details') or {}).get('community') or '')
    for _ in range(3):                                   # マクロ({$SNMP_COMMUNITY} 等)を引く。秘密のマクロは値が返らない
        if not (c.startswith('{$') and c.endswith('}')):
            break
        c = macros.get(c, '')
    return c if c and not c.startswith('{$') else None


def zabbix_inventory(z, group=None, snmp_community=None, probe=True, walk=None, notes=None, meta=None):
    """Zabbix の API から {ホスト名: {hostname, zabbix_host, type, mgmt_ip, ifs: {key: {name, ip?, prefix?}}}}。
    「Interface …: Bits received」のアイテムがあるホスト(= ネットワーク機器)だけを返す"""
    notes = notes if notes is not None else []
    meta = meta if meta is not None else {}
    z.ensure_auth()
    params = {'output': ['hostid', 'host', 'name'], 'filter': {'status': 0},
              'selectInterfaces': ['ip', 'dns', 'useip', 'type', 'main', 'details'],
              'selectParentTemplates': ['name']}
    if group:
        gids = [g['groupid'] for g in z.call('hostgroup.get', {'output': ['groupid'], 'filter': {'name': [group]}})]
        if not gids:
            notes.append(f'Zabbix: ホストグループ「{group}」が見つかりません')
            return {}
        params['groupids'] = gids
    hosts = z.call('host.get', params)
    if not hosts:
        return {}
    ids = [h['hostid'] for h in hosts]
    from .sources import _ZBX_IF_ITEM
    ifs = {}
    for it in z.call('item.get', {'output': ['hostid', 'name'], 'hostids': ids, 'search': {'name': 'Interface'},
                                  'filter': {'status': 0}}):
        m = _ZBX_IF_ITEM.match(it.get('name', '').strip())
        if m and m.group(2) == 'Bits received':
            ifs.setdefault(it['hostid'], {}).setdefault(norm_if(m.group(1)), {'name': m.group(1)})
    macros = {}
    if probe and not snmp_community:
        try:
            for mc in z.call('usermacro.get', {'output': ['macro', 'value'], 'globalmacro': True}):
                macros.setdefault(mc['macro'], mc.get('value', ''))
        except Exception:  # noqa: BLE001 - 読めなくても装置の下書きは作る
            pass
    out, skipped = {}, 0
    for h in hosts:
        if h['hostid'] not in ifs:
            skipped += 1                                  # サーバー等(IF の流量アイテムが無い)
            continue
        snmp_if = next((i for i in h.get('interfaces', []) if str(i.get('type')) == '2' and str(i.get('main')) == '1'),
                       None) or next((i for i in h.get('interfaces', []) if str(i.get('type')) == '2'), None)
        main = snmp_if or next((i for i in h.get('interfaces', []) if str(i.get('main')) == '1'), None)
        ip = (main or {}).get('ip') or None
        d = {'hostname': h.get('name') or h['host'], 'zabbix_host': h['host'], 'type': zbx_type(h.get('parentTemplates')),
             'mgmt_ip': ip, 'ifs': ifs[h['hostid']]}
        if probe and snmp_if and ip:
            ver = str((snmp_if.get('details') or {}).get('version') or '2')
            hmac = {**macros}
            if not snmp_community and '{$' in str((snmp_if.get('details') or {}).get('community', '')):
                try:
                    for mc in z.call('usermacro.get', {'output': ['macro', 'value'], 'hostids': [h['hostid']]}):
                        hmac[mc['macro']] = mc.get('value', '')
                except Exception:  # noqa: BLE001
                    pass
            comm = snmp_community or _zbx_community(snmp_if, hmac)
            if ver == '3':
                notes.append(f"{d['hostname']}: SNMPv3 のため IF の IP は読みません(links は手で足す)")
            elif not comm:
                notes.append(f"{d['hostname']}: SNMP の community が分かりません(秘密のマクロ等)。--snmp-community で指定できます")
            else:
                try:
                    for name, (ifip, plen) in snmp_if_ips(ip, comm, walk=walk).items():
                        ent = d['ifs'].setdefault(norm_if(name), {'name': name})
                        ent['ip'], ent['prefix'] = ifip, plen
                except Exception as e:  # noqa: BLE001
                    notes.append(f"{d['hostname']}({ip}): SNMP で IF の IP を読めません({e})")
        out[h['host']] = d
    if skipped:
        notes.append(f'Zabbix: IF の流量アイテム(Interface …: Bits received)が無いホスト {skipped} 台は装置に入れていません')
    # 機器ではないが、ログ型のアイテムを持つホスト(syslog サーバー等)→ sources.zabbix.log_hosts の候補
    others = [h for h in hosts if h['hostid'] not in ifs]
    if others:
        try:
            lh = {it['hostid'] for it in z.call('item.get', {'output': ['hostid'], 'hostids': [h['hostid'] for h in others],
                                                             'filter': {'status': 0, 'value_type': [2]}})}
            log_hosts = sorted(h['host'] for h in others if h['hostid'] in lh)
        except Exception:  # noqa: BLE001
            log_hosts = []
        if log_hosts:
            meta['log_hosts'] = log_hosts
            notes.append('Zabbix: ログのアイテムがあるホスト ' + ', '.join(log_hosts) + ' を sources.zabbix.log_hosts に入れました'
                         '(行の中の IP・装置名で装置を決める)')
    return out


def detect(prometheus=None, loki=None, zabbix=None, mrtg_cfgs=None, cacti_dirs=None, ollama=None, env=None, get=None,
           cacti_db_configs=None, zabbix_group=None, snmp_community=None, snmp_probe=True, zbx_client=None, walk=None):
    get = get or http_json
    env = env if env is not None else os.environ
    found = {'prometheus': None, 'loki': None, 'zabbix': None, 'mrtg': [], 'cacti': [], 'ollama': None, 'ai': None,
             'devices': {}, 'notes': [], 'searched': {'mrtg': [], 'cacti': [], 'cacti_db': []}, 'cacti_db': None}
    searched = found['searched']

    def dev(key, hostname=None):
        d = found['devices'].setdefault(key, {'hostname': hostname or key, 'mgmt_ip': None, 'ifs': {}, 'from': set()})
        if hostname and d['hostname'] == key:
            d['hostname'] = hostname
        return d

    # Prometheus + snmp_exporter
    p_url = prometheus or 'http://127.0.0.1:9090'
    try:
        info = get(p_url.rstrip('/') + '/api/v1/status/buildinfo')
        ver = (info.get('data') or {}).get('version') if isinstance(info, dict) else None
        tg = get(p_url.rstrip('/') + '/api/v1/targets?state=active')
        jobs = sorted({t['labels'].get('job') for t in (tg.get('data') or {}).get('activeTargets', [])}) if isinstance(tg, dict) else []
        job = next((j for j in jobs if 'snmp' in (j or '').lower()), None)
        found['prometheus'] = {'url': p_url, 'version': ver, 'jobs': jobs, 'job': job}
        if job:
            for r in _prom(p_url, get, f'count by (instance, ifName, ifDescr, sysName) (ifHCInOctets{{job="{job}"}})'):
                m = r['metric']
                inst = m.get('instance', '')
                d = dev(inst.split(':')[0], m.get('sysName'))
                d['mgmt_ip'] = d['mgmt_ip'] or inst.split(':')[0]
                name = m.get('ifDescr') or m.get('ifName')
                if name:
                    d['ifs'].setdefault(norm_if(name), {'name': name})
                d['from'].add('prometheus')
        # gnmic の prometheus 出力(gNMI の OpenConfig のカウンタ)。装置は source ラベル
        gjobs = sorted({r['metric'].get('job') for r in _prom(
            p_url, get, 'count by (job) (interfaces_interface_state_counters_in_octets)') if r['metric'].get('job')})
        gjob = gjobs[0] if gjobs else None
        found['prometheus']['gnmic_job'] = gjob
        if gjob:
            for r in _prom(p_url, get, f'count by (source, interface_name) '
                                       f'(interfaces_interface_state_counters_in_octets{{job="{gjob}"}})'):
                m = r['metric']
                ip = (m.get('source') or '').split(':')[0]
                if not ip:
                    continue
                d = dev(ip)
                d['mgmt_ip'] = d['mgmt_ip'] or ip
                if m.get('interface_name'):
                    d['ifs'].setdefault(norm_if(m['interface_name']), {'name': m['interface_name']})
                d['from'].add('gnmic')
        if not job and not gjob:
            found['notes'].append('Prometheus に snmp を含む job も gnmic の値も見つかりません'
                                  '(snmp_exporter / gnmic の scrape を確認)')
    except Exception as e:  # noqa: BLE001
        if prometheus:
            found['notes'].append(f'Prometheus({p_url})に届きません: {e}')

    # Loki
    l_url = loki or 'http://127.0.0.1:3100'
    try:
        r = get(l_url.rstrip('/') + '/ready')
        if 'ready' in str(r).lower():
            found['loki'] = {'url': l_url}
    except Exception as e:  # noqa: BLE001
        if loki:
            found['notes'].append(f'Loki({l_url})に届きません: {e}')

    # Zabbix
    z_url = zabbix
    if not z_url and os.path.exists('/etc/zabbix/web/zabbix.conf.php'):
        z_url = 'http://127.0.0.1/zabbix/api_jsonrpc.php'
    if z_url:
        found['zabbix'] = {'url': z_url}
        if zbx_client is None and (env.get('ZABBIX_TOKEN') or env.get('ZABBIX_USER')):
            from .sources import Zabbix
            zbx_client = Zabbix(z_url, token=env.get('ZABBIX_TOKEN', ''), user=env.get('ZABBIX_USER', ''),
                                password=env.get('ZABBIX_PASSWORD', ''))
        if zbx_client is None:
            found['notes'].append('Zabbix: ZABBIX_TOKEN(または ZABBIX_USER / ZABBIX_PASSWORD)が無いので、'
                                  'ホストは読みません(装置は手で書く)')
        else:
            try:
                meta = {}
                inv = zabbix_inventory(zbx_client, group=zabbix_group, snmp_community=snmp_community,
                                       probe=snmp_probe, walk=walk, notes=found['notes'], meta=meta)
                found['zabbix']['hosts'] = len(inv)
                if meta.get('log_hosts'):
                    found['zabbix']['log_hosts'] = meta['log_hosts']
                for zd in inv.values():
                    d = dev(zd['mgmt_ip'] or zd['zabbix_host'], zd['hostname'])
                    d['mgmt_ip'] = d['mgmt_ip'] or zd['mgmt_ip']
                    d['type'], d['zabbix_host'] = zd['type'], zd['zabbix_host']
                    for k, i in zd['ifs'].items():
                        cur = d['ifs'].setdefault(k, {'name': i['name']})
                        if i.get('ip') and not cur.get('ip'):
                            cur['ip'], cur['prefix'] = i['ip'], i.get('prefix', 24)
                    d['from'].add('zabbix')
            except Exception as e:  # noqa: BLE001
                found['notes'].append(f'Zabbix({z_url})の API を読めません: {e}')

    # MRTG
    for pat in mrtg_cfgs if mrtg_cfgs is not None else MRTG_CFGS:
        hits = sorted(glob.glob(pat))
        searched['mrtg'].append({'pattern': pat, 'matches': hits})
        for path in hits:
            try:
                p = parse_mrtg_cfg(open(path, encoding='utf-8', errors='replace').read())
            except OSError as e:
                found['notes'].append(f'MRTG: {path} を読めません({e.strerror or e})')
                continue
            if not p['targets']:
                found['notes'].append(f'MRTG: {path} はありますが Target[...] が1つもありません(cfgmaker で作ると入ります)')
                continue
            found['mrtg'].append({'cfg': path, 'workdir': p['workdir'], 'targets': len(p['targets'])})
            for t in p['targets'].values():
                if not t.get('host'):
                    continue
                d = dev(t['host'])
                d['mgmt_ip'] = d['mgmt_ip'] or t['host']
                if t.get('descr'):
                    i = d['ifs'].setdefault(norm_if(t['descr']), {'name': t['descr']})
                    if t.get('ip') and re.fullmatch(r'[\d.]+', t['ip']):
                        i['ip'] = t['ip']
                m = re.search(r'--\s*(\S+)\s*$', t.get('title', ''))
                if m and d['hostname'] == t['host']:
                    d['hostname'] = m.group(1)
                d['from'].add('mrtg')

    # Cacti
    seen_real = set()
    for pat in cacti_dirs if cacti_dirs is not None else CACTI_DIRS:
        hits = sorted(glob.glob(pat))
        searched['cacti'].append({'pattern': pat, 'matches': hits})
        for path in hits:
            # Ubuntu の apt 版は /usr/share/cacti/site/rra → /var/lib/cacti/rra の symlink。同じ場所は 1 回だけ数える
            real = os.path.realpath(path)
            if real in seen_real:
                continue
            seen_real.add(real)
            # Cacti 1.x は <rra>/<host_id>/<local_data_id>.rrd(サブディレクトリ・数字だけの名前)なので、下も見る
            files = sorted(os.path.relpath(os.path.join(d, f), path) for d, _s, fs in os.walk(path) for f in fs if f.endswith('.rrd'))
            if files:
                found['cacti'].append({'rra_dir': path, 'files': files[:200], 'count': len(files)})

    # Cacti の DB 接続情報(どの RRD がどの装置・IF かは、ここを引けば自動で分かる)
    for p in cacti_db_configs if cacti_db_configs is not None else DB_CONFIG_CANDIDATES:
        ok = False
        if os.path.exists(p):
            try:
                c = read_db_config(p)
                found['cacti_db'] = {'config': p, 'host': c['host'], 'database': c['database'], 'user': c['user'],
                                     'client': bool(_mysql_client())}
                ok = True
            except (OSError, ValueError) as e:
                found['notes'].append(f'Cacti: {p} は DB 接続情報として読めません({e})')
        searched['cacti_db'].append({'pattern': p, 'matches': [p] if ok else []})
        if ok:
            break
    if found['cacti_db'] and not found['cacti_db']['client']:
        found['notes'].append('Cacti の DB を読むには mysql クライアントが要ります(mariadb-client か mysql-client を入れてください)')

    # AI
    try:
        o_url = ollama or 'http://127.0.0.1:11434'
        tags = get(o_url.rstrip('/') + '/api/tags')
        if isinstance(tags, dict):
            found['ollama'] = {'url': o_url, 'models': [m.get('name') for m in tags.get('models', [])][:10]}
    except Exception:  # noqa: BLE001
        pass
    if env.get('ANTHROPIC_API_KEY') or env.get('ANTHROPIC_AUTH_TOKEN'):
        found['ai'] = 'claude'
    elif env.get('GROQ_API_KEY') or env.get('OPENAI_API_KEY') or env.get('NIRVANA_AI_KEY'):
        found['ai'] = 'openai'
    elif found['ollama']:
        found['ai'] = 'ollama'
    return found


def infer_links(devices):
    """同じ /30・/31 の中に IP がある2台をつなぐ(推定)"""
    ends = []
    for did, d in devices.items():
        for i in d['interfaces']:
            if i.get('ip'):
                ends.append((did, i['name'], ipaddress.IPv4Address(i['ip']), i))
    links, used = [], set()
    for k, (a, ai, aip, aif) in enumerate(ends):
        for b, bi, bip, bif in ends[k + 1:]:
            if a == b or (a, ai) in used or (b, bi) in used:
                continue
            for plen in (30, 31):
                if ipaddress.ip_network(f'{aip}/{plen}', strict=False) == ipaddress.ip_network(f'{bip}/{plen}', strict=False):
                    links.append({'a': a, 'a_if': ai, 'b': b, 'b_if': bi})
                    used |= {(a, ai), (b, bi)}
                    aif['prefix'] = bif['prefix'] = plen     # 対向がある = 対向間のリンク(/30・/31)
                    break
    return links


def build_config(found, title='本番ネットワーク'):
    devices = {}
    for n, (key, d) in enumerate(sorted(found['devices'].items()), 1):
        did = re.sub(r'[^a-z0-9]+', '-', (d['hostname'] or key).lower()).strip('-') or f'dev{n}'
        while did in devices:
            did += f'-{n}'
        ifs = [{'name': i['name'], **({'ip': i['ip'], 'prefix': i.get('prefix', 24)} if i.get('ip') else {})}
               for i in d['ifs'].values()]
        devices[did] = {'id': did, 'hostname': d['hostname'], 'type': d.get('type', 'cisco'), 'mgmt_ip': d['mgmt_ip'],
                        'interfaces': ifs}
        if d.get('zabbix_host') and d['zabbix_host'] != d['hostname']:
            devices[did]['zabbix_host'] = d['zabbix_host']
    cfg = {'title': title, 'poll_interval': 10, 'link_speed_bps': 1_000_000_000,
           'devices': list(devices.values()), 'links': infer_links(devices), 'sources': {}}
    src = cfg['sources']
    p = found['prometheus'] or {}
    if p.get('job') or p.get('gnmic_job'):
        src['prometheus'] = {'url': p['url'], 'job': p.get('job') or 'snmp'}
        if p.get('gnmic_job'):
            src['prometheus']['flavor'] = 'both' if p.get('job') else 'gnmic'
            src['prometheus']['gnmic_job'] = p['gnmic_job']
    if found['loki']:
        src['loki'] = {'url': found['loki']['url'], 'query': '{job=~".+"}'}
    if found['zabbix']:
        src['zabbix'] = {'url': found['zabbix']['url'], 'token': '${ZABBIX_TOKEN}'}
        if found['zabbix'].get('log_hosts'):
            src['zabbix']['log_hosts'] = found['zabbix']['log_hosts']
    if found['mrtg']:
        src['mrtg'] = {'cfg': found['mrtg'][0]['cfg']}
    if found['cacti_db']:
        # RRD と装置・IF の対応は DB から自動で読む(rra_dir は Cacti 自身の設定 path_rra を使うので書かなくてよい。
        # RRD の置き場所が DB の path_rra と違うときだけ rra_dir を足す)。パスワードはファイルを読むので書かない
        src['cacti'] = {'db': {'config': found['cacti_db']['config']}}
        if found['cacti']:
            src['cacti']['rra_dir'] = found['cacti'][0]['rra_dir']
    elif found['cacti']:
        src['cacti'] = {'rra_dir': found['cacti'][0]['rra_dir'], 'targets': []}
    return cfg


def render_yaml(cfg, found):
    import yaml
    lines = ['# Cyber View の設定(インストーラーが作った下書き)。必ず見直してから使う',
             '# - type は装置の種類(cisco / catalyst / nexus / juniper / sir / yamaha …)に直す',
             '# - links は「同じ /30・/31 に IP がある2台」を推定したもの。足りないつながりは手で足す',
             '# - 秘密は ${ENV} のまま。起動時の環境変数で渡す']
    if found['cacti_db']:
        lines.append('# - Cacti: RRD と装置・IF の対応は Cacti の DB から自動で読む(読み取りだけ)。装置の IP かホスト名と、'
                     'インタフェース名(ifName / ifDescr / ifIP)が、この設定の devices と合うものが対応づく。合わないものは')
        lines.append('#   GET /api/health の notes に出る。DB を使わず手で書くなら sources.cacti.targets に '
                     '{file: <RRD>, device: <装置 id>, if: <インタフェース名>}')
    elif found['cacti']:
        c = found['cacti'][0]
        lines.append('# - Cacti: DB の接続情報が見つからないので、どの RRD がどのインタフェースかは sources.cacti.targets を手で書く。例:')
        for f in c['files'][:5]:
            lines.append(f'#     - {{file: {f}, device: <装置 id>, if: <インタフェース名>}}')
    if found['ai']:
        lines.append(f"# - AI ログ解析: {found['ai']} を使う(鍵は環境変数。NIRVANA_AI_PROVIDER で切り替え)")
    else:
        lines.append('# - AI ログ解析: 鍵が無いのでルールで解析する(ANTHROPIC_API_KEY 等を設定すると AI を使う)')
    for n in found['notes']:
        lines.append(f'# 注: {n}')
    return '\n'.join(lines) + '\n' + yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False, width=200)


def summary(found):
    out = []
    p = found['prometheus']
    out.append(f"Prometheus : {p['url'] + ' v' + str(p['version']) + ' job=' + str(p['job']) + (' gnmic=' + str(p['gnmic_job']) if p.get('gnmic_job') else '') if p else 'なし'}")
    out.append(f"Loki       : {found['loki']['url'] if found['loki'] else 'なし'}")
    z = found['zabbix']
    out.append(f"Zabbix     : {z['url'] + (' (ネットワーク機器 ' + str(z['hosts']) + ' 台)' if 'hosts' in z else '') if z else 'なし'}")
    out.append(f"MRTG       : {', '.join(m['cfg'] + ' (' + str(m['targets']) + ' 対象)' for m in found['mrtg']) or 'なし'}")
    out.append(f"Cacti      : {', '.join(c['rra_dir'] + ' (' + str(c.get('count', len(c['files']))) + ' RRD)' for c in found['cacti']) or 'なし'}")
    cd = found.get('cacti_db')
    out.append("Cacti DB   : " + (f"{cd['config']}({cd['user']}@{cd['host']}/{cd['database']}、mysql クライアント: {'あり' if cd['client'] else 'なし'})" if cd else 'なし'))
    # 探した場所(見つからなかったときに、どこを探したかが分かるように。--mrtg-cfg / --cacti-rra で足せる)
    for label, key in (('MRTG', 'mrtg'), ('Cacti', 'cacti'), ('Cacti DB', 'cacti_db')):
        for sr in found.get('searched', {}).get(key, []):
            out.append(f"  {label} 候補 {sr['pattern']}: " + (', '.join(sr['matches']) if sr['matches'] else '無い'))
    out.append(f"Ollama     : {found['ollama']['url'] if found['ollama'] else 'なし'}")
    out.append(f"AI         : {found['ai'] or 'なし(ルールで解析)'}")
    out.append(f"装置       : {len(found['devices'])} 台 " + ', '.join(f"{d['hostname']}({'/'.join(sorted(d['from']))})" for d in found['devices'].values()))
    out += [f'注: {n}' for n in found['notes']]
    return '\n'.join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Cyber View: 監視の仕組みを探して設定ファイルの下書きを作る')
    ap.add_argument('--write', metavar='PATH')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--title', default='本番ネットワーク')
    ap.add_argument('--prometheus')
    ap.add_argument('--loki')
    ap.add_argument('--zabbix')
    ap.add_argument('--mrtg-cfg', action='append')
    ap.add_argument('--cacti-rra', action='append')
    ap.add_argument('--cacti-db-config', action='append', help='Cacti の DB 接続情報(db.php / debian.php / include/config.php)')
    ap.add_argument('--ollama')
    ap.add_argument('--zabbix-group', help='Zabbix のホストグループ名(このグループのホストだけを装置にする)')
    ap.add_argument('--snmp-community', help='IF の IP を読む SNMP community(省略時は Zabbix のホスト設定・マクロから)')
    ap.add_argument('--no-snmp-probe', action='store_true', help='装置に SNMP で IF の IP を問い合わせない')
    a = ap.parse_args(argv)
    found = detect(a.prometheus, a.loki, a.zabbix, a.mrtg_cfg, a.cacti_rra, a.ollama, cacti_db_configs=a.cacti_db_config,
                   zabbix_group=a.zabbix_group, snmp_community=a.snmp_community, snmp_probe=not a.no_snmp_probe)
    print(summary(found))
    if not a.write:
        return 0
    if not found['devices']:
        print('装置が1台も見つかりませんでした。config.example.yaml を元に手で書いてください', file=sys.stderr)
        return 2
    if os.path.exists(a.write) and not a.force:
        print(f'{a.write} は既にあります(上書きするなら --force)', file=sys.stderr)
        return 3
    cfg = build_config(found, a.title)
    with open(a.write, 'w', encoding='utf-8') as f:
        f.write(render_yaml(cfg, found))
    from . import config as C
    C.load(a.write)                                  # 作ったファイルが読めることを確かめる
    print(f'書きました: {a.write}(装置 {len(cfg["devices"])} 台・つながり {len(cfg["links"])} 本・取り込み口 {", ".join(cfg["sources"]) or "なし"})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
