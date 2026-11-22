# 中継(VirtualServerProxy)だけを動かすプロセス。後ろは別プロセスの http.server
import sys, time
sys.path.insert(0, __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', '..'))
from engine.bigip_lb import VirtualServerProxy
members = [('127.0.50.1', 9600), ('127.0.50.2', 9600)]
p = VirtualServerProxy('127.0.50.10', 8080, lambda: members, lambda: 'round-robin')
p.start()
import os
if os.environ.get('BACKLOG'): p._sock.listen(int(os.environ['BACKLOG']))
print('ready', flush=True)
while True:
    time.sleep(3600)
