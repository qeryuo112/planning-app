import base64
import urllib.parse
import yaml
import sys


def decode_subscription(path):
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    # 兼容 base64 编码或纯文本
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
    except Exception:
        decoded = raw
    return [line.strip() for line in decoded.splitlines() if line.strip()]


def parse_vless(url):
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    name = urllib.parse.unquote(parsed.fragment) if parsed.fragment else "unnamed"
    return {
        "name": name,
        "type": "vless",
        "server": parsed.hostname,
        "port": parsed.port,
        "uuid": parsed.username,
        "flow": query.get("flow", [""])[0] or None,
        "tls": True,
        "servername": query.get("sni", [""])[0] or query.get("host", [""])[0] or "",
        "network": query.get("type", ["tcp"])[0],
        "reality-opts": {
            "public-key": query.get("pbk", [""])[0],
            "short-id": query.get("sid", [""])[0],
        },
        "client-fingerprint": query.get("fp", [""])[0] or "chrome",
    }


def parse_trojan(url):
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    name = urllib.parse.unquote(parsed.fragment) if parsed.fragment else "unnamed"
    network = query.get("type", ["tcp"])[0]
    proxy = {
        "name": name,
        "type": "trojan",
        "server": parsed.hostname,
        "port": parsed.port,
        "password": parsed.username,
        "sni": query.get("sni", [""])[0] or query.get("peer", [""])[0] or parsed.hostname,
        "skip-cert-verify": query.get("allowInsecure", ["0"])[0] == "1",
        "network": network,
    }
    if network == "ws":
        path = query.get("path", ["/"])[0]
        proxy["ws-opts"] = {
            "path": urllib.parse.unquote(path),
            "headers": {"Host": query.get("host", [""])[0] or parsed.hostname},
        }
    return proxy


def convert(lines, default_index=3):
    proxies = []
    for line in lines:
        if line.startswith("vless://"):
            proxies.append(parse_vless(line))
        elif line.startswith("trojan://"):
            proxies.append(parse_trojan(line))
    # 清理空字段
    for p in proxies:
        for key in list(p.keys()):
            if p[key] is None or p[key] == "":
                del p[key]
        if "reality-opts" in p and not any(p["reality-opts"].values()):
            del p["reality-opts"]
    default = proxies[default_index]["name"] if proxies and default_index < len(proxies) else ""
    proxy_names = [p["name"] for p in proxies]
    if default and default in proxy_names:
        proxy_names.remove(default)
        proxy_names.insert(0, default)
    return {
        "mixed-port": 7890,
        "allow-lan": False,
        "mode": "rule",
        "log-level": "info",
        "external-controller": "127.0.0.1:9090",
        "proxies": proxies,
        "proxy-groups": [
            {
                "name": "PROXY",
                "type": "select",
                "proxies": proxy_names,
            }
        ],
        "rules": [
            "DOMAIN-SUFFIX,google.com,PROXY",
            "DOMAIN-SUFFIX,googleapis.com,PROXY",
            "DOMAIN-SUFFIX,firebase.googleapis.com,PROXY",
            "DOMAIN-SUFFIX,googleusercontent.com,PROXY",
            "DOMAIN-SUFFIX,gstatic.com,PROXY",
            "DOMAIN-SUFFIX,ggpht.com,PROXY",
            "DOMAIN-SUFFIX,ytimg.com,PROXY",
            "DOMAIN-SUFFIX,youtube.com,PROXY",
            "DOMAIN-SUFFIX,googlevideo.com,PROXY",
            "DOMAIN-SUFFIX,firebaseapp.com,PROXY",
            "DOMAIN-SUFFIX,crashlytics.com,PROXY",
            "DOMAIN-SUFFIX,app-measurement.com,PROXY",
            "DOMAIN-SUFFIX,android.com,PROXY",
            "DOMAIN-SUFFIX,gvt2.com,PROXY",
            "DOMAIN,accounts.google.com,PROXY",
            "DOMAIN,oauth2.googleapis.com,PROXY",
            "DOMAIN,fcmtoken.googleapis.com,PROXY",
            "DOMAIN,fcm.googleapis.com,PROXY",
            "DOMAIN,fcmregistrations.googleapis.com,PROXY",
            "DOMAIN,firebaselogging.googleapis.com,PROXY",
            "DOMAIN,firebasestorage.googleapis.com,PROXY",
            "DOMAIN,www.googleapis.com,PROXY",
            "MATCH,DIRECT",
        ],
    }


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sub.yaml"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/mihomo.yaml"
    lines = decode_subscription(input_path)
    config = convert(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        yaml.dump(config, f, allow_unicode=True, sort_keys=False)
    print(f"Generated {len(config['proxies'])} proxies, first default: {config['proxy-groups'][0]['proxies'][0]}")
