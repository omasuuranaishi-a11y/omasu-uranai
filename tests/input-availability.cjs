const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
new vm.Script(source);
const elements=new Map();
const node=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},querySelectorAll(){return [];}});return elements.get(id);};
const ctx=vm.createContext({console,Date,Math,document:{getElementById:node},window:{}});
vm.runInContext(fs.readFileSync('astronomy.browser.min.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('astro.js','utf8'),ctx);
vm.runInContext(source.slice(0,source.indexOf('function drawWheel(')),ctx);
// Isolate rendering from the multi-year search; verify the availability passed to it.
vm.runInContext('pastHardTime=()=>null; themeTurnings=(n,available)=>{globalThis.actualAvailability=available;return []};',ctx);
const themes=vm.runInContext('Object.keys(THEMES)',ctx);
for(const theme of themes){
 ctx.theme=theme;
 const targets=vm.runInContext('themeTargets(buildChart(1988,7,18,12,0,...PREFS["東京都"]),false,theme)',ctx);
 assert(targets.every(t=>t.kind!== 'house' && !['ASC','MC','DSC','IC'].includes(t.name)),'unknown angles in real timing targets');
}
let count=0;
for(const theme of themes)for(const [time,pref] of [[false,''],[false,'東京都'],[true,''],[true,'東京都']]){
 elements.clear();ctx.args=['',1988,7,18,0,0,time,pref,theme];
 vm.runInContext('render(...args)',ctx);
 const expected=time&&!!pref;
 assert.equal(ctx.actualAvailability,expected,theme+' timing availability');
 assert.equal(node('table').innerHTML.includes('>ASC</td>'),expected,theme+' ASC table');
 assert.equal(node('chart').innerHTML.includes('font-size="8"'),expected,theme+' house labels');
 if(!expected){
  assert(!/\d+ハウス/.test(node('table').innerHTML));
  assert(node('chartIntro').innerHTML.includes('そろっていない'));
  assert(!node('pickMer').innerHTML.includes('MC'));
  const mcText=vm.runInContext('MCS[SIGNS[Math.floor(buildChart(1988,7,18,args[6]?0:12,0,...PREFS["東京都"]).mc/30)]].k',ctx);
  const all=[...elements.values()].map(n=>n.innerHTML).join('');
  assert(!all.includes(mcText),theme+' unknown MC trait leaked');
 } else assert(node('subject').innerHTML.includes('0時00分'),'midnight must remain known');
 count++;
}
console.log(`PASS: ${count} renders (8 themes × time/place combinations), including midnight, table, diagram, paid text and timing gates`);
