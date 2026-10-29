"""Small ADB helper. Interacts only with visible, observed accessibility nodes.
Usage: python3 scripts/device-qa.py dump | tap TEXT | desc ACCESSIBILITY_LABEL | screenshot NAME | scroll
"""
import json, re, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def adb(*args): return subprocess.check_output(['adb','-s','emulator-5554',*args])
def nodes():
    path='/sdcard/attemply-window-'+str(time.time_ns())+'.xml'
    output=adb('shell','uiautomator','dump',path)
    if b'ERROR' in output:raise SystemExit('UI is updating continuously; inspect a screenshot instead of using a stale tree.')
    tree=ET.fromstring(adb('exec-out','cat',path))
    adb('shell','rm',path)
    return [n.attrib for n in tree.iter('node')]
mode=sys.argv[1]
if mode=='dump':
    print(json.dumps([{k:n.get(k) for k in ['text','content-desc','class','bounds','clickable','focused']} for n in nodes() if n.get('text') or n.get('content-desc')],ensure_ascii=False,indent=2))
elif mode in ('tap','desc'):
    key='text' if mode=='tap' else 'content-desc';target=sys.argv[2]
    matches=[n for n in nodes() if n.get(key,'').casefold()==target.casefold()]
    if not matches:raise SystemExit('Visible node not found: '+target)
    bounds=[int(v) for v in re.findall(r'\d+',matches[-1]['bounds'])]
    x,y=(bounds[0]+bounds[2])//2,(bounds[1]+bounds[3])//2
    adb('shell','input','tap',str(x),str(y));print('Tapped observed node:',target)
elif mode=='screenshot':
    time.sleep(.8)
    name=re.sub(r'[^a-zA-Z0-9_-]','',sys.argv[2]);path=ROOT/'docs'/'screenshots'/(name+'.png')
    path.write_bytes(adb('exec-out','screencap','-p'));print(path)
elif mode=='scroll':
    out=adb('shell','wm','size').decode();w,h=map(int,re.findall(r'(\d+)x(\d+)',out)[-1]);adb('shell','input','swipe',str(w//2),str(int(h*.76)),str(w//2),str(int(h*.30)),'350')
else:raise SystemExit('Unknown command')
