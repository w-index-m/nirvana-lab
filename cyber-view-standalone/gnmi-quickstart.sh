#!/usr/bin/env bash
# gNMI → gnmic → Prometheus(ヴァルハラ)を 1 本で立てる(Linux / WSL 用)
#
#   ./gnmi-quickstart.sh up --target 192.168.1.1 --ports Gi1/0/1,Gi1/0/2
#   ./gnmi-quickstart.sh status
#   ./gnmi-quickstart.sh down
#
# up がやること:
#   1. gnmic が無ければ入れる(公式の導入スクリプト。sudo のパスワードを聞かれることがある)
#   2. Prometheus が無ければ取ってくる(GitHub の配布物、$DIR の下に置く)
#   3. gnmic.yaml / prometheus.yml / ニルヴァーナの設定(nirvana.yaml)を $DIR に書く
#   4. gnmic と Prometheus を nohup で起動する(画面を閉じても止まらない)
#   5. 値が gnmic → Prometheus まで届いたかを確かめ、だめなら原因の目安を出す
#   --loki を付けると、Loki と Grafana も取ってきて起動する(データソースとダッシュボードは自動で登録)。
#   syslog はニルヴァーナが受け、その写しを Loki に送る(Grafana でログも見られる)
#
# 実機の IOS XE 16.x(WS-C3650 16.12.11)で分かった癖に合わせてある:
#   - ポート名(キー)の無い購読は断られる → ポートごとに [name=...] を付ける
#   - oper-status だけの購読は打ち切られる → /state をまとめて購読する
#   - 装置の時計がずれていると値が捨てられる → export-timestamps は付けない
#
# 設定は環境変数でも渡せる: GNMI_TARGET / GNMI_PORTS / GNMI_USER / GNMI_PASSWORD / GNMI_DIR
set -euo pipefail

PROM_VERSION=2.54.1
SNMPX_VERSION=0.28.0
LOKI_VERSION=3.1.1
GRAFANA_VERSION=11.3.0
DIR=${GNMI_DIR:-$HOME/nirvana-gnmi}
TARGET=${GNMI_TARGET:-}
PORTS=${GNMI_PORTS:-}
USER_NAME=${GNMI_USER:-}
PASSWORD=${GNMI_PASSWORD:-}
LOKI=${GNMI_LOKI:-}                       # 1 なら Loki と Grafana も動かす
SNMP_COMMUNITY=${GNMI_SNMP_COMMUNITY:-}   # 入れると snmp_exporter も動かし、ヴァルハラに SNMP(IF・CPU・OSPF)も貯める
INTERVAL=10
GNMI_PORT=50052
GNMIC_LISTEN=9804
PROM_LISTEN=9090
SNMPX_LISTEN=9116
LOKI_LISTEN=3100
LOKI_GRPC=9097
GRAFANA_LISTEN=3000
WAIT=90

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'
オプション(up / config):
  --target IP[,IP...]   装置の IP(複数はカンマ区切り。:ポート を付けなければ 50052)
  --ports  P[,P...]     監視するポート(Gi1/0/1 のような短い名前も可)
  --user NAME           gNMI のユーザー(省略時は聞く)
  --password PASS       パスワード(省略時は GNMI_PASSWORD か、聞く)
  --interval SEC        送ってもらう間隔(既定 10)
  --dir PATH            置き場所(既定 ~/nirvana-gnmi)
  --wait SEC            値が届くまで待つ秒数(既定 90)
  --snmp-community STR  SNMP の community(入れると snmp_exporter も動かし、IF の流量・CPU・OSPF をヴァルハラに貯める。
                        ニルヴァーナの再生・予測・CPU の推移が使えるようになる。GNMI_SNMP_COMMUNITY でも可)
  --loki                Loki(:3100)と Grafana(:3000)も動かす。Grafana には Prometheus と Loki の
                        データソースと「Nirvana gNMI」ダッシュボードを自動で入れる(GNMI_LOKI=1 でも可)
EOF
}

say()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m OK\033[0m %s\n' "$*"; }
ng()   { printf '\033[31m NG\033[0m %s\n' "$*"; }
hint() { printf '    %s\n' "$*"; }

# Gi1/0/1 → GigabitEthernet1/0/1 など(ニルヴァーナと gNMI はフル名で照合する)
expand_if() {
  local n=$1
  case "$n" in
    [Gg]i[0-9]*)  echo "GigabitEthernet${n:2}" ;;
    [Tt]e[0-9]*)  echo "TenGigabitEthernet${n:2}" ;;
    [Tt]w[0-9]*)  echo "TwoGigabitEthernet${n:2}" ;;
    [Ff]a[0-9]*)  echo "FastEthernet${n:2}" ;;
    [Ff]o[0-9]*)  echo "FortyGigabitEthernet${n:2}" ;;
    [Hh]u[0-9]*)  echo "HundredGigE${n:2}" ;;
    [Ee]th[0-9]*) echo "Ethernet${n:3}" ;;
    *) echo "$n" ;;
  esac
}

split_csv() { tr ',' '\n' <<<"$1" | sed 's/^ *//; s/ *$//' | sed '/^$/d'; }

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --target) TARGET=$2; shift 2 ;;
      --ports) PORTS=$2; shift 2 ;;
      --user) USER_NAME=$2; shift 2 ;;
      --password) PASSWORD=$2; shift 2 ;;
      --interval) INTERVAL=$2; shift 2 ;;
      --dir) DIR=$2; shift 2 ;;
      --wait) WAIT=$2; shift 2 ;;
      --snmp-community) SNMP_COMMUNITY=$2; shift 2 ;;
      --loki) LOKI=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "知らないオプション: $1" >&2; usage; exit 2 ;;
    esac
  done
}

ask_missing() {
  if [ -z "$TARGET" ]; then read -r -p '装置の IP (例 192.168.1.1): ' TARGET; fi
  if [ -z "$PORTS" ]; then read -r -p '監視するポート (例 Gi1/0/1,Gi1/0/2): ' PORTS; fi
  if [ -z "$USER_NAME" ]; then read -r -p 'gNMI のユーザー (例 admin): ' USER_NAME; fi
  if [ -z "$PASSWORD" ]; then read -r -s -p 'パスワード: ' PASSWORD; echo; fi
  [ -n "$TARGET" ] && [ -n "$PORTS" ] && [ -n "$USER_NAME" ] && [ -n "$PASSWORD" ] || {
    echo '装置の IP・ポート・ユーザー・パスワードが必要です' >&2; exit 2; }
}

# YAML の 1 行文字列(" と \ をエスケープ)
yq() { local s=${1//\\/\\\\}; s=${s//\"/\\\"}; printf '"%s"' "$s"; }

write_configs() {
  mkdir -p "$DIR"
  local t p host first_host
  # gnmic.yaml(パスワードを含むので本人だけ読める)
  umask 077
  {
    echo "# gnmi-quickstart.sh が作った設定($(date '+%F %T'))"
    echo "username: $(yq "$USER_NAME")"
    echo "password: $(yq "$PASSWORD")"
    echo "insecure: true"
    echo "encoding: json_ietf"
    echo "timeout: 10s"
    echo "targets:"
    for t in $(split_csv "$TARGET"); do
      case "$t" in *:*) ;; *) t="$t:$GNMI_PORT" ;; esac
      echo "  $t: {}"
    done
    echo "subscriptions:"
    echo "  if-state:"
    echo "    paths:"
    for p in $(split_csv "$PORTS"); do
      echo "      - \"/interfaces/interface[name=$(expand_if "$p")]/state\""
    done
    echo "    stream-mode: sample"
    echo "    sample-interval: ${INTERVAL}s"
    echo "outputs:"
    echo "  prom:"
    echo "    type: prometheus"
    echo "    listen: 0.0.0.0:$GNMIC_LISTEN"
    echo "    path: /metrics"
    echo "    expiration: $(( INTERVAL * 5 / 2 ))s"
    echo "    strings-as-labels: true"
  } > "$DIR/gnmic.yaml"
  if [ -n "$SNMP_COMMUNITY" ]; then
    # community は別ファイル(本人だけ読める)。モジュールは iac/cisco-traffic-monitoring と同じもの
    printf 'auths:\n  nirvana:\n    community: %s\n    version: 2\n' "$(yq "$SNMP_COMMUNITY")" > "$DIR/snmp-auth.yml"
  fi
  umask 022
  [ -z "$SNMP_COMMUNITY" ] || write_snmp_modules
  {
    cat <<EOF
global:
  scrape_interval: ${INTERVAL}s
scrape_configs:
  - job_name: gnmic
    static_configs:
      - targets: ['127.0.0.1:$GNMIC_LISTEN']
EOF
    if [ -n "$SNMP_COMMUNITY" ]; then
      cat <<EOF
  - job_name: snmp
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: /snmp
    params:
      module: [cisco_if]
      auth: [nirvana]
    static_configs:
      - targets: [$(for t in $(split_csv "$TARGET"); do printf "'%s'," "${t%%:*}"; done | sed 's/,$//')]
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: 127.0.0.1:$SNMPX_LISTEN
EOF
    fi
  } > "$DIR/prometheus.yml"
  # ニルヴァーナ単体版の設定(装置とポートだけ。つながり links は手で書く)
  {
    echo "title: gNMI"
    echo "poll_interval: $INTERVAL"
    echo "devices:"
    local n=0
    for t in $(split_csv "$TARGET"); do
      n=$((n + 1)); host=${t%%:*}; first_host=${first_host:-$host}
      echo "  - id: sw$n"
      echo "    hostname: SW$n"
      echo "    type: catalyst"
      echo "    mgmt_ip: $host"
      echo "    interfaces:"
      for p in $(split_csv "$PORTS"); do
        echo "      - {name: $(expand_if "$p")}"
      done
    done
    echo "links: []   # 例: - {a: sw1, a_if: GigabitEthernet1/0/1, b: sw2, b_if: GigabitEthernet1/0/1}"
    echo "sources:"
    echo "  prometheus:"
    echo "    url: http://127.0.0.1:$PROM_LISTEN"
    if [ -n "$SNMP_COMMUNITY" ]; then
      echo "    flavor: both          # 同じポートは snmp_exporter を優先し、無いところを gnmic で埋める"
      echo "    job: snmp"
    else
      echo "    flavor: gnmic"
    fi
    echo "    gnmic_job: gnmic"
  } > "$DIR/nirvana.yaml"
  [ -z "$LOKI" ] || write_loki_grafana
  ok "設定を書きました: $DIR/gnmic.yaml, prometheus.yml, nirvana.yaml${SNMP_COMMUNITY:+, snmp-auth.yml, snmp-modules.yml}${LOKI:+, loki.yml, grafana/}"
}

write_loki_grafana() {
  mkdir -p "$DIR/loki-data" "$DIR/grafana/provisioning/datasources" "$DIR/grafana/provisioning/dashboards" \
           "$DIR/grafana/dashboards" "$DIR/grafana/data" "$DIR/grafana/logs"
  cat > "$DIR/loki.yml" <<EOF
# 1 台構成の Loki(ファイルに保存、14 日で消す)
auth_enabled: false
server:
  http_listen_address: 0.0.0.0
  http_listen_port: $LOKI_LISTEN
  grpc_listen_port: $LOKI_GRPC
  log_level: warn
common:
  path_prefix: $DIR/loki-data
  storage:
    filesystem:
      chunks_directory: $DIR/loki-data/chunks
      rules_directory: $DIR/loki-data/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory
schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h
compactor:
  working_directory: $DIR/loki-data/compactor
  retention_enabled: true
  delete_request_store: filesystem
limits_config:
  retention_period: 336h
  reject_old_samples: false
  allow_structured_metadata: false
analytics:
  reporting_enabled: false
EOF
  cat > "$DIR/grafana/grafana.ini" <<EOF
# gnmi-quickstart.sh が作った Grafana の設定。ログインせずに見られる(閲覧だけ)。編集は admin / admin でログイン
[server]
http_addr = 0.0.0.0
http_port = $GRAFANA_LISTEN
[paths]
data = $DIR/grafana/data
logs = $DIR/grafana/logs
provisioning = $DIR/grafana/provisioning
[auth.anonymous]
enabled = true
org_role = Viewer
[analytics]
reporting_enabled = false
check_for_updates = false
check_for_plugin_updates = false
[news]
news_feed_enabled = false
[dashboards]
default_home_dashboard_path = $DIR/grafana/dashboards/nirvana-gnmi.json
EOF
  cat > "$DIR/grafana/provisioning/datasources/nirvana.yml" <<EOF
apiVersion: 1
datasources:
  - name: ヴァルハラ (Prometheus)
    uid: nirvana-prom
    type: prometheus
    access: proxy
    url: http://127.0.0.1:$PROM_LISTEN
    isDefault: true
    jsonData:
      timeInterval: ${INTERVAL}s
  - name: Loki
    uid: nirvana-loki
    type: loki
    access: proxy
    url: http://127.0.0.1:$LOKI_LISTEN
EOF
  cat > "$DIR/grafana/provisioning/dashboards/nirvana.yml" <<EOF
apiVersion: 1
providers:
  - name: nirvana
    folder: Nirvana
    type: file
    disableDeletion: true
    allowUiUpdates: true
    options:
      path: $DIR/grafana/dashboards
EOF
  write_dashboard > "$DIR/grafana/dashboards/nirvana-gnmi.json"
}

# Grafana のダッシュボード(gNMI の流量・ポート状態、SNMP の到達性・CPU・流量、Loki の syslog)
write_dashboard() {
  cat <<'DASHBOARD'
{
  "uid": "nirvana-gnmi",
  "title": "Nirvana gNMI",
  "tags": ["nirvana", "gnmi"],
  "timezone": "browser",
  "refresh": "10s",
  "time": {"from": "now-1h", "to": "now"},
  "schemaVersion": 39,
  "panels": [
    {"id": 1, "type": "timeseries", "title": "gNMI 受信 (bps)", "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
     "datasource": {"type": "prometheus", "uid": "nirvana-prom"},
     "fieldConfig": {"defaults": {"unit": "bps"}, "overrides": []},
     "targets": [{"refId": "A", "legendFormat": "{{source}} {{interface_name}}",
       "expr": "rate((max by (source, interface_name) (interfaces_interface_state_counters_in_octets))[2m:15s]) * 8"}]},
    {"id": 2, "type": "timeseries", "title": "gNMI 送信 (bps)", "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
     "datasource": {"type": "prometheus", "uid": "nirvana-prom"},
     "fieldConfig": {"defaults": {"unit": "bps"}, "overrides": []},
     "targets": [{"refId": "A", "legendFormat": "{{source}} {{interface_name}}",
       "expr": "rate((max by (source, interface_name) (interfaces_interface_state_counters_out_octets))[2m:15s]) * 8"}]},
    {"id": 3, "type": "table", "title": "gNMI ポートの状態", "gridPos": {"x": 0, "y": 8, "w": 12, "h": 7},
     "datasource": {"type": "prometheus", "uid": "nirvana-prom"},
     "targets": [{"refId": "A", "instant": true, "format": "table",
       "expr": "topk by (source, interface_name) (1, timestamp(interfaces_interface_state_oper_status) and (interfaces_interface_state_oper_status == 1))"}],
     "transformations": [{"id": "filterFieldsByName", "options": {"include": {"names": ["source", "interface_name", "oper_status"]}}},
       {"id": "organize", "options": {"indexByName": {"source": 0, "interface_name": 1, "oper_status": 2},
        "renameByName": {"source": "装置", "interface_name": "ポート", "oper_status": "状態"}}}]},
    {"id": 4, "type": "stat", "title": "SNMP 到達性", "gridPos": {"x": 12, "y": 8, "w": 6, "h": 7},
     "datasource": {"type": "prometheus", "uid": "nirvana-prom"},
     "fieldConfig": {"defaults": {"mappings": [{"type": "value", "options": {"0": {"text": "応答なし", "color": "red"}, "1": {"text": "OK", "color": "green"}}}],
       "noValue": "SNMP 未設定"}, "overrides": []},
     "targets": [{"refId": "A", "legendFormat": "{{instance}}", "expr": "up{job=\"snmp\"}"}]},
    {"id": 5, "type": "gauge", "title": "CPU (5分平均, SNMP)", "gridPos": {"x": 18, "y": 8, "w": 6, "h": 7},
     "datasource": {"type": "prometheus", "uid": "nirvana-prom"},
     "fieldConfig": {"defaults": {"unit": "percent", "min": 0, "max": 100, "noValue": "SNMP 未設定",
       "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": null}, {"color": "orange", "value": 70}, {"color": "red", "value": 90}]}}, "overrides": []},
     "targets": [{"refId": "A", "legendFormat": "{{instance}}", "expr": "max by (instance) (cpmCPUTotal5minRev{job=\"snmp\"})"}]},
    {"id": 6, "type": "timeseries", "title": "SNMP 受信 / 送信 (bps, up のポート, 送信は下向き)", "gridPos": {"x": 0, "y": 15, "w": 24, "h": 8},
     "datasource": {"type": "prometheus", "uid": "nirvana-prom"},
     "fieldConfig": {"defaults": {"unit": "bps", "noValue": "SNMP 未設定"}, "overrides": []},
     "targets": [
       {"refId": "A", "legendFormat": "{{instance}} {{ifName}} 受信", "expr": "rate(ifHCInOctets{job=\"snmp\"}[$__rate_interval]) * 8 and on (instance, ifIndex) (ifOperStatus{job=\"snmp\"} == 1)"},
       {"refId": "B", "legendFormat": "{{instance}} {{ifName}} 送信", "expr": "-rate(ifHCOutOctets{job=\"snmp\"}[$__rate_interval]) * 8 and on (instance, ifIndex) (ifOperStatus{job=\"snmp\"} == 1)"}]},
    {"id": 7, "type": "timeseries", "title": "syslog の件数 (重要度別, 1分ごと)", "gridPos": {"x": 0, "y": 23, "w": 8, "h": 9},
     "datasource": {"type": "loki", "uid": "nirvana-loki"},
     "fieldConfig": {"defaults": {"custom": {"drawStyle": "bars", "stacking": {"mode": "normal"}}}, "overrides": []},
     "targets": [{"refId": "A", "legendFormat": "{{severity}}", "expr": "sum by (severity) (count_over_time({job=\"syslog\"}[1m]))"}]},
    {"id": 8, "type": "logs", "title": "syslog (ニルヴァーナが受けた行)", "gridPos": {"x": 8, "y": 23, "w": 16, "h": 9},
     "datasource": {"type": "loki", "uid": "nirvana-loki"},
     "options": {"showTime": true, "wrapLogMessage": true, "sortOrder": "Descending", "enableLogDetails": true},
     "targets": [{"refId": "A", "expr": "{job=\"syslog\"}"}]}
  ]
}
DASHBOARD
}

write_snmp_modules() {
  cat > "$DIR/snmp-modules.yml" <<'SNMPMOD'
# snmp_exporter のモジュール(iac/cisco-traffic-monitoring/snmp_exporter/snmp.yml と同じ。IF・CPU・ICMP・OSPF)
modules:
  cisco_if:
    walk:
      - 1.3.6.1.2.1.2.2.1.7          # ifAdminStatus
      - 1.3.6.1.2.1.2.2.1.8          # ifOperStatus
      - 1.3.6.1.2.1.31.1.1.1.1       # ifName   (lookup用)
      - 1.3.6.1.2.1.31.1.1.1.6       # ifHCInOctets
      - 1.3.6.1.2.1.31.1.1.1.7       # ifHCInUcastPkts
      - 1.3.6.1.2.1.31.1.1.1.10      # ifHCOutOctets
      - 1.3.6.1.2.1.31.1.1.1.11      # ifHCOutUcastPkts
      - 1.3.6.1.2.1.31.1.1.1.15      # ifHighSpeed
      - 1.3.6.1.2.1.31.1.1.1.18      # ifAlias  (lookup用)
      - 1.3.6.1.4.1.9.9.109.1.1.1.1.8  # cpmCPUTotal5minRev
      - 1.3.6.1.2.1.14.10.1.3        # ospfNbrRtrId  (lookup用)
      - 1.3.6.1.2.1.14.10.1.6        # ospfNbrState  (OSPF-MIB: 1=down … 8=full)
    get:
      - 1.3.6.1.2.1.1.3.0            # sysUpTime
      - 1.3.6.1.2.1.14.1.1.0         # ospfRouterId
      - 1.3.6.1.2.1.5.7.0            # icmpInRedirects
      - 1.3.6.1.2.1.5.20.0           # icmpOutRedirects
    metrics:
      - name: sysUpTime
        oid: 1.3.6.1.2.1.1.3
        type: gauge
        help: The time (in hundredths of a second) since the network management portion of the system was last re-initialized.
      - name: icmpInRedirects
        oid: 1.3.6.1.2.1.5.7
        type: counter
        help: The number of ICMP Redirect messages received (RFC 1213).
      - name: icmpOutRedirects
        oid: 1.3.6.1.2.1.5.20
        type: counter
        help: The number of ICMP Redirect messages sent (RFC 1213). 増えたらそのルータが Redirect を出している
      - name: cpmCPUTotal5minRev
        oid: 1.3.6.1.4.1.9.9.109.1.1.1.1.8
        type: gauge
        help: The overall CPU busy percentage in the last 5 minute period
        indexes:
          - {labelname: cpmCPUTotalIndex, type: gauge}
      - name: ifAdminStatus
        oid: 1.3.6.1.2.1.2.2.1.7
        type: gauge
        help: The desired state of the interface (1=up,2=down,3=testing)
        indexes:
          - {labelname: ifIndex, type: gauge}
        lookups:
          - labels: [ifIndex]
            labelname: ifName
            oid: 1.3.6.1.2.1.31.1.1.1.1
            type: DisplayString
          - labels: [ifIndex]
            labelname: ifAlias
            oid: 1.3.6.1.2.1.31.1.1.1.18
            type: DisplayString
      - name: ifOperStatus
        oid: 1.3.6.1.2.1.2.2.1.8
        type: gauge
        help: The current operational state of the interface (1=up,2=down)
        indexes:
          - {labelname: ifIndex, type: gauge}
        lookups:
          - labels: [ifIndex]
            labelname: ifName
            oid: 1.3.6.1.2.1.31.1.1.1.1
            type: DisplayString
          - labels: [ifIndex]
            labelname: ifAlias
            oid: 1.3.6.1.2.1.31.1.1.1.18
            type: DisplayString
      - name: ifHCInOctets
        oid: 1.3.6.1.2.1.31.1.1.1.6
        type: counter
        help: The total number of octets received on the interface (64-bit)
        indexes:
          - {labelname: ifIndex, type: gauge}
        lookups:
          - labels: [ifIndex]
            labelname: ifName
            oid: 1.3.6.1.2.1.31.1.1.1.1
            type: DisplayString
          - labels: [ifIndex]
            labelname: ifAlias
            oid: 1.3.6.1.2.1.31.1.1.1.18
            type: DisplayString
      - name: ifHCInUcastPkts
        oid: 1.3.6.1.2.1.31.1.1.1.7
        type: counter
        help: The number of unicast packets received (64-bit)
        indexes:
          - {labelname: ifIndex, type: gauge}
        lookups:
          - labels: [ifIndex]
            labelname: ifName
            oid: 1.3.6.1.2.1.31.1.1.1.1
            type: DisplayString
          - labels: [ifIndex]
            labelname: ifAlias
            oid: 1.3.6.1.2.1.31.1.1.1.18
            type: DisplayString
      - name: ifHCOutOctets
        oid: 1.3.6.1.2.1.31.1.1.1.10
        type: counter
        help: The total number of octets transmitted out of the interface (64-bit)
        indexes:
          - {labelname: ifIndex, type: gauge}
        lookups:
          - labels: [ifIndex]
            labelname: ifName
            oid: 1.3.6.1.2.1.31.1.1.1.1
            type: DisplayString
          - labels: [ifIndex]
            labelname: ifAlias
            oid: 1.3.6.1.2.1.31.1.1.1.18
            type: DisplayString
      - name: ifHCOutUcastPkts
        oid: 1.3.6.1.2.1.31.1.1.1.11
        type: counter
        help: The number of unicast packets transmitted (64-bit)
        indexes:
          - {labelname: ifIndex, type: gauge}
        lookups:
          - labels: [ifIndex]
            labelname: ifName
            oid: 1.3.6.1.2.1.31.1.1.1.1
            type: DisplayString
          - labels: [ifIndex]
            labelname: ifAlias
            oid: 1.3.6.1.2.1.31.1.1.1.18
            type: DisplayString
      - name: ifHighSpeed
        oid: 1.3.6.1.2.1.31.1.1.1.15
        type: gauge
        help: An estimate of the interface current bandwidth in Mbps
        indexes:
          - {labelname: ifIndex, type: gauge}
        lookups:
          - labels: [ifIndex]
            labelname: ifName
            oid: 1.3.6.1.2.1.31.1.1.1.1
            type: DisplayString
          - labels: [ifIndex]
            labelname: ifAlias
            oid: 1.3.6.1.2.1.31.1.1.1.18
            type: DisplayString
      # ── OSPF-MIB(RFC 1850)。Cyber View の OSPF モードを実機監視でも出すために使う ──
      - name: ospfRouterId
        oid: 1.3.6.1.2.1.14.1.1
        type: InetAddressIPv4
        help: The Router ID of this OSPF router (value is 1, the ID is in the label)
      - name: ospfNbrState
        oid: 1.3.6.1.2.1.14.10.1.6
        type: gauge
        help: OSPF neighbor state (1=down 2=attempt 3=init 4=twoWay 5=exchangeStart 6=exchange 7=loading 8=full)
        indexes:
          - {labelname: ospfNbrIpAddr, type: InetAddressIPv4}
          - {labelname: ospfNbrAddressLessIndex, type: gauge}
        lookups:
          - labels: [ospfNbrIpAddr, ospfNbrAddressLessIndex]
            labelname: ospfNbrRtrId
            oid: 1.3.6.1.2.1.14.10.1.3
            type: InetAddressIPv4
SNMPMOD
}

install_tools() {
  if command -v gnmic >/dev/null 2>&1; then
    ok "gnmic: $(command -v gnmic)"
  else
    say 'gnmic を入れます(公式の導入スクリプト。sudo のパスワードを聞かれることがあります)'
    bash -c "$(curl -sL https://get-gnmic.openconfig.net)"
    command -v gnmic >/dev/null 2>&1 || { ng 'gnmic を入れられませんでした'; exit 1; }
  fi
  PROM_BIN="$DIR/prometheus-$PROM_VERSION.linux-amd64/prometheus"
  if [ -x "$PROM_BIN" ]; then
    ok "Prometheus: $PROM_BIN"
  else
    say "Prometheus $PROM_VERSION を取ってきます"
    mkdir -p "$DIR"
    curl -sL -o "$DIR/prom.tgz" \
      "https://github.com/prometheus/prometheus/releases/download/v$PROM_VERSION/prometheus-$PROM_VERSION.linux-amd64.tar.gz"
    tar xzf "$DIR/prom.tgz" -C "$DIR" && rm -f "$DIR/prom.tgz"
    [ -x "$PROM_BIN" ] || { ng 'Prometheus を取ってこられませんでした'; exit 1; }
    ok "Prometheus: $PROM_BIN"
  fi
  [ -z "$LOKI" ] || install_loki_grafana
  [ -n "$SNMP_COMMUNITY" ] || return 0
  SNMPX_BIN="$DIR/snmp_exporter-$SNMPX_VERSION.linux-amd64/snmp_exporter"
  if [ -x "$SNMPX_BIN" ]; then
    ok "snmp_exporter: $SNMPX_BIN"
  else
    say "snmp_exporter $SNMPX_VERSION を取ってきます"
    mkdir -p "$DIR"
    curl -sL -o "$DIR/snmpx.tgz" \
      "https://github.com/prometheus/snmp_exporter/releases/download/v$SNMPX_VERSION/snmp_exporter-$SNMPX_VERSION.linux-amd64.tar.gz"
    tar xzf "$DIR/snmpx.tgz" -C "$DIR" && rm -f "$DIR/snmpx.tgz"
    [ -x "$SNMPX_BIN" ] || { ng 'snmp_exporter を取ってこられませんでした'; exit 1; }
    ok "snmp_exporter: $SNMPX_BIN"
  fi
}

install_loki_grafana() {
  LOKI_BIN="$DIR/loki-$LOKI_VERSION/loki-linux-amd64"
  if [ -x "$LOKI_BIN" ]; then
    ok "Loki: $LOKI_BIN"
  else
    say "Loki $LOKI_VERSION を取ってきます"
    mkdir -p "$DIR/loki-$LOKI_VERSION"
    curl -sL -o "$DIR/loki.zip" "https://github.com/grafana/loki/releases/download/v$LOKI_VERSION/loki-linux-amd64.zip"
    # unzip が無い Ubuntu もあるので python3 で展開する
    python3 -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$DIR/loki.zip" "$DIR/loki-$LOKI_VERSION" \
      && rm -f "$DIR/loki.zip" && chmod +x "$LOKI_BIN" || true
    [ -x "$LOKI_BIN" ] || { ng 'Loki を取ってこられませんでした'; exit 1; }
    ok "Loki: $LOKI_BIN"
  fi
  GRAFANA_HOME="$DIR/grafana-v$GRAFANA_VERSION"
  if [ -x "$GRAFANA_HOME/bin/grafana" ]; then
    ok "Grafana: $GRAFANA_HOME"
  else
    say "Grafana $GRAFANA_VERSION を取ってきます(約 120 MB)"
    curl -sL -o "$DIR/grafana.tgz" "https://dl.grafana.com/oss/release/grafana-$GRAFANA_VERSION.linux-amd64.tar.gz"
    tar xzf "$DIR/grafana.tgz" -C "$DIR" && rm -f "$DIR/grafana.tgz" || true
    [ -x "$GRAFANA_HOME/bin/grafana" ] || { ng 'Grafana を取ってこられませんでした(dl.grafana.com に届くか確かめてください)'; exit 1; }
    ok "Grafana: $GRAFANA_HOME"
  fi
}

pid_alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

stop_all() {
  local f pid i
  for f in gnmic prometheus snmp_exporter loki grafana; do
    if pid_alive "$DIR/$f.pid"; then
      pid=$(cat "$DIR/$f.pid")
      kill "$pid" 2>/dev/null || true
      # Loki・Prometheus は後始末に数秒かかる。終わる前に起動し直すとポートが空いていない
      for ((i = 0; i < 40; i++)); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
      ok "$f を止めました"
    fi
    rm -f "$DIR/$f.pid"
  done
}

# 2 秒で打ち切る(WSL のミラーモードでは、空いているポートへの接続が返ってこないことがある)
port_busy() { timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$1" 2>/dev/null; }

start_all() {
  local p
  for p in $GNMIC_LISTEN $PROM_LISTEN ${SNMP_COMMUNITY:+$SNMPX_LISTEN} ${LOKI:+$LOKI_LISTEN $GRAFANA_LISTEN}; do
    if port_busy "$p"; then
      ng "ポート $p はすでに使われています(前に手で起動した gnmic / Prometheus / snmp_exporter / Loki / Grafana?)"
      hint "止めてからやり直してください: pkill gnmic; pkill prometheus; pkill snmp_exporter; pkill loki; pkill grafana"
      exit 1
    fi
  done
  # cd と起動を && でつなぐと、その 2 つがまとめて裏に回り、pid が gnmic ではなく途中の shell になる
  # (down で止まらず、呼び出し元の画面も戻らない)。cd を先に済ませ、起動だけを裏に回す
  cd "$DIR"
  nohup gnmic --config "$DIR/gnmic.yaml" --log subscribe < /dev/null > "$DIR/gnmic.log" 2>&1 &
  echo $! > "$DIR/gnmic.pid"
  nohup "$PROM_BIN" --config.file="$DIR/prometheus.yml" \
      --web.listen-address="0.0.0.0:$PROM_LISTEN" --storage.tsdb.path="$DIR/prom-data" \
      < /dev/null > "$DIR/prometheus.log" 2>&1 &
  echo $! > "$DIR/prometheus.pid"
  if [ -n "$SNMP_COMMUNITY" ]; then
    nohup "$SNMPX_BIN" --config.file="$DIR/snmp-modules.yml" --config.file="$DIR/snmp-auth.yml" \
        --web.listen-address="127.0.0.1:$SNMPX_LISTEN" < /dev/null > "$DIR/snmp_exporter.log" 2>&1 &
    echo $! > "$DIR/snmp_exporter.pid"
  fi
  if [ -n "$LOKI" ]; then
    nohup "$LOKI_BIN" -config.file="$DIR/loki.yml" < /dev/null > "$DIR/loki.log" 2>&1 &
    echo $! > "$DIR/loki.pid"
    nohup "$GRAFANA_HOME/bin/grafana" server --homepath "$GRAFANA_HOME" --config "$DIR/grafana/grafana.ini" \
        < /dev/null > "$DIR/grafana.log" 2>&1 &
    echo $! > "$DIR/grafana.pid"
  fi
  cd - > /dev/null
  ok "gnmic(:$GNMIC_LISTEN)と Prometheus(:$PROM_LISTEN)${SNMP_COMMUNITY:+と snmp_exporter(:$SNMPX_LISTEN)}${LOKI:+と Loki(:$LOKI_LISTEN)・Grafana(:$GRAFANA_LISTEN)}を起動しました"
}

# gnmic のログから、よくある失敗の原因を出す
diagnose() {
  local log="$DIR/gnmic.log"
  [ -f "$log" ] || return 0
  if grep -q 'no route to host\|connection refused\|i/o timeout\|context deadline exceeded' "$log"; then
    hint '装置に届いていません。PC から ping が通るか、装置の IP・ケーブル・装置側の gNMI(gnmi-yang server / gnxi server)を確かめてください'
  fi
  if grep -q 'missing keys' "$log"; then
    hint 'ポート名の無い購読を断られています(このスクリプトの設定ではポート名を付けています。--ports を確かめてください)'
  fi
  if grep -q 'Unauthenticated\|authentication failed\|PermissionDenied' "$log"; then
    hint 'ユーザー・パスワードか権限が違います(装置側: aaa new-model / aaa authorization exec default local / privilege 15)'
  fi
  if grep -q 'Canceled by operator' "$log"; then
    hint '装置が購読を打ち切っています(装置のログ %MDT_SUBSCRIPTION-4-TERMINATED を確かめてください)'
  fi
  if grep -q 'code = NotFound' "$log"; then
    hint 'ポート名が装置に無い可能性があります(show interfaces status の名前と比べてください)'
  fi
  hint "gnmic のログ: tail -n 20 $DIR/gnmic.log"
}

prom_query() {
  curl -s -m 5 --data-urlencode "query=$1" "http://127.0.0.1:$PROM_LISTEN/api/v1/query" 2>/dev/null
}

check() {
  local i n_gnmic=0 n_prom=0 up=''
  say "値が届くのを待ちます(最大 ${WAIT} 秒)"
  for ((i = 0; i < WAIT; i += 5)); do
    n_gnmic=$(curl -s -m 5 "http://127.0.0.1:$GNMIC_LISTEN/metrics" 2>/dev/null | grep -c '^interfaces_interface_state_counters_in_octets{' || true)
    up=$(prom_query 'up{job="gnmic"}' | grep -o '"value":\[[^]]*,"[01]"' | grep -o '"[01]"$' | tr -d '"' || true)
    n_prom=$(prom_query 'interfaces_interface_state_counters_in_octets' | grep -o '"interface_name"' | wc -l || true)
    [ "${n_prom:-0}" -gt 0 ] && break
    sleep 5
  done
  if [ "${n_gnmic:-0}" -gt 0 ]; then ok "gnmic が装置から受け取ったポート: $n_gnmic"; else ng 'gnmic が装置から値を受け取れていません'; diagnose; fi
  if [ "$up" = 1 ]; then ok 'Prometheus が gnmic から取れています(up=1)'; else ng "Prometheus が gnmic を取れていません(up=${up:-なし})"; hint "Prometheus のログ: tail -n 20 $DIR/prometheus.log"; fi
  [ -z "$SNMP_COMMUNITY" ] || check_snmp
  [ -z "$LOKI" ] || check_loki_grafana
  if [ "${n_prom:-0}" -gt 0 ]; then
    ok "Prometheus に入ったポート: $n_prom"
    prom_query 'interfaces_interface_state_counters_in_octets' \
      | grep -o '"interface_name":"[^"]*"\|"oper_status":"[^"]*"\|"source":"[^"]*"' | paste - - - | sed 's/"//g; s/^/    /'
    return 0
  fi
  return 1
}

# SNMP(snmp_exporter → ヴァルハラ)。届かなくても gNMI の表示は続けるので失敗扱いにはしない
check_snmp() {
  local i sup='' n=0 cpu=''
  for ((i = 0; i < 30; i += 5)); do
    sup=$(prom_query 'min(up{job="snmp"})' | grep -o '"value":\[[^]]*,"[01]"' | grep -o '"[01]"$' | tr -d '"' || true)
    n=$(prom_query 'count(ifHCInOctets{job="snmp"})' | grep -o '"value":\[[^]]*,"[0-9]*"' | grep -o '"[0-9]*"$' | tr -d '"' || true)
    [ "$sup" = 1 ] && [ "${n:-0}" -gt 0 ] && break
    sleep 5
  done
  if [ "$sup" = 1 ] && [ "${n:-0}" -gt 0 ]; then
    cpu=$(prom_query 'max(cpmCPUTotal5minRev{job="snmp"})' | grep -o '"value":\[[^]]*,"[0-9.]*"' | grep -o '"[0-9.]*"$' | tr -d '"' || true)
    ok "ヴァルハラが SNMP も取れています(IF $n 本${cpu:+・CPU ${cpu}%})"
  else
    ng "ヴァルハラが SNMP を取れていません(up=${sup:-なし})。gNMI の表示はこのまま続けます"
    hint 'community の綴り・装置の snmp-server community・ACL(この PC の IP を許可しているか)を確かめてください'
    hint "snmp_exporter のログ: tail -n 20 $DIR/snmp_exporter.log"
  fi
}

# Loki と Grafana。だめでも gNMI の表示は続けるので失敗扱いにはしない
check_loki_grafana() {
  local i lr='' gr=''
  for ((i = 0; i < 60; i += 3)); do
    lr=$(curl -s -m 3 "http://127.0.0.1:$LOKI_LISTEN/ready" 2>/dev/null || true)
    gr=$(curl -s -m 3 "http://127.0.0.1:$GRAFANA_LISTEN/api/health" 2>/dev/null | grep -o '"database": *"ok"' || true)
    [ "$lr" = ready ] && [ -n "$gr" ] && break
    sleep 3
  done
  if [ "$lr" = ready ]; then ok "Loki が動いています(:$LOKI_LISTEN)"; else
    ng "Loki がまだ準備できていません(${lr:-応答なし})"; hint "Loki のログ: tail -n 20 $DIR/loki.log"; fi
  if [ -n "$gr" ]; then
    ok "Grafana が動いています: http://localhost:$GRAFANA_LISTEN/d/nirvana-gnmi(編集は admin / admin でログイン)"
    if curl -s -m 5 "http://127.0.0.1:$GRAFANA_LISTEN/api/search?query=Nirvana" 2>/dev/null | grep -q nirvana-gnmi; then
      ok 'Grafana にダッシュボード「Nirvana gNMI」が入りました'
    else
      ng 'Grafana にダッシュボードが入っていません'; hint "Grafana のログ: tail -n 20 $DIR/grafana.log"
    fi
  else
    ng 'Grafana がまだ準備できていません'; hint "Grafana のログ: tail -n 20 $DIR/grafana.log"
  fi
}

status() {
  local f
  [ ! -f "$DIR/snmp-auth.yml" ] || SNMP_COMMUNITY=on   # up で SNMP を入れていれば、その確認もする
  [ ! -f "$DIR/loki.pid" ] || LOKI=1
  for f in gnmic prometheus snmp_exporter loki grafana; do
    [ "$f" != snmp_exporter ] || [ -f "$DIR/snmp-auth.yml" ] || continue
    case "$f" in loki|grafana) [ -n "$LOKI" ] || continue ;; esac
    if pid_alive "$DIR/$f.pid"; then ok "$f: 動いています(pid $(cat "$DIR/$f.pid"))"; else ng "$f: 止まっています"; fi
  done
  WAIT=5 check || true
}

next_steps() {
  cat <<EOF

ここまでできました。続きは次のとおりです。
  Prometheus の画面:   http://localhost:$PROM_LISTEN/targets
  流量を見る(Graph):   rate(interfaces_interface_state_counters_in_octets[1m]) * 8
  ニルヴァーナの設定:   $DIR/nirvana.yaml(つながり links は手で足す)
${LOKI:+  Grafana:             http://localhost:$GRAFANA_LISTEN/d/nirvana-gnmi(編集は admin / admin)
  syslog を Loki へ:   nirvana.yaml の sources.syslog に loki_push: http://127.0.0.1:$LOKI_LISTEN
}
ニルヴァーナの起動(どちらか):
  WSL:         cd <nirvana-lab>/cyber-view-standalone && python3 server.py -c $DIR/nirvana.yaml --port 8091
  PowerShell:  cd <nirvana-lab>\\cyber-view-standalone; python server.py -c \\\\wsl\$\\<ディストリ名>$DIR/nirvana.yaml --port 8091
  画面:        http://localhost:8091/?view=links

止める:        $0 down
様子を見る:    $0 status
EOF
}

cmd=${1:-}
[ $# -gt 0 ] && shift
case "$cmd" in
  up)
    parse_args "$@"; ask_missing
    install_tools; stop_all; write_configs; start_all
    # 設定画面(setup_gui.py)から呼ぶときは、手で打つ続きの案内は出さない
    if check; then [ -n "${GNMI_FROM_GUI:-}" ] || next_steps; else exit 1; fi ;;
  config)
    parse_args "$@"; ask_missing; write_configs ;;
  status)
    parse_args "$@"; status ;;
  down)
    parse_args "$@"; stop_all ;;
  *)
    usage; exit 2 ;;
esac
