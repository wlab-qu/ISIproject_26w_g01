'use strict';
const assert=require('node:assert/strict');
const M=require('./model');
const {defaults:p}=M;
const near=(a,b,eps=1e-8)=>Math.abs(a-b)<=eps*Math.max(1,Math.abs(a),Math.abs(b));
const choices={
 balanced:{shares:[.4,.4,.2],invest:.2},
 diverse:{shares:[.35,.35,.30],invest:.15},
 ricefocused:{shares:[.1,.1,.8],invest:.25},
 hunting:{shares:[1,0,0],invest:0}
};
const repeated=M.runPlans('trial-seed',[choices.balanced]);
assert.deepEqual(repeated,M.runPlans('trial-seed',[choices.balanced]),'same seed and choices reproducible');
assert.notDeepEqual(repeated.records.map(x=>x.annual),M.runPlans('other-seed',[choices.balanced]).records.map(x=>x.annual),'different seed changes weather');
const rain1=M.runPlans('trial-seed',[choices.ricefocused]);
assert.deepEqual(repeated.records.map(r=>[r.annual,r.growing]),rain1.records.map(r=>[r.annual,r.growing]),'strategy does not affect weather');
const X=M.climateSeries('trial-seed',{mode:'stationary'});
const Y=M.climateSeries('trial-seed',{mode:'dry'});
assert.deepEqual(X.filter(a=>a.year<=100).map(a=>a.annual),Y.filter(a=>a.year<=100).map(a=>a.annual),'trend starts on schedule');
assert(X.some((a,i)=>a.year>100&&a.annual>Y[i].annual));
assert(X.every(x=>x.growing>0 && x.share<=1 && x.growing<=x.annual/p.baselineGrowingShare+1e-10),'growing is subset of annual in normalized terms');
let n=0;
for (let i=0;i<100;i++){
  for(const mode of ['stationary','dry','wet']){
    for(const plan of Object.values(choices)) {
      const run=M.runPlans('seed_'+i,[plan],{mode});
      let last={N:p.initialPopulation,S:p.initialFood,K:p.initialK};
      for(const r of run.records){
        assert([r.endN,r.endS,r.endK,r.food,r.deficit,r.adequacy,...r.harvest].every(v=>Number.isFinite(v)&&v>=0), 'finite and nonnegative');
        assert(r.endS<=p.storageCapacity+1e-8,'storage capacity');
        assert(r.endK<=p.fieldMax+1e-8,'field capacity');
        assert(r.adequacy<=1+1e-8,'food adequacy bounded');
        assert(near(last.N,r.N) && near(last.S,r.S) && near(last.K,r.K),'state transitions continuous');
        const consumed = r.consumption - r.deficit;
        assert(near(r.S + r.food, consumed + r.endS + r.wasted + r.spoiled),'food mass balance');
        last={N:r.endN,S:r.endS,K:r.endK};
      }
      n++;
    }
  }
}
console.log('PASS:',n,'simulation paths ×',p.years,'years validated (food balance, bounds, finite outputs)');
console.log('PASS: identical seed reproduces; strategy does not change precipitation');
console.log('PASS: nonstationary climate leaves historical and first 100 years unchanged');
for(const [label,plan] of Object.entries(choices)){
 const rows=Array.from({length:100},(_,i)=>M.runPlans('seed_'+i,[plan]).summary);
 const avg=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
 const max10=rows.map(r=>r.maximumShortageRate).sort((a,b)=>a-b)[9];
 const p90=rows.map(r=>r.maximumShortageRate).sort((a,b)=>a-b)[89];
 console.log(label, 'average finalN',avg('finalN').toFixed(1),'average shortage years',avg('shortageYears').toFixed(1), 'average max shortage %',(100*avg('maximumShortageRate')).toFixed(1), '10-90 max short %',Math.round(max10*100),Math.round(p90*100));
}
