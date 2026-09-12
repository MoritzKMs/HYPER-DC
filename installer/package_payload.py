import hashlib,json,zipfile,pathlib
root=pathlib.Path('.')
files={p.name:p.read_bytes() for p in (root/'dist').iterdir() if p.is_file() and not p.name.endswith('.map')}
files['LICENSE']=(root/'LICENSE').read_bytes()
manifest={n:hashlib.sha256(b).hexdigest() for n,b in files.items()}
with zipfile.ZipFile(root/'installer/payload.zip','w',zipfile.ZIP_DEFLATED) as z:
 for n,b in files.items(): z.writestr(n,b)
 z.writestr('manifest.json',json.dumps(manifest))
