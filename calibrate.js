const M = require('./model.js');
const strategies={
  balanced:{shares:[.4,.4,.2],invest:.2},
  diverse:{shares:[.4,.35,.25],invest:.25},
  huntfish:{shares:[.5,.5,0],invest:0},
  riceheavy:{shares:[.1,.1,.8],invest:.25},
  riceonly:{shares:[0,0,1],invest:.2},
  investmentheavy:{shares:[.15,.15,.7],invest:.45},
  allhunt:{shares:[1,0,0],invest:0},
  allfish:{shares:[0,1,0],invest:0}
};
function median(xs) { xs=[...xs].sort((a,b)=>a-b); return xs[Math.floor(xs.length*.5)]}
for(const mode of ['stationary','dry','wet']){
  console.log('\n',mode);
  for (const [name,plan] of Object.entries(strategies)) {
    const rows=Array.from({length:120},(_,i)=>M.runPlans('ensemble'+i,[plan],{mode}).summary);
    console.log(name.padEnd(16), 'median pop',median(rows.map(r=>r.finalN)).toFixed(1).padStart(6),
      'median shortages', median(rows.map(r=>r.shortageYears)).toFixed(0).padStart(3),
      'pop 10-90', [12,108].map(i=>[...rows.map(r=>r.finalN)].sort((a,b)=>a-b)[i].toFixed(0)).join('..'),
      'collapse', rows.filter(r=>r.collapsed).length);
  }
}
