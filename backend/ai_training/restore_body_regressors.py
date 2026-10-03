"""Train recoverable ANSUR regressors with a sealed person-level test split.

Table regression only: test errors do not measure photo-to-body accuracy.
"""
import argparse,json
from pathlib import Path
import numpy as np
import joblib
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import train_body_estimator as source
from data_workbench import digest,save


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.output.exists():raise ValueError('Use a new output directory')
    args.output.mkdir(parents=True)
    source.ANSUR_DIR=args.data
    rows=source.add_ratio_features(source.load_ansur())
    indices=np.arange(len(rows));sex=[r['sex'] for r in rows]
    trainval,test=train_test_split(indices,test_size=.2,random_state=73,stratify=sex)
    train,val=train_test_split(trainval,test_size=.2,random_state=73,stratify=[sex[i] for i in trainval])
    report={'dataset':'ANSUR II','license':'CC0-1.0','seed':73,'split':{'train':train.tolist(),'validation':val.tolist(),'test':test.tolist()},
            'metricNature':'Physical breadth table regression; NOT photo-to-body accuracy','models':{},'productionApproved':False}
    models={}
    for target in ['weight_kg','chest_circ_cm','waist_circ_cm','hip_circ_cm','bmi']:
        ratio=target=='bmi';features=source.RATIO_FEATURES if ratio else source.FEATURES
        x=np.array([[r[f] for f in features] for r in rows]);y=np.array([r[target] for r in rows])
        rng=np.random.default_rng(73);corrupt=source.corrupt_ratios if ratio else source.corrupt_features
        xt=np.concatenate([x[train],np.array([corrupt(v,rng,strength=.5) for v in x[train]])])
        yt=np.tile(y[train],2)
        candidates=[]
        for leaves in [15,31]:
            m=HistGradientBoostingRegressor(max_iter=180,max_leaf_nodes=leaves,l2_regularization=5,random_state=73).fit(xt,yt)
            score=mean_absolute_error(y[val],m.predict(x[val]));candidates.append((score,m))
        score,m=min(candidates,key=lambda p:p[0]);pred=m.predict(x[test]);err=np.abs(pred-y[test])
        metrics={'validationMAE':float(score),'testMAE':float(err.mean()),'testP90AbsoluteError':float(np.quantile(err,.9)),
                 'testBias':float(np.mean(pred-y[test])),'testCount':len(test)}
        weights=np.array([rows[i]['weight_kg'] for i in test])
        metrics['weightSubgroups']={name:{'count':int(mask.sum()),'mae':float(err[mask].mean()) if mask.any() else None}
            for name,mask in [('under50kg',weights<50),('50to100kg',(weights>=50)&(weights<100)),('100kgPlus',weights>=100),('150kgPlus',weights>=150)]}
        models[target]=m;report['models'][target]=metrics
        print(target,json.dumps(metrics),flush=True)
    meta={'source':'ANSUR II','license':'CC0-1.0','photoValidated':False}
    joblib.dump({'model':models['weight_kg'],'features':source.FEATURES,'metadata':meta},args.output/'body_weight_estimator.joblib')
    joblib.dump({'model':models['bmi'],'features':source.RATIO_FEATURES,'metadata':meta},args.output/'body_bmi_estimator.joblib')
    joblib.dump({'models':{k:models[k] for k in ['chest_circ_cm','waist_circ_cm','hip_circ_cm']},'features':source.FEATURES,'metadata':meta},args.output/'body_girth_estimators.joblib')
    save(args.output/'anthropometry.json',source.fit_anthropometry([rows[i] for i in train]))
    report['hashes']={p.name:digest(p) for p in args.output.iterdir() if p.is_file()}
    report['reloadVerified']=all(joblib.load(p) for p in args.output.glob('*.joblib'))
    save(args.output/'report.json',report)

if __name__=='__main__':main()
