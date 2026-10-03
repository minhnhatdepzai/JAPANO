// LangGraph controls decisions; all customer-visible product facts come from live state.
const { Annotation, StateGraph, START, END } = require('@langchain/langgraph');
const { fetchChatJson } = require('./chatHttp');
const { normalizeText } = require('./postTransformer');
const { runGpuJob, getFocus } = require('./gpuArbiter');
const { catalogCandidates } = require('./chatbot');

const SAFE_INTENTS = new Set(['shopping', 'price', 'size', 'outfit', 'order', 'discount', 'tryon', 'travel', 'greeting', 'fallback']);
const EVENT_WEIGHTS = { view:1, click:2, wishlist:3, cart:4, purchase:5 };

function available(product) {
  return product.status === 'published' && (!(product.variants || []).length || product.variants.some(v => Number(v.stock) > 0));
}

function behaviorSummary(state, userId, now = Date.now()) {
  if (!userId || userId === 'guest') return { evidenceCount:0, preferredCategories:[], confidence:'insufficient-evidence' };
  const products = new Map((state.products || []).filter(available).map(p => [String(p.slug || p.id), p]));
  const categories = new Map(); let evidenceCount = 0;
  for (const event of state.interactions || []) {
    if (String(event.userId) !== String(userId) || event.metadata?.generatedByBot || !EVENT_WEIGHTS[event.type]) continue;
    const at = Number(event.createdAt);
    if (!Number.isFinite(at) || at > now || now - at > 90 * 86400000) continue;
    const product = products.get(String(event.productId));
    if (!product) continue;
    const category = product.cat || product.category;
    if (!category) continue;
    const score = EVENT_WEIGHTS[event.type] * Math.exp(-(now - at) / (30 * 86400000));
    categories.set(category, (categories.get(category) || 0) + score); evidenceCount++;
  }
  return { evidenceCount, preferredCategories:[...categories].sort((a,b) => b[1]-a[1]).slice(0,3).map(([category,score]) => ({ category, score:Number(score.toFixed(3)) })),
    confidence:evidenceCount >= 3 ? 'observed-preference' : 'insufficient-evidence' };
}

async function adapterIntent(message, timeoutMs) {
  const url = process.env.JAPANO_CHAT_ADAPTER_URL;
  if (!url || timeoutMs <= 0 || getFocus().queue.active || getFocus().queue.pending.length) return null;
  const deadline=Date.now()+timeoutMs;
  let timer;
  try {
    const job = runGpuJob('chat', async () => {
      const remaining=deadline-Date.now();
      if (remaining<=0) return null;
      return fetchChatJson(`${url.replace(/\/$/, '')}/intent`, {
        method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({message:String(message).slice(0,800)}),
      },remaining);
    });
    const value = await Promise.race([job,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);timer.unref?.();})]);
    if (!value) return null;
    if (!SAFE_INTENTS.has(value.intent) || value.engineeringGate !== true) return null;
    return {intent:value.intent, model:value.model, adapterSha256:value.adapterSha256};
  } catch { return null; } finally {clearTimeout(timer);}
}

function createChatGraph(replyFn, inferIntent = adapterIntent) {
  const State = Annotation.Root({ state:Annotation(), options:Annotation(), timeoutMs:Annotation(), behavior:Annotation(),
    result:Annotation(), adapter:Annotation(), trace:Annotation({reducer:(a,b) => a.concat(b), default:() => []}) });
  return new StateGraph(State)
    .addNode('analyze_behavior', ({state,options}) => ({behavior:behaviorSummary(state,options.userId),trace:['analyze_behavior']}))
    .addNode('retrieve_catalog', ({state,options}) => ({result:replyFn(state,options),trace:['retrieve_catalog']}))
    .addNode('classify_intent', async ({state,options,result,timeoutMs}) => {
      if (result.modelTrace?.ruleIntent !== 'fallback') return {trace:['classify_intent:rule']};
      const adapter = await inferIntent(options.message,timeoutMs);
      if (!adapter || adapter.intent === 'fallback') return {adapter,trace:['classify_intent:fallback']};
      return {adapter,result:replyFn(state,{...options,plannedIntent:adapter.intent,plannedConfidence:0.75}),trace:['classify_intent:adapter']};
    })
    .addNode('ground_output', ({state,options,result,behavior,adapter}) => {
      const catalog=(state.products || []).filter(available);
      const ids=new Set(catalog.map(p=>String(p.slug || p.id)));
      let answer={...result,productIds:(result.productIds || []).filter(id=>ids.has(String(id)))};
      const hadUnavailable = answer.productIds.length !== (result.productIds || []).length;
      if (['price','size','lookup'].includes(answer.intent)) {
        const query=normalizeText(options.message);
        const mentioned=(answer.productIds || []).map(id=>catalog.find(p=>String(p.slug || p.id)===String(id))).filter(Boolean);
        const words=query.split(/\W+/).filter(w=>w.length>=3 && !['gia','bao','nhieu','con','size','cho','toi','minh','cua','dong','san','pham','khong','quy','tac'].includes(w));
        const requestedType=query.match(/\b(yukata|kimono|haori|hakama|jinbei|samue|noragi|happi|obi|cardigan|blazer|bikini)\b/)?.[1];
        const matches=mentioned.filter(p=>requestedType ? normalizeText(p.name).includes(requestedType) : words.some(w=>normalizeText(p.name).split(/\W+/).includes(w)));
        if (matches.length) {
          answer={...answer,productIds:matches.map(p=>String(p.slug || p.id)),message:matches.map(p=>answer.intent==='size'
            ? `${p.name}: size còn hàng ${(p.variants || []).filter(v=>Number(v.stock)>0).map(v=>v.size).join(', ') || 'chưa được khai báo'}`
            : `${p.name}: ${Number(p.price).toLocaleString('vi-VN')}₫`).join('\n')};
        } else if (!/(cai do|mon do|ao do|quan do|san pham do)/.test(query)) {
          answer={...answer,message:'Mình chưa xác định được sản phẩm này trong catalog JAPANO. Bạn gửi tên đầy đủ hoặc chọn một sản phẩm nhé.',productIds:[],actions:[]};
        }
      }
      // If a referenced product disappeared, discard the whole draft, not just its card.
      if (hadUnavailable) {
        answer={...answer,message:'Thông tin sản phẩm vừa thay đổi. Bạn tìm lại trong danh mục hiện tại nhé.',productIds:[],actions:[]};
      }
      if (answer.intent === 'fallback') answer={...answer,message:'Ori chỉ tư vấn sản phẩm đang bán tại JAPANO, đơn hàng của bạn, thử đồ và các cảnh Nhật Bản có trong ứng dụng. Bạn cho mình tên món hoặc nhu cầu cụ thể nhé.',productIds:[],actions:[]};
      if (answer.intent === 'outfit' && !hadUnavailable) {
        const swimRequested=/(boi|bikini|beach|ho boi|di bien)/.test(normalizeText(options.message));
        const pool=catalog.filter(p=>swimRequested || !/(bikini|do boi|ao tam)/.test(normalizeText(p.name)));
        const picks=catalogCandidates(options.message,pool,[],3);
        answer={...answer,productIds:picks.map(p=>String(p.slug || p.id)),message:picks.length
          ? `Ori gợi ý những món đang bán để bạn cân nhắc phối đồ:\n${picks.map(p=>`${p.name}: ${Number(p.price).toLocaleString('vi-VN')}₫`).join('\n')}\nBạn thích phong cách nào và ngân sách khoảng bao nhiêu?`
          : 'Hiện chưa có sản phẩm phù hợp trong catalog. Bạn thử chọn nhu cầu khác nhé.'};
      }
      if (['shopping','greeting','trend'].includes(answer.intent) && behavior.evidenceCount >= 3) {
        const preferred=new Map(behavior.preferredCategories.map(x=>[x.category,x.score]));
        const byId=new Map(catalog.map(p=>[String(p.slug || p.id),p]));
        answer.productIds=[...answer.productIds].sort((a,b)=>(preferred.get(byId.get(String(b))?.cat)||0)-(preferred.get(byId.get(String(a))?.cat)||0));
      }
      const links=answer.productIds.map(id=>({productId:id,url:`/san-pham/${encodeURIComponent(id)}`}));
      return {result:{...answer,behaviorSummary:behavior,catalogLinks:links,modelTrace:{...answer.modelTrace,
        models:(answer.modelTrace?.models || []).filter(m=>m!=='qwen3-vl-intent-planner'),orchestrator:'langgraph',adapter}},trace:['ground_output']};
    })
    .addEdge(START,'analyze_behavior').addEdge('analyze_behavior','retrieve_catalog')
    .addEdge('retrieve_catalog','classify_intent').addEdge('classify_intent','ground_output').addEdge('ground_output',END).compile();
}

const graphs = new WeakMap();
async function replyWithGraph(state, options, {replyFn, timeoutMs=2500} = {}) {
  if (!graphs.has(replyFn)) graphs.set(replyFn,createChatGraph(replyFn));
  const output=await graphs.get(replyFn).invoke({state,options,timeoutMs},{recursionLimit:8});
  return {...output.result,modelTrace:{...output.result.modelTrace,graphNodes:output.trace}};
}

module.exports={replyWithGraph,createChatGraph,behaviorSummary,available};
