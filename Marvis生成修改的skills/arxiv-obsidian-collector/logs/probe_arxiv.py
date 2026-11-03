import requests
r = requests.get(
    'https://export.arxiv.org/api/query',
    params={'search_query': 'all:cat', 'max_results': 2},
    timeout=20,
    verify=r'C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem'
)
print(r.status_code)
