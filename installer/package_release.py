import pathlib,zipfile,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
release=root/'release'; release.mkdir(exist_ok=True)
ignore={'.git','node_modules','dist','release','bin','obj','website','HYPER-DC'}
with zipfile.ZipFile(release/'HYPER-DC-0.1.0-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in root.rglob('*'):
  rel=p.relative_to(root)
  if p.is_file() and not any(x in ignore for x in rel.parts) and p.name != 'payload.zip': z.write(p,'HYPER-DC/'+str(rel).replace('\\','/'))
with zipfile.ZipFile(release/'HYPER-DC-0.1.0-dist.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in (root/'dist').iterdir():
  if p.is_file(): z.write(p,p.name)
 z.write(root/'LICENSE','LICENSE')
names=['HyperDCInstaller.exe','HYPER-DC-0.1.0-source.zip','HYPER-DC-0.1.0-dist.zip']
(release/'SHA256SUMS.txt').write_text('\n'.join(hashlib.sha256((release/n).read_bytes()).hexdigest()+'  '+n for n in names)+'\n')
