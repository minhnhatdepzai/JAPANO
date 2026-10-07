const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatGraph, behaviorSummary } = require('../lib/chatGraph');
const chatbot = require('../lib/chatbot');
const product = {id:'a',slug:'a',name:'Áo Nhật',status:'published',price:120000,cat:'tops',tags:[],variants:[{size:'M',stock:3}]};
const state = {products:[product],profiles:[],interactions:[],orders:[],chats:[],vouchers:[]};

test('behavior uses only own recent non-bot signals, no guest aggregation', () => {
  const now=Date.now();const s={...state,interactions:[
    {userId:'u',productId:'a',type:'view',createdAt:now},
    {userId:'other',productId:'a',type:'purchase',createdAt:now},
    {userId:'u',productId:'a',type:'view',createdAt:now,metadata:{generatedByBot:true}},
    {userId:'u',productId:'a',type:'view',createdAt:now-100*86400000},
  ]};
  assert.equal(behaviorSummary(s,'u',now).evidenceCount,1);
  assert.equal(behaviorSummary(s,'guest',now).evidenceCount,0);
});
test('a learned intent cannot introduce products or invented model prose', async () => {
  const graph=createChatGraph(chatbot.reply,async()=>({intent:'shopping',model:'test'}));
  const out=await graph.invoke({state,options:{userId:'guest',message:'tìm trang phục'},timeoutMs:100});
  assert.ok(out.result.productIds.every(x=>x==='a'));
  assert.deepEqual(out.trace.slice(-1),['ground_output']);
});
test('removed/hidden reference invalidates both answer and cards', async () => {
  const graph=createChatGraph(()=>({message:'Hidden product costs 99',intent:'shopping',productIds:['hidden'],modelTrace:{ruleIntent:'shopping'}}));
  const out=await graph.invoke({state,options:{message:'mua áo'}});
  assert.deepEqual(out.result.productIds,[]);assert.doesNotMatch(out.result.message,/99|Hidden/);
});
test('out of scope fallback gives no invented inventory', async () => {
  const graph=createChatGraph(()=>({message:'unsafe draft',intent:'fallback',productIds:[],modelTrace:{ruleIntent:'fallback'}}),async()=>null);
  const out=await graph.invoke({state,options:{message:'bịa sản phẩm'},timeoutMs:100});
  assert.match(out.result.message,/JAPANO/);assert.deepEqual(out.result.productIds,[]);
});

test('inventory answer remains deterministic through graph grounding', async () => {
  const graph=createChatGraph(chatbot.reply,async()=>{throw new Error('adapter should not run');});
  const out=await graph.invoke({state,options:{message:'Áo Nhật size M còn bao nhiêu?'},timeoutMs:100});
  assert.equal(out.result.intent,'inventory');
  assert.match(out.result.message,/còn 3 sản phẩm \(size M\)/);
  assert.deepEqual(out.result.productIds,['a']);
});

test('price filter keeps relevant live products without treating filtering as deletion', async () => {
  const yukata={...product,id:'y',slug:'y',name:'Yukata xanh'};
  const s={...state,products:[product,yukata]};
  const graph=createChatGraph(()=>({message:'old',intent:'price',productIds:['y','a'],modelTrace:{ruleIntent:'price'}}));
  const out=await graph.invoke({state:s,options:{message:'Yukata giá bao nhiêu?'}});
  assert.deepEqual(out.result.productIds,['y']);assert.match(out.result.message,/120\.000/);
  const unknown=await graph.invoke({state:s,options:{message:'iPhone giá bao nhiêu?'}});
  assert.deepEqual(unknown.result.productIds,[]);assert.match(unknown.result.message,/chưa xác định/);
});

test('ordinary outfit request does not suggest swimwear', async () => {
  const swim={...product,id:'bikini',slug:'bikini',name:'Bikini hoa'};
  const graph=createChatGraph(()=>({message:'bikini',intent:'outfit',productIds:['bikini'],modelTrace:{ruleIntent:'outfit'}}));
  const out=await graph.invoke({state:{...state,products:[swim,product]},options:{message:'Gặp người yêu mặc gì?'}});
  assert.ok(!out.result.productIds.includes('bikini'));assert.doesNotMatch(out.result.message,/Bikini/);
});

test('Vietnamese word hiện does not trigger the ASCII hi greeting rule', () => {
  assert.equal(chatbot.detectRuleIntent('Shop hiện có bikini nào và giá bao nhiêu?'), 'price');
  assert.equal(chatbot.detectRuleIntent('Hi, shop có gì?'), 'greeting');
});

test('broad Vietnamese beauty request is a grounded outfit request without waiting for adapter', async () => {
  assert.equal(chatbot.detectRuleIntent('Tôi muốn đẹp'), 'outfit');
  assert.equal(chatbot.detectRuleIntent('Tôi muốn mặc đẹp'), 'outfit');
  assert.equal(chatbot.detectRuleIntent('Gợi ý đồ đẹp cho tôi'), 'outfit');
  const graph=createChatGraph(chatbot.reply,async()=>{throw new Error('adapter should not run');});
  const out=await graph.invoke({state,options:{userId:'guest',message:'Tôi muốn đẹp'},timeoutMs:100});
  assert.equal(out.result.intent,'outfit');
  assert.ok(out.result.productIds.length > 0);
  assert.doesNotMatch(out.result.message,/chỉ tư vấn|nhu cầu cụ thể/i);
});

test('word cho in đồ đẹp cho tôi is not mistaken for a travel place', () => {
  assert.equal(chatbot.detectRuleIntent('Gợi ý đồ đẹp cho tôi'), 'outfit');
  assert.equal(chatbot.detectRuleIntent('Gợi ý chỗ đẹp ở Nhật cho tôi'), 'travel');
});
