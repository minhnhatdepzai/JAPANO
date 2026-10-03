"""Run the actual trained image classifier, without claiming try-on ability."""
import argparse
import json
from pathlib import Path
from data_workbench import digest


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run',type=Path,required=True);p.add_argument('--image',type=Path,required=True)
    a=p.parse_args();report=json.loads((a.run/'report.json').read_text());weight=a.run/'resnet18-fashion.pt'
    if digest(weight)!=report['sha256']:raise ValueError('Checkpoint hash mismatch')
    import torch
    from torchvision.models import resnet18
    from torchvision import transforms as T
    from PIL import Image
    torch.set_num_threads(4)
    model=resnet18(weights=None);model.fc=torch.nn.Linear(model.fc.in_features,len(report['classes']))
    model.load_state_dict(torch.load(weight,map_location='cpu',weights_only=True));model.eval()
    tf=T.Compose([T.Resize((160,160)),T.ToTensor(),T.Normalize([.485,.456,.406],[.229,.224,.225])])
    with Image.open(a.image) as image:x=tf(image.convert('RGB')).unsqueeze(0)
    with torch.no_grad():probs=model(x).softmax(-1)[0]
    i=int(probs.argmax());print(json.dumps({'label':report['classes'][i],'score':float(probs[i]),
        'scoreIsCalibrated':False,'checkpointSha256':report['sha256'],
        'scope':'studio product image classification only'},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
