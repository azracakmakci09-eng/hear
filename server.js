const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto"),WebSocket=require("ws");
const PORT=process.env.PORT||3000,PUBLIC=path.join(__dirname,"public"),rooms=new Map();
const uid=()=>crypto.randomBytes(8).toString("hex");
const maps=[
{name:"THE RED CORRIDOR",w:31,h:23,start:{x:2,y:2},exit:{x:28,y:20},walls:[[0,0,31,1],[0,22,31,1],[0,0,1,23],[30,0,1,23],[4,1,1,8],[4,12,1,9],[9,0,1,6],[9,9,1,8],[9,18,1,4],[14,1,1,8],[14,12,1,10],[19,0,1,7],[19,10,1,8],[19,19,1,3],[24,1,1,8],[24,12,1,9],[28,0,1,5],[28,8,1,7],[28,16,1,6],[1,6,4,1],[6,6,4,1],[11,6,3,1],[16,6,3,1],[21,6,3,1],[26,6,4,1],[1,16,4,1],[6,16,4,1],[11,16,4,1],[16,16,4,1],[21,16,4,1],[26,16,4,1]]},
{name:"DROWNED WING",w:31,h:23,start:{x:2,y:20},exit:{x:28,y:2},walls:[[0,0,31,1],[0,22,31,1],[0,0,1,23],[30,0,1,23],[5,3,1,17],[10,0,1,7],[10,10,1,13],[15,3,1,17],[20,0,1,8],[20,11,1,12],[25,3,1,17],[1,5,4,1],[6,5,4,1],[11,5,4,1],[16,5,4,1],[21,5,4,1],[26,5,4,1],[1,17,4,1],[6,17,4,1],[11,17,4,1],[16,17,4,1],[21,17,4,1],[26,17,4,1]]},
{name:"THE FALSE HOUSE",w:31,h:23,start:{x:15,y:2},exit:{x:15,y:20},walls:[[0,0,31,1],[0,22,31,1],[0,0,1,23],[30,0,1,23],[3,3,1,16],[7,3,1,5],[7,12,1,7],[11,0,1,8],[11,11,1,12],[15,5,1,13],[19,0,1,8],[19,11,1,12],[23,3,1,16],[27,3,1,5],[27,12,1,7],[1,7,6,1],[8,7,3,1],[12,7,3,1],[16,7,3,1],[20,7,3,1],[24,7,6,1],[1,15,6,1],[8,15,3,1],[12,15,3,1],[16,15,3,1],[20,15,3,1],[24,15,6,1]]}
];
const itemTemplates=[
{name:"Seventh Bell",digit:7,x:6,y:3},
{name:"Third Eye",digit:3,x:13,y:19},
{name:"Fourth Key",digit:4,x:22,y:9},
{name:"Second Candle",digit:2,x:27,y:19},
{name:"Silent Ribbon",digit:null,x:8,y:11}
];
function blocked(map,x,y){return x<1||y<1||x>=map.w-1||y>=map.h-1||map.walls.some(a=>x>=a[0]&&x<a[0]+a[2]&&y>=a[1]&&y<a[1]+a[3])}
function makeRoom(code){let mi=Math.floor(Math.random()*maps.length),m=maps[mi];let r={code,map:mi,host:null,started:false,loaded:false,players:new Map(),items:itemTemplates.map((q,i)=>({...q,id:i,collected:false})),chat:[],created:Date.now(),monster:{x:m.start.x+9,y:m.start.y+6},ending:false};rooms.set(code,r);return r}
function say(r,from,text,system=false){r.chat.push({from,text:String(text).slice(0,220),system,t:Date.now()});if(r.chat.length>150)r.chat.shift()}
function pub(r){return {code:r.code,map:r.map,started:r.started,items:r.items,ending:r.ending,chat:r.chat.slice(-80),players:[...r.players.values()].map(p=>({...p}))}}
function json(res,c,o){res.writeHead(c,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(o))}
async function getBody(req){return new Promise((ok,bad)=>{let s="";req.on("data",x=>s+=x);req.on("end",()=>{try{ok(s?JSON.parse(s):{})}catch(e){bad(e)}})})}
const srv=http.createServer(async(req,res)=>{
 try{
  let u=new URL(req.url,"http://localhost");
  if(req.method==="GET"&&u.pathname==="/")return fs.createReadStream(path.join(PUBLIC,"index.html")).pipe(res);
  if(req.method==="GET"&&u.pathname.startsWith("/assets/")){let f=path.join(PUBLIC,u.pathname);if(!f.startsWith(PUBLIC)||!fs.existsSync(f))return json(res,404,{error:"not found"});let ext=path.extname(f).toLowerCase(),t={".png":"image/png",".mp3":"audio/mpeg",".mpeg":"audio/mpeg"}[ext]||"application/octet-stream";res.writeHead(200,{"Content-Type":t});return fs.createReadStream(f).pipe(res)}
  if(req.method==="POST"&&u.pathname==="/api/create"){let b=await getBody(req),code;do{code=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(code));let r=makeRoom(code),p={id:uid(),name:(b.name||"Player").slice(0,20),character:+b.character||0,x:maps[r.map].start.x,y:maps[r.map].start.y,alive:true,escaped:false,spectate:false};r.host=p.id;r.players.set(p.id,p);say(r,"SYSTEM","Room created. Invite another player to unlock the door.",true);return json(res,200,{room:pub(r),playerId:p.id})}
  if(req.method==="POST"&&u.pathname==="/api/join"){let b=await getBody(req),r=rooms.get(String(b.code||"").toUpperCase());if(!r)return json(res,404,{error:"Room not found."});if(r.started)return json(res,409,{error:"The game has already started."});let p={id:uid(),name:(b.name||"Player").slice(0,20),character:+b.character||0,x:maps[r.map].start.x,y:maps[r.map].start.y,alive:true,escaped:false,spectate:false};r.players.set(p.id,p);say(r,"SYSTEM",p.name+" joined the lobby.",true);return json(res,200,{room:pub(r),playerId:p.id})}
  if(req.method==="POST"&&u.pathname==="/api/state"){let b=await getBody(req),r=rooms.get(b.code),p=r?.players.get(b.playerId);if(!r||!p)return json(res,404,{error:"Session not found."});
   if(!r.started&&typeof b.character==="number")p.character=b.character;
   if(typeof b.x==="number"&&p.alive&&!p.escaped)p.x=b.x;if(typeof b.y==="number"&&p.alive&&!p.escaped)p.y=b.y;
   if(b.chat)say(r,p.name,b.chat);
   if(b.start&&p.id===r.host&&!r.started&&r.players.size>=2){r.started=true;r.loaded=true;say(r,"SYSTEM","The door is opening... survive the maze.",true)}
   if(b.pickup!=null&&r.started){let it=r.items.find(q=>q.id===b.pickup&&!q.collected);if(it&&Math.hypot(it.x-p.x,it.y-p.y)<1.7)it.collected=true}
   if(b.escaped&&r.started&&!p.escaped){let all=r.items.every(q=>q.collected);if(all&&Math.hypot(maps[r.map].exit.x-p.x,maps[r.map].exit.y-p.y)<1.8){p.escaped=true;p.alive=false;p.spectate=true;say(r,"SYSTEM",p.name+" escaped. Spectate mode enabled.",true);if([...r.players.values()].every(q=>q.escaped||!q.alive&&q.spectate)){r.ending=true}}}
   if(b.respawn&&r.started&&!p.alive&&!p.escaped){p.alive=true;p.x=maps[r.map].start.x;p.y=maps[r.map].start.y;p.spectate=false}
   return json(res,200,{room:pub(r),monster:r.monster})
  }
  if(req.method==="POST"&&u.pathname==="/api/leave"){let b=await getBody(req),r=rooms.get(b.code);if(r){r.players.delete(b.playerId);if(r.host===b.playerId){let n=r.players.values().next().value;r.host=n?.id||null;if(n)say(r,"SYSTEM",n.name+" is now Host.",true)}if(!r.players.size)rooms.delete(r.code)}return json(res,200,{ok:true})}
  let f=path.join(PUBLIC,u.pathname);if(req.method==="GET"&&f.startsWith(PUBLIC)&&fs.existsSync(f)){let ext=path.extname(f),t={".html":"text/html",".js":"text/javascript",".css":"text/css"}[ext]||"application/octet-stream";res.writeHead(200,{"Content-Type":t});return fs.createReadStream(f).pipe(res)}
  json(res,404,{error:"not found"})
 }catch(e){json(res,500,{error:e.message})}
});
srv.listen(PORT,()=>console.log("HEAR running on "+PORT));
const wss=new WebSocket.Server({server:srv});
function broadcast(r){let data=JSON.stringify({type:"state",room:pub(r),monster:r.monster});for(const p of r.players.values())if(p.ws?.readyState===1)p.ws.send(data)}
wss.on("connection",ws=>{ws.on("message",raw=>{try{let b=JSON.parse(raw),r=rooms.get(b.code),p=r?.players.get(b.playerId);if(!r||!p)return;p.ws=ws;if(b.chat)say(r,p.name,b.chat);if(b.ezraChat&&p.id===r.host)say(r,"EZRA",b.ezraChat);broadcast(r)}catch(e){}})});
setInterval(()=>{for(const r of rooms.values()){if(!r.started||r.ending)continue;let m=r.monster,targets=[...r.players.values()].filter(p=>p.alive&&!p.escaped);if(!targets.length)continue;let t=targets.sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0],dx=t.x-m.x,dy=t.y-m.y,d=Math.hypot(dx,dy)||1,s=.028,lm=maps[r.map];if(!blocked(lm,m.x+dx/d*s,m.y))m.x+=dx/d*s;if(!blocked(lm,m.x,m.y+dy/d*s))m.y+=dy/d*s;for(const p of targets){if(Math.hypot(p.x-m.x,p.y-m.y)<.72){p.alive=false;p.spectate=true;p.deathAt=Date.now();say(r,"SYSTEM",p.name+" was caught by Ezra.",true)}}broadcast(r)}},80);
