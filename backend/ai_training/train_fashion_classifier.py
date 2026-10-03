"""Fine-tune pretrained ResNet18 layer4 + head on licensed Kaggle product photos.

This is product classification, never a virtual try-on or body-measurement model.
"""
import argparse
import csv
import json
import random
import time
from collections import Counter
from pathlib import Path
from data_workbench import DEFAULT, digest, save


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',type=Path,required=True);p.add_argument('--epochs',type=int,default=3)
    p.add_argument('--per-class',type=int,default=1600);a=p.parse_args()
    if a.output.exists():raise ValueError('Output must be fresh')
    import torch
    from torch import nn
    from torch.utils.data import DataLoader,Dataset
    from torchvision.models import resnet18,ResNet18_Weights
    from torchvision import transforms as T
    from PIL import Image
    torch.set_num_threads(6);torch.manual_seed(20260928);random.seed(20260928)
    root=DEFAULT/'raw/fashion/files';a.output.mkdir(parents=True)
    labels=['Apparel','Footwear','Accessories'];groups={k:[] for k in labels};seen=set()
    with (root/'styles.csv').open() as f:
        for row in csv.DictReader(f):
            if None in row or row['masterCategory'] not in groups:continue
            file=root/'images'/f"{row['id']}.jpg"
            if not file.exists():continue
            h=digest(file)
            if h in seen:continue
            seen.add(h);groups[row['masterCategory']].append({'file':str(file),'label':labels.index(row['masterCategory']),'sha256':h,'id':row['id']})
    splits={k:[] for k in ['train','validation','test']}
    for rows in groups.values():
        random.shuffle(rows);rows=rows[:a.per_class];n=len(rows);train=int(n*.75);val=int(n*.125)
        splits['train']+=rows[:train];splits['validation']+=rows[train:train+val];splits['test']+=rows[train+val:]
    save(a.output/'splits.json',splits)
    tf=T.Compose([T.Resize((160,160)),T.ToTensor(),T.Normalize([.485,.456,.406],[.229,.224,.225])])
    class Photos(Dataset):
        def __init__(self,rows):self.rows=rows
        def __len__(self):return len(self.rows)
        def __getitem__(self,i):
            r=self.rows[i]
            with Image.open(r['file']) as im: x=tf(im.convert('RGB'))
            return x,r['label']
    loaders={k:DataLoader(Photos(v),batch_size=64,shuffle=k=='train',num_workers=2,pin_memory=True) for k,v in splits.items()}
    device='cuda';model=resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
    for param in model.parameters():param.requires_grad=False
    for param in model.layer4.parameters():param.requires_grad=True
    model.fc=nn.Linear(model.fc.in_features,len(labels));model.to(device)
    def evaluate(split):
        model.eval();matrix=torch.zeros((3,3),dtype=torch.int64)
        with torch.no_grad():
            for x,y in loaders[split]:
                with torch.autocast('cuda',dtype=torch.bfloat16):pred=model(x.to(device)).argmax(1).cpu()
                for truth,guess in zip(y,pred):matrix[truth,guess]+=1
        return {'accuracy':matrix.trace().item()/matrix.sum().item(),'confusionMatrix':matrix.tolist(),'rows':matrix.sum().item()}
    baseline=evaluate('test');opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=1e-4)
    history=[];best=-1;steps=0;start=time.monotonic()
    for epoch in range(a.epochs):
        model.eval();model.layer4.train();model.fc.train();total=0
        for x,y in loaders['train']:
            with torch.autocast('cuda',dtype=torch.bfloat16):loss=nn.functional.cross_entropy(model(x.to(device)),y.to(device))
            loss.backward();opt.step();opt.zero_grad(set_to_none=True);steps+=1;total+=loss.item()
        val=evaluate('validation');record={'epoch':epoch+1,'loss':total/len(loaders['train']),'validation':val};history.append(record);print(json.dumps(record),flush=True)
        if val['accuracy']>best:
            best=val['accuracy'];torch.save(model.state_dict(),a.output/'resnet18-fashion.pt')
    model.load_state_dict(torch.load(a.output/'resnet18-fashion.pt',weights_only=True));test=evaluate('test')
    report={'status':'TRAINED_AND_RELOADED','technique':'supervised transfer learning: ResNet18 layer4 + classifier head',
      'task':'3-class product image classification, NOT image generation or measurement','classes':labels,
      'optimizerSteps':steps,'epochs':a.epochs,'baselineUntrainedHead':baseline,'heldout':test,'history':history,
      'seconds':time.monotonic()-start,'peakAllocatedGiB':torch.cuda.max_memory_allocated()/1024**3,
      'sha256':digest(a.output/'resnet18-fashion.pt'),'reloadVerified':True,
      'dataset':json.loads((DEFAULT/'raw/fashion/manifest.json').read_text()),
      'split':'product ID and exact-image hash disjoint; near-duplicate images not independently audited',
      'productionApproved':False,'limitations':'Catalog studio photos; no validation on people, bikinis, try-on realism or JAPANO photos'}
    save(a.output/'report.json',report);print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':main()
