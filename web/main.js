import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';

const SCALE = Math.max(.25,Math.min(1,Number(new URLSearchParams(location.search).get('scale')||1)));
const W=Math.round(1080*SCALE),H=Math.round(1920*SCALE);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  rot: texM(P.rotten(4), 1, 1), rotB: texM(P.rotten(14), 1, 1),
  stone: texM(P.stone(4), 1, 1), stoneMoss: texM(P.mossy(P.stone(4), 5, 1.2), 1, 1),
  grass: texM(P.grass(6), 40, 40), dirt: texM(P.dirt(7), 6, 30), plaster: texM(P.plaster(8), 1, 1), plaster2: texM(P.plaster(18, 28), 1, 1),
  roof: texM(P.roof(9), 2, 2), marble: texM(P.marble(10), 1, 1), marbleTop: toon({ color: '#ece2cf' }),
  trunk: toon({ color: '#6a4a32' }), cypress: toon({ color: '#3f6b36' }), pine: toon({ color: '#5c8a3c' }), bush: toon({ color: '#6c9a42' }),
  hill: toon({ color: '#7aa64c' }), hillFar: toon({ color: '#86ad60' }), mount: toon({ color: '#8fa7b8' }), snow: toon({ color: '#f4f6fa' }),
  iron: toon({ color: '#5c5a57' }), bronze: toon({ color: '#b08a4a' }), wood: toon({ color: '#7a5434' }), door: toon({ color: '#5a3a24' }),
  window: toon({ color: '#2b2430' }), red: toon({ color: '#b8282b' }),
};
M.banner = new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(P.banner()), alphaTest: 0.5, side: THREE.DoubleSide });
// helmet
const helmetIn = P.tex(P.helmetInside()); helmetIn.wrapS = helmetIn.wrapT = THREE.ClampToEdgeWrapping;
M.helmIn = new THREE.MeshToonMaterial({ gradientMap: grad, map: helmetIn, side: THREE.BackSide });
M.helmOut = toon({ color: '#8f8a7e' });

// ---------- ink / normal-depth contract ----------
const NOINK = 'noink'; // userData flag: never outlined (cards, fx, water handled specially)
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.5,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const uvScale = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
/** box with world-scaled UVs per face (texel density 1 tile per `t` metres) */
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- world ----------
const DECK=0;
const world=new THREE.Group();scene.add(world);
const solid=c=>toon({color:c});
const wood=texM(P.planks(3)), beam=texM(P.beam(4)), dirt=texM(P.dirt(5)), grass=texM(P.grass(6));
const dark=solid('#262c39'), gold=solid('#f8c44e'), ore=solid('#617087'), blue=solid('#67d9f4'), orange=solid('#e3903c');
add(tbox(80,.3,80,3),grass,0,-.19,-10,world,{cast:false});
const desk=new THREE.Group();desk.position.set(-3,0,0);world.add(desk);
add(tbox(3.8,.18,1.55,.7),wood,0,1.05,.7,desk);
for(const x of [-1.65,1.65])for(const z of [.15,1.25])add(tbox(.16,1,.16,.6),beam,x,.5,z,desk);
add(tbox(1.25,.055,.42,.5),dark,0,1.17,1.03,desk);
for(let i=0;i<12;i++)add(box(.065,.01,.04),solid('#aab8c6'),-.48+i*.09,1.207,1.03,desk,{cast:false});
add(new THREE.CylinderGeometry(.13,.13,.3,12),solid('#f1e0b8'),1.25,1.28,1,desk);
const handle=add(new THREE.TorusGeometry(.11,.025,7,12),solid('#f1e0b8'),1.39,1.3,1,desk);handle.rotation.y=Math.PI/2;
// The creator stands in front of the desk. A foreground chair used to cut
// through the flat character card, so this workstation has no chair.
const monitor=new THREE.Group();monitor.position.set(-3,2.45,-.85);world.add(monitor);
add(box(3.5,2.7,.22),dark,0,0,0,monitor);
add(box(3.22,2.42,.015),solid('#43506d'),0,0,.13,monitor,{cast:false});
const screenCanvas=document.createElement('canvas');screenCanvas.width=900;screenCanvas.height=680;
const screenTex=new THREE.CanvasTexture(screenCanvas);screenTex.colorSpace=THREE.SRGBColorSpace;
const screen=add(new THREE.PlaneGeometry(3.08,2.28),new THREE.MeshBasicMaterial({map:screenTex,side:THREE.DoubleSide}),0,0,.151,monitor,{cast:false});
const monitorGlow=add(new THREE.PlaneGeometry(3.18,2.38),new THREE.MeshBasicMaterial({color:'#81c9ff',transparent:true,opacity:.05,side:THREE.DoubleSide}),0,0,.155,monitor,{cast:false});
function drawScreen(S,f){
 const g=screenCanvas.getContext('2d'),w=900,h=680,p=S.p||0,sc=S.screen;
 const R=(x,y,ww,hh,c)=>{g.fillStyle=c;g.fillRect(x,y,ww,hh);};
 const T=(t,x,y,size=36,c='#e8f6fb',al='left')=>{g.textAlign=al;g.fillStyle=c;g.font=`bold ${size}px Arial`;g.fillText(t,x,y);g.textAlign='left';};
 const ease=t=>t<0?0:t>1?1:1-Math.pow(1-t,3);
 const bubble=(t,x,y,ww,hh,c,tc,size=34)=>{R(x,y,ww,hh,c);const lines=t.split('\n');lines.forEach((l,i)=>T(l,x+24,y+48+i*(size+10),size,tc));};
 const chatFrame=(title)=>{R(0,0,w,h,'#141c2b');R(0,0,w,70,'#22304a');T(title,450,48,32,'#b9cde6','center');R(0,610,w,70,'#1d2739');R(30,622,760,46,'#2a3650');R(806,622,64,46,'#d9773f');T('➤',820,656,30,'#fff');};
 if(sc==='chat'){ // user types the request, AI starts working
  chatFrame('CHAT COM A IA');
  const msg='Cria um jogo pra mim.';const n=Math.floor(msg.length*Math.min(1,S.typing||0));
  if((S.typing||0)<1){ // big prompt box in the middle so the typing reads on a phone
   T('O que você quer criar?',450,190,44,'#8fa3c2','center');
   R(80,250,740,130,'#22304a');g.strokeStyle='#d9773f';g.lineWidth=5;g.strokeRect(80,250,740,130);
   T(msg.slice(0,n)+(f%16<8?'▌':''),110,333,52,'#ffffff');
   T(msg.slice(0,n),48,654,28,'#e8eef8');}
  else{bubble(msg,300,120,540,100,'#d9773f','#fff',44);
   const k=ease(S.reply||0);if(k>0){g.globalAlpha=k;bubble('Claro! Gerando\nseu jogo'+'.'.repeat(1+Math.floor(f/8)%3),70,270,560,150,'#2e3f5c','#e8eef8',44);g.globalAlpha=1;}}
 }
 const stars=()=>{R(0,0,w,h,'#070b1e');for(let i=0;i<60;i++){const x=(i*137)%w,y=((i*251)+f*(2+i%4)*3)%h;R(x,y,i%7?3:5,i%7?3:5,'#cfe3ff');}};
 const ship=(x,y,s=1)=>{g.fillStyle='#7fe0ff';g.beginPath();g.moveTo(x,y-34*s);g.lineTo(x+26*s,y+24*s);g.lineTo(x-26*s,y+24*s);g.closePath();g.fill();R(x-8*s,y+24*s,16*s,10+6*Math.sin(f*.9),'#ffb347');};
 if(sc==='game'){ // little shooter, playing itself
  stars();const sx=450+220*Math.sin(f*.06);ship(sx,560);
  for(let i=0;i<4;i++){const ex=150+i*200+40*Math.sin(f*.05+i),ey=140+30*Math.sin(f*.08+i*2);R(ex-30,ey-18,60,36,'#ff5d7a');R(ex-12,ey+18,24,10,'#ff5d7a');}
  for(let i=0;i<5;i++){const by=520-((f*14+i*90)%420);R(sx-3,by,6,22,'#fff59a');}
  T('NAVE IA',70,60,38,'#7fe0ff');T('PONTOS '+String(1200+f*7).padStart(6,'0'),830,60,36,'#fff59a','right');
 }
 if(sc==='levels'){ // 1 level requested, 5 pop in
  R(0,0,w,h,'#101a33');T('SELECIONE A FASE',450,110,52,'#ffe27a','center');
  for(let i=0;i<5;i++){const k=ease((S.pops||0)*5-i);if(k<=0)continue;const x=95+i*150,y=300,s=110*k;R(x+55-s/2,y+55-s/2,s,s,['#3fa7ff','#38c98a','#f2b03a','#e2577a','#9b6bff'][i]);if(k>.6)T(String(i+1),x+55,y+75,54,'#fff','center');}
  if((S.pops||0)>.2)T('Você pediu 1. A IA fez 5.',450,540,46,'#ffffff','center');
 }
 if(sc==='dragon'){ // boss that says your name
  R(0,0,w,h,'#1c0d24');for(let i=0;i<8;i++)R(i*120,600-((i*53)%40),120,80,'#3b1630');
  const dy=250+12*Math.sin(f*.12),k=ease(S.enter||0),dx=450+(1-k)*500;
  g.fillStyle='#3cc06a';g.beginPath();g.ellipse(dx,dy,170,110,0,0,7);g.fill();
  g.beginPath();g.moveTo(dx-120,dy-60);g.lineTo(dx-260,dy-160-20*Math.sin(f*.2));g.lineTo(dx-60,dy-90);g.fill();
  g.beginPath();g.moveTo(dx+120,dy-60);g.lineTo(dx+260,dy-160-20*Math.sin(f*.2+1));g.lineTo(dx+60,dy-90);g.fill();
  R(dx-70,dy-40,34,34,'#fff');R(dx+36,dy-40,34,34,'#fff');R(dx-58,dy-30,14,18,'#111');R(dx+48,dy-30,14,18,'#111');
  R(dx-60,dy+40,120,16,'#7a1d2c');
  if((S.talk||0)>0){bubble('Olá...\nEU SEI SEU NOME.',120,410,660,150,'#fff6d8','#3a1020',48);}
  T('CHEFÃO FINAL',450,70,46,'#ff8a8a','center');
 }
 if(sc==='posted'||sc==='viral'){ // player counter racing up
  R(0,0,w,h,'#0f1f2e');
  if(sc==='viral')for(let i=0;i<30;i++){const x=(i*97+f*5)%w,y=(i*61+f*(6+i%5))%h;g.globalAlpha=.75;R(x,y,10,16,['#ffe27a','#ff5d7a','#7fe0ff','#38c98a'][i%4]);g.globalAlpha=1;}
  T('JOGO PUBLICADO',450,100,48,'#9fe3b0','center');
  const target=sc==='posted'?1000:100000;const v=Math.floor(target*ease(S.count||0));
  T('JOGADORES ONLINE',450,215,42,'#d6e4f2','center');T(v.toLocaleString('pt-BR'),450,370,sc==='viral'?140:130,sc==='viral'?'#ffe27a':'#ffffff','center');
  R(120,430,660,34,'#20384d');R(120,430,660*ease(S.count||0),34,sc==='viral'?'#ffb347':'#38c98a');
  T(sc==='posted'?'NA 1ª HORA':'NO DIA SEGUINTE',450,540,46,'#ffffff','center');
 }
 if(sc==='email'){ // offer from a fictional big studio
  R(0,0,w,h,'#eef1f6');R(0,0,w,70,'#c9d3e2');T('CAIXA DE ENTRADA',450,48,32,'#3a4a63','center');
  const k=ease(S.slide||0);const y=110+(1-k)*500;R(70,y,760,440,'#ffffff');g.strokeStyle='#c9d3e2';g.lineWidth=3;g.strokeRect(70,y,760,440);
  T('De: MEGA GAMES S.A.',100,y+60,36,'#3a4a63');T('Assunto: Proposta urgente',100,y+108,34,'#4a5a75');R(100,y+132,700,3,'#dde3ec');
  T('Queremos comprar',100,y+215,58,'#1d2a40');T('o seu jogo. HOJE.',100,y+290,58,'#c13948');T('$ $ $',100,y+385,60,'#2f8f5b');
 }
 if(sc==='reply'){ // AI answered before you asked
  chatFrame('CHAT COM A IA');
  const k=ease(S.msg||0);if(k>0){g.globalAlpha=k;bubble('Não vende.\nEu já comecei\na parte dois.',70,140+(1-k)*40,640,210,'#2e3f5c','#ffffff',50);g.globalAlpha=1;}
  T('(você ainda não digitou nada)',450,450,36,'#9fb0c8','center');T(f%16<8?'▌':'',48,654,28,'#e8eef8');
 }
 if(sc==='choice'){ // vender ou continuar
  R(0,0,w,h,'#141c2b');T('E AGORA?',450,105,68,'#ffe27a','center');
  const pulse=1+.04*Math.sin(f*.3);
  R(70,170,360,290,'#2f8f5b');T('$',250,310,130,'#fff','center');T('VENDER',250,420,50*pulse,'#fff','center');
  R(470,170,360,290,'#3b6fd8');R(560,230,180,80,'#fff');R(585,260,40,14,'#3b6fd8');R(598,247,14,40,'#3b6fd8');R(685,250,16,16,'#3b6fd8');R(707,272,16,16,'#3b6fd8');T('CONTINUAR',650,420,46*pulse,'#fff','center');
  if(S.cta){T('COMENTA AÍ:',450,525,42,'#ffe27a','center');T('a parte 2 depende de você',450,578,40,'#e8eef8','center');}else T('Qual você escolhe?',450,535,46,'#e8eef8','center');
 }
 screenTex.needsUpdate=true;
}
// Mine components pop individually while the hills and distant pines remain a continuous backdrop.
const mineParts=[];
const part=(x,y,z)=>{const v=new THREE.Group();v.position.set(x,y,z);world.add(v);mineParts.push(v);return v;};
const hill=part(2,0,-19);
const h=add(new THREE.SphereGeometry(8,24,12),solid('#78a654'),0,-3.8,-1,hill,{cast:false});h.scale.set(1.25,.8,.85);
const cave=add(new THREE.SphereGeometry(2.45,24,12),dark,0,1.1,.6,hill);cave.scale.set(1,1.55,.18);
const tunnel=part(2,0,-18.0);
for(const x of [-2.05,2.05])add(tbox(.35,3.8,.45,.5),beam,x,1.9,0,tunnel);
add(tbox(4.6,.45,.5,.5),beam,0,3.7,0,tunnel);
function textPlane(text,w,h,fg,bg,x,y,z,parent){const c=document.createElement('canvas');c.width=512;c.height=160;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,512,160);g.strokeStyle='#3c2c23';g.lineWidth=17;g.strokeRect(8,8,496,144);g.fillStyle=fg;g.font='900 90px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,84);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return add(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}),x,y,z,parent,{cast:false});}
// The tunnel arch itself identifies the mine; a high sign was cropped by
// several moving cameras and is intentionally omitted.
const rails=part(2,0,-12);
for(const x of [-.7,.7])add(tbox(.08,.08,10,.4),solid('#6d747d'),x,.055,1,rails);
for(let i=0;i<13;i++)add(tbox(1.9,.1,.27,.6),wood,0,.01,5.6-i*.75,rails);
// The track occupied the actors' feet and the final creator reveal.
rails.visible=false;
const cart=part(4.8,0,-14.6);
add(tbox(1.8,.9,1.2,.6),solid('#6d7480'),0,.86,0,cart);
for(const x of [-.65,.65])for(const z of [-.42,.42]){const wh=add(new THREE.CylinderGeometry(.21,.21,.12,12),dark,x,.27,z,cart);wh.rotation.z=Math.PI/2;}
for(let i=0;i<6;i++)add(new THREE.DodecahedronGeometry(.3,0),i%2?gold:ore,(i%3-.8)*.48,1.38,(Math.floor(i/3)-.5)*.45,cart);
const rocks=part(2,0,-17);
for(let i=0;i<12;i++){const x=(i%6-2.5)*1.25,z=Math.floor(i/6)*1.8-1.6;add(new THREE.DodecahedronGeometry(.38+(i%3)*.09,0),ore,x,.28,z,rocks);if(i%2===0)add(new THREE.ConeGeometry(.16,.6,5),i%4?blue:gold,x+.2,.72,z,rocks);}
const lanterns=part(2,0,-12);
for(const x of [-3.4,3.4]){add(new THREE.CylinderGeometry(.08,.1,2.6,8),beam,x,1.3,2,lanterns);add(box(.45,.6,.4),gold,x,2.7,2,lanterns);add(box(.6,.1,.5),dark,x,3.05,2,lanterns);}
const booth=part(5,0,-14.3); // driven separately from mineParts
mineParts.pop();
add(tbox(2.7,2.7,2.2,1),M.plaster,0,1.35,0,booth);
add(tbox(3,.3,2.5,.7),orange,0,2.85,0,booth);
add(box(1,.9,.06),dark,0,1.45,1.14,booth);
const boothSign=textPlane('RH',1.5,.53,'#4e3544','#f4ead2',0,2.43,1.17,booth);
const chairs=new THREE.Group();world.add(chairs);
function chair(x,z,col){const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=.32;chairs.add(c);
  // Low, long chaise silhouette. Performers stand at least 0.6 m in front.
  add(tbox(.95,.12,1.75,.5),solid(col),0,.38,.15,c);
  const back=add(tbox(.95,.12,1.0,.5),solid(col),0,.82,-.65,c);back.rotation.x=-.78;
  for(const sx of [-.39,.39])for(const zz of [-.43,.76])add(tbox(.08,.5,.08),beam,sx,.22,zz,c);
}
chair(.45,-14.2,'#66bcd0');chair(1.45,-14.2,'#f5ca58');chair(2.75,-14.2,'#e892a3');chair(3.55,-14.2,'#95c36d');
const clouds=[];
for(let i=0;i<6;i++){const x=-25+i*10,z=-55-(i%2)*9;for(let j=0;j<3;j++){const c=add(new THREE.SphereGeometry(1.4,12,8),solid('#eff7fc'),x+j*.9,10+(i%3)*1.8,z,world,{cast:false});c.scale.set(1.6,.6,.7);}}
for(let i=0;i<8;i++){const x=-30+i*9;const m=add(new THREE.ConeGeometry(6+(i%3)*2,14+(i%3)*2,5),solid('#8ba9b9'),x,5,-55-i%3*5,world,{cast:false});add(new THREE.ConeGeometry(2.4,3.7,5),solid('#eef7fa'),x,12+(i%3),-55-i%3*5,world,{cast:false});}
for(let i=0;i<15;i++){const x=-24+i*3.5,z=-27-(i%3)*2;if(Math.abs(x-2)<4)continue;add(new THREE.CylinderGeometry(.13,.18,1.7,6),beam,x,.85,z,world);for(let j=0;j<3;j++)add(new THREE.ConeGeometry(1.25-j*.19,2.3,7),solid(i%2?'#3b775b':'#4e8b68'),x,2+j*.8,z,world,{cast:false});}
// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25; // canvas px, card height in metres (design 600x1000 -> 2.25 m)
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(scale = 1) {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;            // character cards: never outlined by the world ink
      if (card) ds = 1e4;                        // sky
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));                           // depth jump, near side only
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9); // crease
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), flash);
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
// final copy with sRGB handled by the renderer output (we render to screen with linear->sRGB in the shader chunk)
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
}
function placeSun(L, focus) {
  // sun direction from azimuth/elevation in world space
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(S,f){
 mineParts.forEach((p,i)=>{const k=Math.max(0,S.mine[i]);p.visible=k>.001;p.scale.setScalar(k);});
 rails.visible=false;
 if(shotAt(f).id===10)cart.visible=false;
 booth.visible=S.rh>.001 && shotAt(f).id!==10;booth.scale.setScalar(Math.max(0,S.rh));
 boothSign.visible=!(shotAt(f).id===5 && f>=750);
 chairs.visible=S.chairs>.001;chairs.scale.setScalar(Math.max(0,S.chairs));
 drawScreen(S,f);
 monitorGlow.material.opacity=.05+.025*Math.sin(f*.15);
}

function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < DECK + 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? DECK) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const W_ = worldAt(f); worldState(W_, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  // pass A: colour
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass B: normal + depth
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  // ink + grade
  const D = dofAt(f);
  inkU.px.value = 2.5*SCALE; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf*SCALE; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
