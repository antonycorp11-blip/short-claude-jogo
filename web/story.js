import { M, camFromKeys, idle, blinkAt, q, clamp } from './motion.js';
import { TL } from './timeline.js';
// TL.sent[i] = [f0, f1] for the 11 spoken sentences; TL.keys = named key-word frames; TL.total = frame count.
export const FPS=30, TOTAL=TL.total, DECK=0;
const S=TL.sent, KY=TL.keys;
// One shot per sentence; shot 0 is the silent intro before the first word.
const cuts=[0,...S.slice(1).map(s=>s[0]-4)];
const lightOf=['day','day','day','day','day','day','day','golden','night','night','night'];
export const SHOTS=S.map((s,i)=>({id:i+1,a:cuts[i],b:(i<S.length-1?cuts[i+1]-1:TOTAL-1),light:lightOf[i]}));
export const shotAt=f=>SHOTS.find(s=>f>=s.a&&f<=s.b)||SHOTS[SHOTS.length-1];
export const LIGHTS={
 day:{az:120,el:48,sky:'#d6e6ff',ground:'#8a795b',hemi:1.45,sun:'#fff2d4',sunI:2.3,fog:'#cde3fa',fogNear:42,fogFar:190,skyTop:'#4e9cdd',skyHor:'#d6ebff',sat:1.16,waterDeep:'#2c6c8c',waterShal:'#5aaec4',glint:'#effaff',vig:.16,shadowExt:24},
 golden:{az:35,el:16,sky:'#f3c9ae',ground:'#866957',hemi:1.4,sun:'#ffd28e',sunI:2.6,fog:'#f4d4ad',fogNear:40,fogFar:180,skyTop:'#976ca0',skyHor:'#ffe0a5',sat:1.16,waterDeep:'#425b82',waterShal:'#d99a6e',glint:'#ffe2a8',vig:.2,shadowExt:24},
 night:{az:150,el:42,sky:'#708cb5',ground:'#394d6d',hemi:1.35,sun:'#b9d6ff',sunI:1.5,fog:'#819cbe',fogNear:35,fogFar:150,skyTop:'#253c76',skyHor:'#a6bee0',sat:1.14,waterDeep:'#263f6b',waterShal:'#6482a6',glint:'#dce8ff',vig:.25,shadowExt:24}
};
export const lightFor=s=>LIGHTS[s.light];
// Camera framings around the desk (creator at x=-3,z=2.2; monitor centre y=2.45,z=-.85).
// WIDE: creator + whole monitor. SCREEN: monitor fills the frame, creator's head at the bottom. CU: face close-up.
const WIDE={pos:[-3,2.3,7.4],look:[-3,1.95,0],fov:46};
const SCREEN={pos:[-3,2.55,5.9],look:[-3,2.35,-.5],fov:47};
const CU={pos:[-3,1.95,4.6],look:[-3,1.75,2.2],fov:34};
const k=(f,v,extra={})=>({f,...v,...extra});
const camKeys=s=>{
 const [a,b]=[s.a,s.b],m=Math.round((a+b)/2);
 switch(s.id){
  case 1: return [k(a,WIDE),k(b,{...WIDE,pos:[-3,2.35,6.6],fov:44})];          // hook: slow push
  case 2: return [k(a,SCREEN),k(b,{...SCREEN,pos:[-3,2.55,5.6]})];               // the game appears
  case 3: return [k(a,SCREEN),k(b,{...SCREEN,pos:[-3,2.55,5.5]})];               // levels
  case 4: return [k(a,SCREEN),k(KY.nome-6,{...SCREEN,pos:[-3,2.5,5.4]}),k(KY.nome+4,{...SCREEN,pos:[-3,2.45,5.4],roll:2}),k(b,{...SCREEN,pos:[-3,2.45,5.4]})];
  case 5: return [k(a,WIDE),k(b,{...WIDE,pos:[-3,2.3,6.8]})];                    // posts online
  case 6: return [k(a,SCREEN),k(b,{...SCREEN,pos:[-3,2.55,5.3]})];               // 100k
  case 7: return [k(a,SCREEN),k(b,{...SCREEN,pos:[-3,2.5,5.45]})];                // email
  case 8: return [k(a,{...SCREEN,pos:[-3,2.5,6.3]}),k(b,{...SCREEN,pos:[-3,2.5,5.8]})];                       // opens chat (reaction)
  case 9: return [k(a,SCREEN),k(b,{...SCREEN,pos:[-3,2.45,5.4],roll:-2})];       // AI reply: sting push-in
  case 10:return [k(a,{...SCREEN,pos:[-3,2.5,6.2]}),k(b,{...SCREEN,pos:[-3,2.5,5.7]})]; // choice
  default:return [k(a,SCREEN),k(b,{...SCREEN,pos:[-3,2.55,5.7]})];               // CTA
 }
};
export const camAt=f=>{
 const s=shotAt(f),c=camFromKeys(camKeys(s),f,{kicks:[{f:KY.nome,a:.04},{f:KY.cemmil,a:.04},{f:KY.parte2,a:.06}]});
 c.flash=0; return c;
};
export const dofAt=f=>{const s=shotAt(f);return {focus:5.5,cinf:4,near:1};};
const P=(f,a,b)=>clamp((f-a)/Math.max(1,b-a));
export const worldAt=f=>{
 const s=shotAt(f),id=s.id;
 const w={mine:[0,0,0,0,0,0],rh:0,chairs:0,f};
 if(id===1){w.screen='chat';w.typing=P(f,KY.digitou-10,KY.digitou+40);w.reply=0;}
 else if(id===2){w.screen=f<KY.nave-4?'chat':'game';w.typing=1;w.reply=P(f,s.a,s.a+15);}
 else if(id===3){w.screen='levels';w.first=P(f,s.a+4,s.a+14);w.pops=P(f,KY.cinco-12,KY.cinco+6);}
 else if(id===4){w.screen='dragon';w.enter=P(f,KY.dragao-20,KY.dragao+4);w.talk=f>=KY.nome-3?1:0;}
 else if(id===5){w.screen='posted';w.count=P(f,s.a+8,KY.mil+4);}
 else if(id===6){w.screen='viral';w.count=P(f,s.a,KY.cemmil+4);}
 else if(id===7){w.screen='email';w.slide=P(f,KY.email-12,KY.email+6);}
 else if(id===8){w.screen='chat';w.typing=0;}
 else if(id===9){w.screen='reply';w.msg=P(f,s.a-2,s.a+8);}
 else if(id===10){w.screen='choice';w.cta=false;}
 else {w.screen='choice';w.cta=true;}
 return w;
};
const actor=(T,key,f,pos,opts={},extra={})=>{const seed=opts.seed||3;const o={...idle(f,seed),blink:blinkAt(f,seed),...opts};for(const kk of ['tilt','headTilt','bob','step','swirl']) if(o[kk]!==undefined)o[kk]=q(o[kk],2);return {key:key+JSON.stringify(o),draw:p=>T.romanFront(p,key,o),x:pos[0],y:pos[1],z:pos[2],...extra};};
export const actorsAt=(f,T)=>{
 const s=shotAt(f),id=s.id,out=[];
 const you=(opts={})=>out.push(actor(T,'CRIADOR',f,[-3,0,2.2],{seed:3,expr:'smile',...opts}));
 if(id===1) you({expr:f>=KY.digitou?'smile':'neutral',R:'point'});
 if(id===2) you({expr:f>=KY.nave?'shock':'neutral',R:f>=KY.nave?'cheek':'point',headTilt:f>=KY.nave?5:undefined});
 if(id===3) you({expr:f>=KY.cinco?'shock':'smile',R:f>=KY.cinco?'up':'point'});
 if(id===4) you({expr:f>=KY.nome?'shock':'smile',L:f>=KY.nome?'cheek':'hang',R:f>=KY.nome?'cheek':'point'});
 if(id===5) you({expr:'smile',R:'thumb',L:'hip'});
 if(id===6) you({expr:'shock',R:'up',L:'up',bob:q(.02*Math.sin(f*.5),2)});
 if(id===7) you({expr:f>=KY.hoje?'shock':'neutral',R:f>=KY.hoje?'cheek':'hang'});
 if(id===8) you({expr:'nervous',R:'cheek'});
 if(id===9) you({expr:'shock',L:'cheek',R:'cheek'});
 if(id===10) you({expr:'squint',R:'cheek'});
 if(id===11) you({expr:'smile',R:'point'});
 return out;
};
export const fxAt=()=>[];
