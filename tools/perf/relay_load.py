# 同時接続数 C で T 秒、毎回新しい接続で GET。複数プロセス×スレッドで負荷をかけ、
# その間の中継プロセスの CPU 使用率(%、100% = 1 コア)とコアごとの使用率を測る
import sys, time, threading, http.client, multiprocessing as mp, os
HOST, PORT = os.environ.get('TARGET', '127.0.50.10:8080').split(':'); PORT = int(PORT)
def worker(n, T, q):
    ok = ng = 0; lat = []
    stop = time.time() + T
    lock = threading.Lock()
    def run():
        nonlocal ok, ng
        while time.time() < stop:
            t0 = time.time()
            try:
                c = http.client.HTTPConnection(HOST, PORT, timeout=5)
                c.request('GET', '/'); c.getresponse().read(); c.close()
                with lock: ok += 1; lat.append(time.time() - t0)
            except Exception:
                with lock: ng += 1
    ts = [threading.Thread(target=run) for _ in range(n)]
    [t.start() for t in ts]; [t.join() for t in ts]
    q.put((ok, ng, lat))
def cpu_jiffies(pid):
    f = open(f'/proc/{pid}/stat').read().rsplit(')', 1)[1].split()
    return int(f[11]) + int(f[12])
def cores():
    out = {}
    for l in open('/proc/stat'):
        if l.startswith('cpu') and l[3].isdigit():
            v = list(map(int, l.split()[1:])); out[l.split()[0]] = (sum(v), v[3] + v[4])
    return out
if __name__ == '__main__':
    C, T, pid = int(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3])
    procs = 4 if C >= 40 else 2
    q = mp.Queue(); hz = os.sysconf('SC_CLK_TCK')
    j0, c0, t0 = cpu_jiffies(pid), cores(), time.time()
    ps = [mp.Process(target=worker, args=(C // procs, T, q)) for _ in range(procs)]
    [p.start() for p in ps]
    res = [q.get() for _ in ps]; [p.join() for p in ps]
    j1, c1, el = cpu_jiffies(pid), cores(), time.time() - t0
    ok = sum(r[0] for r in res); ng = sum(r[1] for r in res); lat = sorted(x for r in res for x in r[2])
    p95 = lat[int(len(lat) * .95)] if lat else 0
    busy = {k: round(100 * (1 - (c1[k][1] - c0[k][1]) / max(1, c1[k][0] - c0[k][0]))) for k in c0}
    print(f'C={C:3d} req/s={ok/el:6.0f} fail={100*ng/max(1,ok+ng):5.2f}% p95={p95*1000:6.0f}ms '
          f'proxyCPU={100*(j1-j0)/hz/el:5.0f}% cores={busy}')
