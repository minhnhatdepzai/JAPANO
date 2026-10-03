import type { BodyEstimate } from './api';

/** A ten-unit display group is not a confidence interval or a new prediction. */
export function bodyEstimateDisplay(estimate:BodyEstimate|undefined,unit:'cm'|'kg') {
  const value=unit==='cm'?estimate?.valueCm:estimate?.valueKg;
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)return '';
  if(estimate?.source==='user_provided'||estimate?.source==='reference_object')return `${value} ${unit}`;
  const low=Math.max(0,Math.round(value)-5);
  return `Nhóm ${low}–${low+10} ${unit}`;
}

export function bodyEstimateUncertainty(estimate:BodyEstimate|undefined,unit:'cm'|'kg') {
  if(!estimate||estimate.source==='user_provided'||estimate.source==='reference_object')return '';
  const low=unit==='cm'?estimate.uncertaintyMinCm??estimate.minCm:estimate.uncertaintyMinKg??estimate.minKg;
  const high=unit==='cm'?estimate.uncertaintyMaxCm??estimate.maxCm:estimate.uncertaintyMaxKg??estimate.maxKg;
  if(typeof low!=='number'||typeof high!=='number'||!Number.isFinite(low)||!Number.isFinite(high)||high<low)return '';
  return `${Math.round(low)}–${Math.round(high)} ${unit}`;
}
