"""Real PEFT optimizer updates, baseline/heldout evaluation, reload and hashes."""
import argparse
import contextlib
import importlib.metadata
import json
import random
import time
from pathlib import Path
from data_workbench import DEFAULT, ROOT, digest, save

MODEL = 'Qwen/Qwen3-4B-Instruct-2507'
REVISION = 'cdbee75f17c01a7cc42f958dc650907174af0554'


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--method', choices=['lora','vera'], required=True)
    p.add_argument('--steps',type=int,default=60)
    p.add_argument('--batch-size',type=int,default=4)
    p.add_argument('--data',type=Path,default=DEFAULT)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    if a.output.exists(): raise ValueError('Use a fresh output directory for reproducibility')
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig,VeraConfig,PeftModel,get_peft_model
    if not torch.cuda.is_available(): raise RuntimeError('CUDA required for this training run')
    torch.set_num_threads(6); random.seed(20260928); torch.manual_seed(20260928)
    a.output.mkdir(parents=True)
    tok=AutoTokenizer.from_pretrained(MODEL,revision=REVISION)
    tok.pad_token=tok.eos_token
    rows={s:[json.loads(l) for l in (a.data/f'{s}.jsonl').read_text().splitlines()] for s in ['train','validation','test']}
    def ids(messages,generation=False):
        x=tok.apply_chat_template(messages,tokenize=True,add_generation_prompt=generation)
        return list(x['input_ids'] if hasattr(x,'keys') else x)
    def encode(row):
        full=ids(row['messages']); prefix=ids(row['messages'][:-1],True)
        if full[:len(prefix)] != prefix or len(full)>512: raise ValueError('Invalid masking/length')
        return full,[-100]*len(prefix)+full[len(prefix):]
    data={s:[encode(r) for r in rs] for s,rs in rows.items()}
    def batch(examples):
        n=max(len(x[0]) for x in examples)
        return {'input_ids':torch.tensor([x+[tok.pad_token_id]*(n-len(x)) for x,y in examples],device='cuda'),
                'labels':torch.tensor([y+[-100]*(n-len(y)) for x,y in examples],device='cuda'),
                'attention_mask':torch.tensor([[1]*len(x)+[0]*(n-len(x)) for x,y in examples],device='cuda')}
    model=AutoModelForCausalLM.from_pretrained(MODEL,revision=REVISION,dtype=torch.bfloat16,device_map='cuda',attn_implementation='sdpa')
    def evaluate_loss(split):
        model.eval(); total=0.; count=0
        with torch.no_grad():
            for i in range(0,len(data[split]),a.batch_size):
                b=batch(data[split][i:i+a.batch_size]); n=(b['labels']!=-100).sum().item()
                total+=model(**b).loss.item()*n; count+=n
        return total/count
    def predictions():
        model.eval(); out=[]
        with torch.no_grad():
            for r in rows['test']:
                x=torch.tensor([ids(r['messages'][:-1],True)],device='cuda')
                y=model.generate(input_ids=x,attention_mask=torch.ones_like(x),max_new_tokens=8,do_sample=False,pad_token_id=tok.pad_token_id)
                text=tok.decode(y[0,x.shape[1]:],skip_special_tokens=True).strip()
                out.append({'expected':r['messages'][-1]['content'],'predicted':text,'correct':text==r['messages'][-1]['content'],'group':r['group']})
        return {'accuracy':sum(x['correct'] for x in out)/len(out),'rows':len(out),'predictions':out}
    baseline={'testLoss':evaluate_loss('test'),'test':predictions()}
    save(a.output/'baseline.json',baseline)
    config=(LoraConfig(task_type='CAUSAL_LM',r=16,lora_alpha=32,lora_dropout=0.05,target_modules=['q_proj','v_proj'])
            if a.method=='lora' else VeraConfig(task_type='CAUSAL_LM',r=256,vera_dropout=0.05,save_projection=True,target_modules=['q_proj','v_proj']))
    model=get_peft_model(model,config)
    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={'use_reentrant':False})
    model.enable_input_require_grads(); model.config.use_cache=False
    trainable,total=model.get_nb_trainable_parameters()
    params=[p for p in model.parameters() if p.requires_grad]
    before=[p.detach().clone() for p in params]
    opt=torch.optim.AdamW(params,lr=2e-4 if a.method=='lora' else 4e-3)
    start=time.monotonic(); history=[]; best=float('inf')
    for step in range(a.steps):
        model.train(); examples=random.sample(data['train'],min(a.batch_size,len(data['train'])))
        loss=model(**batch(examples)).loss
        if not torch.isfinite(loss): raise RuntimeError('Nonfinite loss')
        loss.backward(); torch.nn.utils.clip_grad_norm_(params,1.0);opt.step();opt.zero_grad(set_to_none=True)
        entry={'step':step+1,'loss':loss.item(),'peakAllocatedGiB':torch.cuda.max_memory_allocated()/1024**3}
        if (step+1)%10==0 or step+1==a.steps:
            entry['validationLoss']=evaluate_loss('validation')
            if entry['validationLoss']<best:
                best=entry['validationLoss'];model.save_pretrained(a.output/'adapter');tok.save_pretrained(a.output/'adapter')
        history.append(entry); print(json.dumps(entry),flush=True)
        save(a.output/'training-log.json',history)
    changed=sum(not torch.equal(old,p.detach()) for old,p in zip(before,params))
    del opt,before,params
    base=model.unload(); del model
    model=PeftModel.from_pretrained(base,a.output/'adapter',is_trainable=False)
    model.config.use_cache=True
    adapted={'testLoss':evaluate_loss('test'),'test':predictions()}
    save(a.output/'evaluation.json',adapted)
    hashes={p.name:digest(p) for p in (a.output/'adapter').iterdir() if p.is_file()}
    report={'status':'TRAINED_AND_RELOADED','method':a.method,'baseModel':MODEL,'baseRevision':REVISION,
       'baseLicense':'Apache-2.0','optimizerSteps':a.steps,'changedParameterTensors':changed,
       'trainableParameters':trainable,'totalParameters':total,'seconds':time.monotonic()-start,
       'peakAllocatedGiB':torch.cuda.max_memory_allocated()/1024**3,'batchSize':a.batch_size,
       'baselineAccuracy':baseline['test']['accuracy'],'adapterAccuracy':adapted['test']['accuracy'],
       'baselineTestLoss':baseline['testLoss'],'adapterTestLoss':adapted['testLoss'],
       'reloadVerified':True,'hashes':hashes,'datasetManifestSha256':digest(a.data/'sft.manifest.json'),
       'engineeringGate':changed>0 and adapted['test']['accuracy']>=0.9 and adapted['test']['accuracy']>=baseline['test']['accuracy'],
       'productionApproved':False,'limitations':'Small synthetic/English intent evaluation; not free-form answer quality or human approval',
       'versions':{n:importlib.metadata.version(n) for n in ['torch','transformers','peft']}}
    save(a.output/'report.json',report);print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':main()
