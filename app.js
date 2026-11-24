/* Browser UI for Game 1. No server or external dependencies. */
(() => {
  'use strict';
  const M=window.LivelihoodModel;
  const $=id=>document.getElementById(id);
  const colors={hunt:'#a7794f',fish:'#467d9f',rice:'#7b9862',annual:'#3e729e',growing:'#d59a49',pop:'#2d8063',stock:'#b28344',field:'#7c6ca6',prod:'#4d8a65',demand:'#cf8867'};
  const fmt=(x, n=0)=>Number(x).toLocaleString('ja-JP',{maximumFractionDigits:n,minimumFractionDigits:n});
  let game=null;
  function randomSeed(){
    if(window.crypto && window.crypto.getRandomValues){const a=new Uint32Array(2);window.crypto.getRandomValues(a);return 'random-'+a[0].toString(36)+'-'+a[1].toString(36);}
    return 'random-'+Math.random().toString(36).slice(2);
  }
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function metric(name, val, unit='') {return `<div class="metric"><div class="metric-label">${name}</div><div class="metric-value">${val}<span class="metric-unit">${unit}</span></div></div>`;}
  function svgPlot(dataSets,{xmin=null,xmax=null,ymin=null,ymax=null,title='',unit='',zeroLine=false}={}) {
    const all=dataSets.flatMap(d=>d.values||[]).filter(v=>Number.isFinite(v.x)&&Number.isFinite(v.y));
    if(!all.length) return '<p class="fine" style="padding:12px">まだデータがありません。</p>';
    const W=900,H=257,ml=66,mr=28,mt=38,mb=45;
    let loX=xmin===null?Math.min(...all.map(d=>d.x)):xmin,hiX=xmax===null?Math.max(...all.map(d=>d.x)):xmax;
    let loY=ymin===null?Math.min(...all.map(d=>d.y)):ymin,hiY=ymax===null?Math.max(...all.map(d=>d.y)):ymax;
    if(loX===hiX)hiX=loX+1;
    if(loY===hiY)hiY=loY+1;
    const diff=hiY-loY; if(ymin===null)loY=Math.max(0,loY-diff*.09);if(ymax===null)hiY+=diff*.1;
    const x=v=>ml+(v-loX)/(hiX-loX)*(W-ml-mr);
    const y=v=>H-mb-(v-loY)/(hiY-loY)*(H-mt-mb);
    let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(title)}"><rect width="${W}" height="${H}" fill="#fcfdfa"/>`;
    svg+=`<text x="${ml}" y="22" font-size="15" font-family="sans-serif" font-weight="650" fill="#36483e">${escapeHtml(title)}</text>`;
    for(let i=0;i<=4;i++){
      const val=loY+(hiY-loY)*i/4,cy=y(val);
      svg+=`<line x1="${ml}" x2="${W-mr}" y1="${cy}" y2="${cy}" stroke="#e7ece7" stroke-width="1"/>`;
      svg+=`<text x="${ml-10}" y="${cy+4}" font-size="12" fill="#77857c" text-anchor="end">${fmt(val,hiY-loY<5?2:0)}</text>`;
    }
    for(let i=0;i<=5;i++){
      const val=loX+(hiX-loX)*i/5,cx=x(val);
      svg+=`<text x="${cx}" y="${H-18}" font-size="12" fill="#77857c" text-anchor="middle">${fmt(val)}</text>`;
    }
    if(zeroLine && loX<0 && hiX>=0)svg+=`<line x1="${x(0)}" x2="${x(0)}" y1="${mt}" y2="${H-mb}" stroke="#819489" stroke-width="1.8" stroke-dasharray="5,5"/>`;
    dataSets.forEach(set=>{
      const pts=(set.values||[]).filter(v=>Number.isFinite(v.x)&&Number.isFinite(v.y));
      if(!pts.length)return;
      let d=pts.map((pt,i)=>`${i?'L':'M'}${x(pt.x).toFixed(2)},${y(pt.y).toFixed(2)}`).join(' ');
      svg+=`<path d="${d}" fill="none" stroke="${set.color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>`;
      if(pts.length===1)svg+=`<circle cx="${x(pts[0].x)}" cy="${y(pts[0].y)}" r="3.5" fill="${set.color}"/>`;
    });
    svg+=`<text x="${W-mr}" y="${H-4}" font-size="11" fill="#76847b" text-anchor="end">年 ${escapeHtml(unit)}</text>`;
    let legendX=ml;
    dataSets.forEach(s=>{
      const width=28+s.name.length*15;
      svg+=`<line x1="${legendX}" y1="${H-4}" x2="${legendX+17}" y2="${H-4}" stroke="${s.color}" stroke-width="3"/><text x="${legendX+23}" y="${H-1}" font-size="11" fill="#596b60">${escapeHtml(s.name)}</text>`;
      legendX+=width;
    });
    return svg+'</svg>';
  }
  function redrawInputs(changed='') {
    let a=Number($('huntRange').value),b=Number($('fishRange').value);
    if(a+b>100){if(changed==='hunt')b=100-a;else a=100-b;}
    $('huntRange').value=a;$('fishRange').value=b;
    const c=100-a-b,k=Number($('investRange').value);
    $('huntValue').textContent=a+'%'; $('fishValue').textContent=b+'%'; $('riceValue').textContent=c+'%';$('investValue').textContent=k+'%';
    $('allocationBar').innerHTML=`<div style="width:${a}%;background:${colors.hunt}"></div><div style="width:${b}%;background:${colors.fish}"></div><div style="width:${c}%;background:${colors.rice}"></div>`;
    $('laborNote').textContent=`労働力全体の ${fmt(c*(100-k)/100,1)}% が当面の稲作生産に、${fmt(c*k/100,1)}% が水田整備・維持に使われます。`;
    $('investRange').disabled=(c===0);
  }
  function getPlan(){const a=Number($('huntRange').value),b=Number($('fishRange').value);return {shares:[a/100,b/100,(100-a-b)/100],invest:Number($('investRange').value)/100};}
  function resetVisuals(){ $('comparison').hidden=true;$('comparison').innerHTML=''; $('compareBtn').disabled=false; }
  function startGame(){
    const seed=$('seed').value.trim()||randomSeed();
    $('seed').value=seed;
    const p={...M.defaults,years:Number($('years').value),generationYears:Number($('generation').value),historicalYears:Number($('history').value),mode:'stationary'};
    const climate=M.climateSeries(seed,p);
    game={seed,p,climate,records:[],plans:[],state:M.initialState(p),logs:[],currentYear:0};
    $('setup').hidden=true;$('play').hidden=false;$('done').hidden=true;
    resetVisuals();$('huntRange').value=40;$('fishRange').value=40;$('investRange').value=20;
    redrawInputs();render();window.scrollTo({top:330,behavior:'smooth'});
  }
  function render(){
    if(!game)return;
    const {p,state,currentYear,records,climate}=game;
    if(currentYear>=p.years){finish();return;}
    const index=Math.floor(currentYear/p.generationYears);
    const end=Math.min(currentYear+p.generationYears,p.years);
    $('progress').textContent=`シード：${game.seed}　｜　第${index+1}世代 / ${Math.ceil(p.years/p.generationYears)}世代`;
    $('generationTitle').textContent=`第${index+1}世代｜${currentYear}〜${end}年目の選択`;
    $('generationDesc').textContent=`ここまでの経験を確認し、次の${end-currentYear}年間の生業配分を決めてください。`;
    const past=climate.slice(0,p.historicalYears+currentYear);
    $('rainChart').innerHTML=svgPlot([
      {name:'年降水量比',color:colors.annual,values:past.map(c=>({x:c.year,y:c.annual}))},
      {name:'生育期降水量比',color:colors.growing,values:past.map(c=>({x:c.year,y:c.growing}))}
    ],{title:'実際に経験した降水量（平年比）',zeroLine:true,ymin:0});
    $('currentStats').innerHTML=metric('人口',fmt(state.N,1),'人')+metric('食料備蓄',fmt(state.S,1),'単位')+
      metric('水田基盤',fmt(state.K,1),'指標')+metric('累計の食料不足年',fmt(records.filter(r=>r.deficit>1e-8).length),'年');
    renderHistory();
  }
  function renderHistory(){
    if(!game||game.records.length===0){$('timeline').innerHTML='<p class="fine" style="padding:12px">最初の世代を進めると、人口・備蓄・水田基盤の変化が表示されます。</p>';$('stockChart').innerHTML='';$('fieldChart').innerHTML='';$('foodChart').innerHTML='';$('generationLog').innerHTML='';return;}
    const {records,p}=game;
    $('timeline').innerHTML=svgPlot([
      {name:'人口',color:colors.pop,values:[{x:0,y:p.initialPopulation},...records.map(r=>({x:r.year+1,y:r.endN}))]}
    ],{title:'集落人口（人）',ymin:0});
    $('stockChart').innerHTML=svgPlot([
      {name:'食料備蓄',color:colors.stock,values:[{x:0,y:p.initialFood},...records.map(r=>({x:r.year+1,y:r.endS}))]}
    ],{title:'食料備蓄（単位）',ymin:0,ymax:p.storageCapacity});
    $('fieldChart').innerHTML=svgPlot([
      {name:'水田基盤',color:colors.field,values:[{x:0,y:p.initialK},...records.map(r=>({x:r.year+1,y:r.endK}))]}
    ],{title:'水田生産基盤（仮想指標）',ymin:0,ymax:p.fieldMax});
    $('foodChart').innerHTML=svgPlot([
      {name:'食料生産',color:colors.prod,values:records.map(r=>({x:r.year+1,y:r.food}))},
      {name:'食料需要',color:colors.demand,values:records.map(r=>({x:r.year+1,y:r.consumption}))}
    ],{title:'年間食料生産・需要（同じ食料単位）',ymin:0});
    $('generationLog').innerHTML=game.logs.map((log,i)=>`<div class="log-pill"><strong>第${i+1}世代</strong>：人口 ${fmt(log.startN)} → ${fmt(log.endN)} ／ 不足 ${log.short}年</div>`).join('');
  }
  // Advance exactly one decision interval. Reused by the normal and fast-forward buttons.
  function advanceGeneration(plan){
    const startN=game.state.N,from=game.currentYear,to=Math.min(from+game.p.generationYears,game.p.years);
    game.plans.push({shares:[...plan.shares],invest:plan.invest});
    let count=0;
    for(let year=from;year<to;year++) {
      const cl=game.climate[game.p.historicalYears+year];
      const result=M.step(game.state,plan,cl,game.p);
      game.state=result.state;
      game.records.push(result.record);
      if(result.record.deficit>1e-8)count++;
    }
    game.logs.push({startN,endN:game.state.N,short:count});
    game.currentYear=to;
  }
  function showAdvanceResult(){
    render();
    const top=game.currentYear>=game.p.years?$('done'):$('play');
    top.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function advance(){
    if(!game||game.currentYear>=game.p.years)return;
    advanceGeneration(getPlan());
    showAdvanceResult();
  }
  function advanceToEnd(){
    if(!game||game.currentYear>=game.p.years)return;
    const fixedPlan=getPlan();
    // Keep this generation's choice unchanged throughout the remaining years.
    // Do not reveal future climate values or re-optimize after each generation.
    while(game.currentYear<game.p.years)advanceGeneration(fixedPlan);
    showAdvanceResult();
  }
  function finish(){
    $('play').hidden=true;$('done').hidden=false;
    $('progress').textContent=`完了｜${game.p.years}年｜シード：${game.seed}`;
    const x=M.summarize(game.records,game.p.initialPopulation);
    $('done').querySelector('h2').textContent=`${game.p.years}年後、どうなったか`;
    $('summaryStats').innerHTML=
      metric('最終人口',fmt(x.finalN,1),'人')+
      metric('食料不足の年数',x.shortageYears,'年')+
      metric('不足率10%以上の年数',x.seriousShortageYears,'年')+
      metric('最大食料不足率',fmt(x.maximumShortageRate*100,1),'%')+
      metric('最大の年間人口減少率',fmt(x.maximumAnnualPopulationDecline*100,1),'%')+
      metric('最終の備蓄',fmt(x.finalS,1),'単位')+
      metric('最終の水田基盤',fmt(x.finalK,1),'指標');
  }
  function compare(){
    if(!game||game.currentYear<game.p.years)return;
    const modes=[['stationary','定常気候',colors.pop],['dry','長期乾燥化',colors.stock],['wet','長期湿潤化',colors.field]];
    const runs=modes.map(([mode,label,color])=>({mode,label,color,...M.runPlans(game.seed,game.plans,{...game.p,mode})}));
    let html='<h3>同一シード・同一意思決定の比較</h3>';
    html+=svgPlot(runs.map(x=>({name:x.label,color:x.color,values:[{x:0,y:game.p.initialPopulation},...x.records.map(r=>({x:r.year+1,y:r.endN}))]})),{title:'人口推移の比較',ymin:0});
    html+='<div style="overflow-x:auto"><table class="comparison-table"><thead><tr><th>気候条件</th><th>最終人口</th><th>不足年数</th><th>不足率10%以上</th><th>最大不足率</th><th>最大人口減少率</th></tr></thead><tbody>';
    for(const x of runs)html+=`<tr><td>${x.label}</td><td>${fmt(x.summary.finalN,1)}</td><td>${x.summary.shortageYears}</td><td>${x.summary.seriousShortageYears}</td><td>${fmt(x.summary.maximumShortageRate*100,1)}%</td><td>${fmt(x.summary.maximumAnnualPopulationDecline*100,1)}%</td></tr>`;
    html+='</tbody><caption>気候の変更はゲーム開始100年後から徐々に進行します。過去50年の経験は共通です。</caption></table></div>';
    $('comparison').innerHTML=html;$('comparison').hidden=false;
  }
  function downloadCSV(){
    if(!game)return;
    const head=['年','年降水量_平年比','生育期降水量_平年比','人口_年初','人口_年末','備蓄_年初','備蓄_年末','水田基盤_年初','水田基盤_年末','狩猟採集生産','漁労生産','稲作生産','合計食料生産','食料需要','不足量','食料充足率','狩猟採集配分','漁労配分','稲作配分','稲作内整備率'];
    const rows=game.records.map(r=>[r.year+1,r.annual,r.growing,r.N,r.endN,r.S,r.endS,r.K,r.endK,...r.harvest,r.food,r.consumption,r.deficit,r.adequacy,...r.shares,r.invest]);
    const data='\ufeff'+[head,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const blob=new Blob([data],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='livelihood_'+game.seed.replace(/[^a-zA-Z0-9_-]/g,'_')+'.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  }
  $('startBtn').addEventListener('click',startGame);
  $('nextBtn').addEventListener('click',advance);
  $('finishBtn').addEventListener('click',advanceToEnd);
  $('huntRange').addEventListener('input',()=>redrawInputs('hunt'));
  $('fishRange').addEventListener('input',()=>redrawInputs('fish'));
  $('investRange').addEventListener('input',()=>redrawInputs('invest'));
  $('compareBtn').addEventListener('click',compare);
  $('exportBtn').addEventListener('click',downloadCSV);
  $('replayBtn').addEventListener('click',()=>{ $('setup').hidden=false;startGame();});
  $('randomBtn').addEventListener('click',()=>{$('seed').value='';startGame();});
  redrawInputs();
})();
