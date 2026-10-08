"""Reproduce the 2024 TE snapshot from the bundled canonical CSVs.
Only proclaimed winners are present. Preserve source percentages, not estimates.
"""
import csv,json,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
urls={
 'mayor':'https://www.datosabiertos.gob.pa/dataset/329a411a-07ae-47c7-b4fd-8845e4a01040/resource/a22562c8-c8f3-4664-bb35-9c335aad820a/download/cuadro-10-alcaldes-proclamados.csv',
 'deputy':'https://www.datosabiertos.gob.pa/dataset/8c4c4aef-f154-4f83-86a8-ed261afab29a/resource/9eee83e4-4928-4350-9a55-98cbbc1b23e2/download/cuadro-06-diputado-proclamados.csv',
}
rows=[]
for kind,filename in [('mayor','alcaldes'),('deputy','diputados')]:
 path=root/'data/elections'/f'{filename}-2024.csv'
 source=path.read_bytes().decode('cp850')
 province=circuit=''
 for raw in csv.reader(source.splitlines(),delimiter=';'):
  raw=[re.sub(r'\s+',' ',s).strip() for s in raw]
  if kind=='mayor':
   if len(raw)<5 or not re.fullmatch(r'[\d,]+',raw[3]):continue
   province=raw[0] or province
   district,name,votes,party=raw[1:5]
   rows.append(dict(id=f'mayor-{len(rows)}',kind=kind,date='2024-05-05',name=name,territory=district,province=province,votes=int(votes.replace(',','')),party=party,source=urls[kind]))
  else:
   if len(raw)<12 or not re.fullmatch(r'[\d,]+',raw[8]) or not raw[7]:continue
   circuit=raw[0] or circuit
   if not re.fullmatch(r'\d+\.\d+',circuit):raise ValueError('Missing circuit')
   rows.append(dict(id=f'deputy-{len(rows)}',kind=kind,date='2024-05-05',name=raw[7],territory=circuit.replace('.','-'),province='',votes=int(raw[8].replace(',','')),percent=float(raw[9]),party=raw[10],method=raw[11],source=urls[kind]))
assert sum(r['kind']=='deputy' for r in rows)==71
assert sum(r['kind']=='mayor' for r in rows)==81
payload={'electionDate':'2024-05-05','retrievedAt':'2026-10-08','scope':'proclaimed-winners','sources':[{'url':urls[kind],'sha256':hashlib.sha256((root/'data/elections'/f'{file}-2024.csv').read_bytes()).hexdigest()} for kind,file in [('mayor','alcaldes'),('deputy','diputados')]],'results':rows}
(root/'src/data/elections').mkdir(parents=True,exist_ok=True)
(root/'src/data/elections/results-2024.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
print(f'Validated {len(rows)} proclaimed winners: 71 deputies, 81 mayors.')
