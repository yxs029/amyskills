# Session reference: zap-cli wrapper setup + verification

## Date / context
- Session: web security testing setup, user requested ZAP CLI installation
- System: Linux 7.0.0-28-generic, Python 3.11/3.12, ZAP 2.17.0 at /opt/zap

## What was done
- Confirmed system ZAP: `/usr/local/bin/zap` → `/opt/zap/zap.sh`; `/snap/bin/zaproxy`; `/opt/zap/zap-2.17.0.jar`; plugins installed (ascanrules-release-78, pscanrules-release-70, etc.)
- Found real PyPI package is `zapcli` (not `zap-cli`); `pip install zapcli` succeeds but 0.10.0 fails at runtime with `urllib3.packages.six.moves` import error (old vendored six broken on modern urllib3)
- Installed wrapper `~/bin/zap-cli` (Python 3, executable) that calls `/usr/local/bin/zap -cmd` directly — avoids broken pip package
- Verified: `zap-cli quick-scan -t https://example.com -o /tmp/zap-test.html` → completed, report 46613 bytes saved
- Tested daemon mode: `/usr/local/bin/zap -daemon -port 8090 ...` starts; API requires `api.addrs.addr.allow=true` + `api.key=`; `/JSON/core/view/version/` responds when permitted

## File paths (verified)
- Wrapper: `/home/aaronmy/bin/zap-cli`
- System ZAP: `/opt/zap`
- System binary: `/usr/local/bin/zap`
- Scan output (verified): `/tmp/zap-test.html`, `/tmp/zap-test2.html`
- ZAP home / session dir: `/home/aaronmy/.ZAP`

## Key commands verified
```
/usr/local/bin/zap -cmd -quickurl https://example.com -quickout /tmp/zap-report.html -quickprogress -silent
zap-cli quick-scan -t <url> -o <file>
zap-cli start / status / shutdown / alerts High
```

## Pitfalls captured
- `zap-cli` (with hyphen) does not exist on PyPI; package is `zapcli`
- Old `zapcli` 0.10.0 is incompatible with modern `urllib3`/`six` (2022 release)
- `-quickout` writes to directory containing path; directory must exist and be writable
- ZAP daemon API needs correct `api.addrs.addr.name` + `api.key`; `.*` allows all
- Quick scan produces multi-file / large HTML — verify with `ls -la`