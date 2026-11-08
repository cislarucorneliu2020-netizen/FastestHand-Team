import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Rules } from './rules.js';

const publicRoot=new URL('./',import.meta.url);
const files={'/':'index.html','/index.html':'index.html','/controller':'index.html','/controller.html':'index.html'};
const type={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};

export function createGame({rng}={}) {
  const rules=new Rules(rng),hostKey=randomBytes(32).toString('hex');
  let screen='menu';let settings={volume:.7,resultDelay:4};const joins=new Map();
  function addresses(port) {
    let ips=[];
    try{ips=Object.values(networkInterfaces()).flat().filter(n=>n&&!n.internal&&n.family==='IPv4').map(n=>n.address);}catch{}
    if(!ips.length)ips=['localhost'];
    return [...new Set(ips)].map(ip=>'http://'+ip+':'+port+'/controller');
  }
  function hostView() {
    const v=rules.view(null);delete v.token;
    const localView=rules.current?.local?rules.view(rules.current.token):null;
    if(localView)delete localView.token;
    return {...v,ok:true,screen,settings:{...settings},targetIndex:rules.targetIndex,required:rules.required,
      addresses:addresses(server.address()?.port),history:rules.history.slice(0,5),activeId:rules.current?.id||'',localView};
  }
  function phoneView(token) {
    const v=rules.view(token);
    if(screen==='menu'){v.stage='menu';v.started=v.isTurn=v.canStart=false;v.message='Gazda este în meniu. Așteaptă lobby-ul.';}
    return v;
  }
  function reply(res,status,value) {
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify(value));
  }
  function authorized(key) {return typeof key==='string'&&key===hostKey;}
  async function body(req) {
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Error('Trimite JSON.');
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>4096)throw Error('Cerere prea mare.');chunks.push(chunk);}
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Cerere invalidă.');return value;
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://'+req.headers.host);
      if(url.pathname.startsWith('/api/')){
        if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return reply(res,403,{ok:false,error:'Origine nepermisă.'});
        if(url.pathname==='/api/host/state'&&req.method==='GET'){
          if(!authorized(req.headers['x-host-key']))return reply(res,403,{ok:false,error:'Deschide linkul GAZDĂ din terminal.'});
          return reply(res,200,hostView());
        }
        if(url.pathname==='/api/state'&&req.method==='GET'){
          const token=url.searchParams.get('token'),p=rules.authenticate(token);
          if(!p)return reply(res,200,{ok:false,error:'Sesiune expirată. Intră din nou.'});
          p.lastSeen=Date.now();return reply(res,200,phoneView(token));
        }
        if(req.method!=='POST')return reply(res,405,{ok:false,error:'Metodă nepermisă.'});
        const data=await body(req);
        if(url.pathname==='/api/host/action'){
          if(!authorized(req.headers['x-host-key']))return reply(res,403,{ok:false,error:'Doar gazda poate face asta.'});
          let error='';
          switch(data.action){
            case 'lobby':rules.lobby();screen='lobby';break;
            case 'menu':rules.lobby();screen='menu';break;
            case 'start':error=rules.start();if(!error)screen='match';break;
            case 'addLocal':{
              if(screen!=='lobby'){error='Deschide lobby-ul.';break;}
              const joined=rules.join(rules.code,data.name,true);error=joined.error||'';break;
            }
            case 'remove':error=rules.remove(data.id);break;
            case 'settings':{
              if(!Number.isFinite(data.volume)||!Number.isFinite(data.resultDelay)){error='Setări invalide.';break;}
              settings={volume:Math.min(1,Math.max(0,data.volume)),resultDelay:Math.min(8,Math.max(2,data.resultDelay))};break;
            }
            case 'control':
              if(screen!=='match'||!rules.current?.local){error='Acest jucător folosește telefonul.';break;}
              error=rules.act({...data.command,token:rules.current.token});break;
            default:error='Acțiune necunoscută.';
          }
          return reply(res,200,{...hostView(),ok:!error,error});
        }
        if(url.pathname==='/api/join'){
          let p=rules.authenticate(data.token);
          const joinId=typeof data.requestId==='string'?data.requestId.slice(0,100):'';
          if(!p&&joinId)p=rules.authenticate(joins.get(joinId));
          if(!p){
            if(screen!=='lobby')return reply(res,200,{ok:false,error:'Gazda trebuie să apese Play și să deschidă lobby-ul.'});
            const result=rules.join(String(data.code??''),data.name,false);
            if(result.error)return reply(res,200,{ok:false,error:result.error});p=result.player;
            if(joinId){joins.set(joinId,p.token);while(joins.size>128)joins.delete(joins.keys().next().value);}
          }
          p.lastSeen=Date.now();return reply(res,200,phoneView(p.token));
        }
        if(url.pathname==='/api/action'){
          const p=rules.authenticate(data.token);if(!p)return reply(res,200,{ok:false,error:'Sesiune expirată. Intră din nou.'});
          p.lastSeen=Date.now();const error=screen==='match'?rules.act(data):'Așteaptă pornirea partidei.';
          return reply(res,200,{...phoneView(p.token),ok:!error,error});
        }
        return reply(res,404,{ok:false,error:'Adresă necunoscută.'});
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{ok:false,error:'Metodă nepermisă.'});
      const file=files[url.pathname];if(!file)return reply(res,404,{ok:false,error:'Pagină necunoscută.'});
      const bytes=await readFile(new URL(file,publicRoot));
      res.writeHead(200,{'Content-Type':type[file.split('.').at(-1)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){if(!res.headersSent)reply(res,400,{ok:false,error:'Cerere invalidă.'});else res.end();}
  });
  server.requestTimeout=8000;server.headersTimeout=10000;
  const timer=setInterval(()=>{if(screen==='match'&&rules.stage==='result'&&Date.now()-rules.resultAt>=settings.resultDelay*1000)rules.next();},100);
  timer.unref();server.on('close',()=>clearInterval(timer));
  return {server,rules,hostKey,hostView,phoneView};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  // resolve() works for both Windows and Linux entry point paths.
  const app=createGame();let port=Number(process.env.PORT)||8888,attempt=0;
  app.server.on('error',error=>{
    if(error.code==='EADDRINUSE'&&attempt++<9){port++;app.server.listen(port,'0.0.0.0');}
    else{console.error('Nu pot porni serverul:',error.message);process.exitCode=1;}
  });
  app.server.on('listening',()=>{
    console.log('\nFASTEST HAND — VS CODE / BROWSER');
    console.log('GAZDĂ (deschide pe PC): http://localhost:'+port+'/?host='+app.hostKey);
    for(const address of app.hostView().addresses)console.log('TELEFON: '+address);
    console.log('Apasă PLAY în browser pentru lobby. Ctrl+C oprește serverul.\n');
  });
  app.server.listen(port,'0.0.0.0');
  process.on('SIGINT',()=>app.server.close(()=>process.exit(0)));
}
