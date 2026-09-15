import urllib.request
req = urllib.request.Request(
    'http://localhost:8000/api/auth/sync-profile/',
    data=b'{"role":"researcher"}',
    headers={
        'Authorization': 'Bearer eyJ1aWQiOiJkZXYtYWRtaW5hZXJvZ2luY29tIiwiZW1haWwiOiJhZG1pbkBhZXJvZ2luLmNvbSJ9',
        'Content-Type': 'application/json'
    }
)
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
