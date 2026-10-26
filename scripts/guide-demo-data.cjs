// Demonstration archive for the guide video. Text is placeholder, clearly marked as such.
function rng(seed){return()=>{seed=(seed+0x6d2b79f5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
module.exports = function demo(){
  const r=rng(7);
  const groups=[['light','attention','walking','city'],['memory','winter','music','home'],['mathematics','language','work','sleep'],['trees','silence','light','walking']];
  const regs=['observation','question','memory','argument','fragment'];
  const sentence='Demonstration text for the guide; your own words appear here.';
  const entries=[];let d=Date.UTC(2026,4,2);
  for(let i=0;i<60;i++){
    d+=86400000*(1+Math.floor(r()*3));
    const g=groups[Math.floor(r()*groups.length)];
    const k=1+Math.floor(r()*3);const t=new Set();while(t.size<k)t.add(g[Math.floor(r()*g.length)]);
    if(r()<0.15)t.add(groups[Math.floor(r()*4)][Math.floor(r()*4)]);
    const n=2+Math.floor(r()*r()*40);let body='';for(let j=0;j<n;j++)body+=sentence+(j%5===4?'\n\n':' ');
    const date=new Date(d).toISOString();
    entries.push({id:'d'+i,plate:i+1,date:date.slice(0,10),title:r()<0.75?'Example plate '+String(i+1).padStart(3,'0'):'',body:body.trim(),tags:[...t],register:regs[Math.floor(r()*5)],createdAt:date,updatedAt:date,annotations:[]});
  }
  const q=(id,num,text,ids)=>({id,number:num,text,notes:'',createdAt:entries[num*10].createdAt,updatedAt:entries[num*10].createdAt,entryIds:ids,settled:false});
  return {version:1,entries,questions:[q('dq1',1,'Example question (one)',['d3','d12','d27']),q('dq2',2,'Example question (two)',['d8','d40'])],studies:[],settings:{theme:'ink',lastReadId:null},counters:{plate:60,question:2}};
};
