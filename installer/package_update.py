import base64, hashlib, json
from pathlib import Path

version = "0.5.0"
files = {}
for p in Path("dist").iterdir():
    if not p.is_file() or p.name.endswith(".map"):
        continue
    content = p.read_bytes()
    files[p.name] = {"base64": base64.b64encode(content).decode(), "sha256": hashlib.sha256(content).hexdigest()}
content = Path("LICENSE").read_bytes()
files["LICENSE"] = {"base64": base64.b64encode(content).decode(), "sha256": hashlib.sha256(content).hexdigest()}
target = Path("release") / ("v" + version)
target.mkdir(parents=True, exist_ok=True)
(target / "HyperDC-update.json").write_text(json.dumps({"format": 1, "version": version, "minLoader": 1, "files": files}, separators=(",", ":")), encoding="utf8")
