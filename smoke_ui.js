'use strict';
// UI event-flow smoke tests with a minimal, in-memory DOM facade.
// These do not replace a true visual browser test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const M=require('./model');
const ids=['progress','setup','seed','generation','years','history','startBtn','play','done',
'generationTitle','generationDesc','rainChart','currentStats','huntRange','fishRange','investRange',
'huntValue','fishValue','riceValue','investValue','allocationBar','laborNote',
'nextBtn','finishBtn','resultsDuring','timeline','stockChart','fieldChart','foodChart','generationLog',
'summaryStats','compareBtn','comparison','exportBtn','replayBtn','randomBtn','modelDetails'];
function element(id){return {id,value:'',hidden:false,disabled:false,innerHTML:'',textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn},click(){this.listeners.click?.()},input(){this.listeners.input?.()},scrollIntoView(){},querySelector(){return {textContent:''}}};}
const el=Object.fromEntries(ids.map(id=>[id,element(id)]));
el.generation.value='25';el.years.value='250';el.history.value='50';
el.huntRange.value='40';el.fishRange.value='40';el.investRange.value='20';
const window={LivelihoodModel:M,crypto:{getRandomValues:a=>(a[0]=123,a[1]=456,a)},scrollTo(){}};
const document={getElementById:id=>{assert(el[id],`unknown DOM element ${id}`);return el[id]},createElement:tag=>({click(){},remove(){}}),body:{appendChild(){}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/app.js','utf8'),{window,document,console,URL,Blob});
assert(el.riceValue.textContent==='20%');
el.seed.value='smoke-seed';el.startBtn.click();
assert.equal(el.play.hidden,false);
assert(el.rainChart.innerHTML.includes('<svg'));
assert.equal(el.generationTitle.textContent.includes('第1世代'),true);
assert.equal(el.currentStats.innerHTML.includes('100'),true);
// Slider clamping maintains sum exactly 100.
el.huntRange.value='90';el.huntRange.input();
assert.equal(Number(el.fishRange.value),10);
assert.equal(el.riceValue.textContent,'0%');
// Reset for main run.
el.huntRange.value='40';el.huntRange.input();el.fishRange.value='40';el.fishRange.input();
for(let i=0;i<10;i++) el.nextBtn.click();
assert.equal(el.done.hidden,false);
assert.equal(el.play.hidden,true);
assert(el.summaryStats.innerHTML.includes('最終人口'));
el.compareBtn.click();
assert.equal(el.comparison.hidden,false);
assert(el.comparison.innerHTML.includes('長期乾燥化'));
assert(el.comparison.innerHTML.includes('長期湿潤化'));
el.replayBtn.click();
assert.equal(el.done.hidden,true);
assert.equal(el.play.hidden,false);
assert.equal(el.generationTitle.textContent.includes('第1世代'),true);
// Fast-forward after one generation: use the revised choice for every remaining generation.
el.nextBtn.click();
el.huntRange.value='10';el.huntRange.input();
el.fishRange.value='20';el.fishRange.input();
el.investRange.value='30';el.investRange.input();
el.finishBtn.click();
assert.equal(el.done.hidden,false);
assert.equal(el.play.hidden,true);
const plan1={shares:[.4,.4,.2],invest:.2};
const plan2={shares:[.1,.2,.7],invest:.3};
const expected=M.runPlans('smoke-seed',[plan1,...Array(9).fill(plan2)],{...M.defaults,years:250,generationYears:25,historicalYears:50});
const formatN=n=>Number(n).toLocaleString('ja-JP',{maximumFractionDigits:1,minimumFractionDigits:1});
assert(el.summaryStats.innerHTML.includes(formatN(expected.summary.finalN)));
// Completing immediately from the first generation is also supported.
el.replayBtn.click();
el.finishBtn.click();
const expectedAll=M.runPlans('smoke-seed',Array(10).fill(plan1),{...M.defaults,years:250,generationYears:25,historicalYears:50});
assert.equal(el.done.hidden,false);
assert(el.summaryStats.innerHTML.includes(formatN(expectedAll.summary.finalN)));
el.compareBtn.click();
assert.equal(el.comparison.hidden,false);
console.log('PASS: generation-by-generation, fixed-plan fast-forward, midgame fast-forward, summary, climate comparison, seed replay');
