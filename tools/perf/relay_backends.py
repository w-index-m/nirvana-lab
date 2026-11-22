import sys
sys.path.insert(0, __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..', '..'))
from engine.mock_http_server import ensure_mock_http_server
import time
ensure_mock_http_server('127.0.50.1', 9600, 'web-a'); ensure_mock_http_server('127.0.50.2', 9600, 'web-b')
print('ready', flush=True)
while True: time.sleep(3600)
