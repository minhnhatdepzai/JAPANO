"""Loopback-only intent inference; GPU coordinated by backend gpuArbiter.

Only engineering-gated, hash-verified adapters load. No free-form product facts.
"""
import argparse
import json
import threading
from pathlib import Path
from data_workbench import digest
from build_chat_sft import SYSTEM, INTENTS


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run',type=Path,required=True);p.add_argument('--port',type=int,default=7866)
    a=p.parse_args();report=json.loads((a.run/'report.json').read_text())
    if not report.get('engineeringGate') or not report.get('reloadVerified'):raise ValueError('Adapter has not passed engineering gate')
    for name,h in report['hashes'].items():
        if digest(a.run/'adapter'/name)!=h:raise ValueError('Adapter hash mismatch')
    import torch
    from transformers import AutoModelForCausalLM,AutoTokenizer
    from peft import PeftModel
    from fastapi import FastAPI,HTTPException
    from pydantic import BaseModel,Field
    import uvicorn
    torch.set_num_threads(8)
    tok=AutoTokenizer.from_pretrained(a.run/'adapter')
    base=AutoModelForCausalLM.from_pretrained(report['baseModel'],revision=report['baseRevision'],dtype=torch.bfloat16,device_map='cpu',attn_implementation='sdpa')
    model=PeftModel.from_pretrained(base,a.run/'adapter');model.eval();lock=threading.Lock()
    app=FastAPI(title='JAPANO intent adapter')
    class Request(BaseModel):message:str=Field(min_length=1,max_length=800)
    @app.get('/health')
    def health():return {'ok':True,'device':str(next(model.parameters()).device),'method':report['method'],'engineeringGate':True,'productionApproved':False}
    @app.post('/unload')
    def unload():
        with lock:
            model.to('cpu');torch.cuda.empty_cache()
        return {'ok':True}
    @app.post('/intent')
    def intent(body:Request):
        if not lock.acquire(blocking=False):raise HTTPException(503,'busy')
        try:
            free,_=torch.cuda.mem_get_info()
            if next(model.parameters()).device.type!='cuda':
                if free<10*1024**3:raise HTTPException(503,'insufficient free VRAM')
                model.to('cuda')
            text=tok.apply_chat_template([{'role':'system','content':SYSTEM},{'role':'user','content':body.message}],tokenize=False,add_generation_prompt=True)
            x=tok(text,return_tensors='pt').to('cuda')
            with torch.no_grad():y=model.generate(**x,max_new_tokens=8,do_sample=False,pad_token_id=tok.eos_token_id)
            label=tok.decode(y[0,x['input_ids'].shape[1]:],skip_special_tokens=True).strip()
            return {'intent':label if label in INTENTS else 'fallback','model':report['baseModel']+'+'+report['method'],
                    'adapterSha256':report['hashes']['adapter_model.safetensors'],'engineeringGate':True}
        finally:lock.release()
    uvicorn.run(app,host='127.0.0.1',port=a.port)


if __name__=='__main__':main()
