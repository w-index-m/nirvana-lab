import sys, time
sys.path.insert(0, __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', '..'))
from engine.bigip_lb import VirtualServerProxy
p = VirtualServerProxy('127.0.60.10', 5201, lambda: [('127.0.60.2', 5201)], lambda: 'round-robin')
p.start(); print('ready', flush=True)
while True: time.sleep(3600)
