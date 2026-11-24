/*
 * 生業選択とリスク: numerical model v0.1
 * All quantities and parameters are hypothetical teaching values, not historical estimates.
 * Stable seed-based, choice-independent climate & livelihood productivity shocks.
 * CommonJS (Node) and browser compatible.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LivelihoodModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = Object.freeze({
    initialPopulation: 100, initialFood: 100, initialK: 25,
    consumptionPerPerson: 1.25, storageCapacity: 250, storageLoss: 0.10,
    populationGrowth: 0.012, scarcityMortality: 0.09,
    fieldDecay: 0.025, fieldInvestEfficiency: 0.18, fieldMax: 200,
    fieldBaseCapacity: 20, fieldCapacityPerK: 1.5,
    baselineGrowingShare: 0.55,
    annualLogSigma: 0.27, seasonalShareSigma: 0.115,
    historicalYears: 50, years: 250, generationYears: 25,
    trendStart: 100, trendMagnitude: 0.30,
    yields: [2.35, 2.20, 3.50],
    capacities: [65, 70],
    optima: [1.0, 1.10, 1.0],
    widths: [0.68, 0.65],
    paddyAnnualWidth: 0.75, paddyGrowingWidth: 0.36,
    paddyGrowingWeight: 0.80,
    shockSigmas: [0.12, 0.16, 0.14],
  });
  const clamp = (x, a, b) => Math.max(a, Math.min(b,x));
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h=Math.imul(h,16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussianFactory(rng) {
    let next = null;
    return () => {
      if (next !== null) {const z = next; next=null; return z;}
      const u = 1-rng(), v = rng();
      const m = Math.sqrt(-2*Math.log(u));
      next = m * Math.sin(2*Math.PI*v);
      return m * Math.cos(2*Math.PI*v);
    };
  }
  function climateSeries(seed, options = {}) {
    const p={...defaults,...options};
    const mode=options.mode || 'stationary';
    if(!['stationary','dry','wet'].includes(mode)) throw Error('Invalid climate mode');
    const annualZ=gaussianFactory(mulberry32(hash32(String(seed)+'|annual')));
    const shareZ=gaussianFactory(mulberry32(hash32(String(seed)+'|share')));
    const shockFns=p.shockSigmas.map((_,i)=>gaussianFactory(mulberry32(hash32(String(seed)+'|livelihood'+i))));
    const rows=[];
    for (let y=-p.historicalYears; y<p.years; y++) {
      const trendStart = Math.min(p.trendStart, Math.floor(p.years*0.4));
      const progress = y <= trendStart ? 0 : clamp((y-trendStart)/(p.years-trendStart),0,1);
      const trend = 1 + (mode==='dry'?-1:mode==='wet'?1:0)*p.trendMagnitude*progress;
      const annual = Math.exp(p.annualLogSigma*annualZ() - 0.5*p.annualLogSigma*p.annualLogSigma)*trend;
      const share=clamp(p.baselineGrowingShare+p.seasonalShareSigma*shareZ(), 0.22, 0.83);
      const growing=annual*share/p.baselineGrowingShare;
      const shocks=shockFns.map((gen,i)=> Math.exp(p.shockSigmas[i]*gen()-p.shockSigmas[i]**2/2));
      rows.push({year:y,annual,growing,share,shocks});
    }
    return rows;
  }
  function normalizedPlan(plan) {
    const shares=plan.shares.map(Number), invest=Number(plan.invest);
    if (shares.length!==3 || shares.some(x=>!Number.isFinite(x)||x<0) || Math.abs(shares.reduce((a,b)=>a+b,0)-1)>1e-8) throw Error('Invalid shares: must be nonnegative and add up to 1');
    if(!Number.isFinite(invest) || invest <0 ||invest>1) throw Error('Invalid investment share');
    return {shares, invest};
  }
  function response(x,opt,width) {return Math.exp(-0.5*((x-opt)/width)**2);}
  function livelihoodFactors(climate,p) {
    const annual=climate.annual, grow=climate.growing;
    const riceAnnual = Math.pow((annual-p.optima[2])/p.paddyAnnualWidth,2);
    const riceGrow = Math.pow((grow-p.optima[2])/p.paddyGrowingWidth,2);
    return [response(annual,p.optima[0],p.widths[0]),
      response(annual,p.optima[1],p.widths[1]),
      Math.exp(-0.5*((1-p.paddyGrowingWeight)*riceAnnual+p.paddyGrowingWeight*riceGrow))];
  }
  function initialState(p=defaults) {return {N:p.initialPopulation,S:p.initialFood,K:p.initialK};}
  function step(state, plan, clim, p=defaults) {
    plan=normalizedPlan(plan);
    const N = state.N, beforeStock = state.S;
    const labor=plan.shares.map(x=>x*N);
    const investLabor=labor[2]*plan.invest;
    labor[2] *= (1-plan.invest);
    const factors=livelihoodFactors(clim,p);
    const capacities=[p.capacities[0],p.capacities[1],p.fieldBaseCapacity + p.fieldCapacityPerK*state.K];
    const harvest=labor.map((l,i)=>p.yields[i]*factors[i]*clim.shocks[i]*l/(1+l/capacities[i]));
    const food=harvest.reduce((a,b)=>a+b,0);
    const consumption=p.consumptionPerPerson*N;
    const available=beforeStock*(1-p.storageLoss)+food;
    const deficit=Math.max(0,consumption-available);
    const adequacy=consumption>0?Math.min(1,available/consumption):1;
    const unboundedStock=Math.max(0,available-consumption);
    const spoiled=beforeStock*p.storageLoss;
    const overflow=Math.max(0,unboundedStock-p.storageCapacity);
    const nextS=clamp(unboundedStock,0,p.storageCapacity);
    let nextN=N*(1+p.populationGrowth*adequacy-p.scarcityMortality*(1-adequacy));
    if(nextN<1) nextN=0;
    const nextK=clamp((1-p.fieldDecay)*state.K+p.fieldInvestEfficiency*investLabor*(1-state.K/p.fieldMax),0,p.fieldMax);
    return {
      state:{N:nextN,S:nextS,K:nextK},
      record:{year:clim.year, N, endN:nextN, S:beforeStock, endS:nextS, K:state.K, endK:nextK,
        annual:clim.annual,growing:clim.growing, harvest,food,consumption, deficit,
        adequacy, wasted:overflow, spoiled, investLabor, response:factors,
        shares:plan.shares.slice(), invest:plan.invest}
    };
  }
  function summarize(records, initialN) {
    const n=records.length;
    const shortageYears=records.filter(r=>r.deficit>1e-8).length;
    const seriousShortageYears=records.filter(r=>r.consumption>0 && r.deficit/r.consumption>=0.10).length;
    const maximumShortageRate=records.reduce((m,r)=>Math.max(m,r.consumption>0?r.deficit/r.consumption:0),0);
    const maximumAnnualPopulationDecline=records.reduce((m,r)=>Math.max(m,r.N>0?1-r.endN/r.N:0),0);
    const finalN=n?records[n-1].endN:initialN;
    const maxPop=Math.max(initialN,...records.map(r=>r.endN));
    const minPop=Math.min(initialN,...records.map(r=>r.endN));
    const meanN=n?records.reduce((a,r)=>a+r.endN,0)/n:initialN;
    return {finalN,shortageYears,seriousShortageYears,maximumShortageRate,maximumAnnualPopulationDecline, maxPop,minPop,meanN,
      totalDeficit:records.reduce((a,r)=>a+r.deficit,0),
      totalHarvest:records.reduce((a,r)=>a+r.food,0),
      finalS:n?records[n-1].endS:0,finalK:n?records[n-1].endK:0,
      collapsed:finalN===0};
  }
  function runPlans(seed, plans, options={}) {
    const p={...defaults,...options};
    if (!(Number.isInteger(p.years)&&p.years>0&& Number.isInteger(p.generationYears)&&p.generationYears>0)) throw Error('Invalid years');
    const series=climateSeries(seed,p);
    let state=initialState(p); const records=[];
    for (let y=0;y<p.years;y++) {
      const idx=Math.floor(y/p.generationYears);
      const plan=plans[Math.min(idx,plans.length-1)];
      if (!plan) throw Error('Missing generation plan');
      const result=step(state,plan,series[p.historicalYears+y],p);
      state=result.state; records.push(result.record);
    }
    return {history:series.slice(0,p.historicalYears),records,summary:summarize(records,p.initialPopulation),state,p};
  }
  return {defaults,clamp,hash32,mulberry32,climateSeries, normalizedPlan,livelihoodFactors,initialState,step,summarize,runPlans};
});
