import requests
import sys
r = requests.get(
    'https://export.arxiv.org/api/query',
    params={'search_query': 'all:cat', 'max_results': 2},
    timeout=20,
    verify=r'C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem'
)
print(r.status_code)
sys.exit(0 if r.status_code == 200 else 1)
