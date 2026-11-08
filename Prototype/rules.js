import { randomInt, randomUUID } from 'node:crypto';

export const DECK = ['+1 glonț', '+2 gloanțe', '+3 gloanțe', '−1 glonț', 'Schimb', 'Fură', 'Mystery Bullet', 'Reverse', 'Sudden Death', 'Steal', 'Skip Turn', 'Double Risk', 'Reveal', 'Steal Card'];
const targeted = new Set(['Schimb', 'Fură', 'Steal', 'Skip Turn', 'Reveal', 'Steal Card']);
const ordinary = card => card.startsWith('+') || card.startsWith('−');
export function description(card) {
  return ({
    '+1 glonț':'Încarci 2 gloanțe în această tură.', '+2 gloanțe':'Încarci 3 gloanțe în această tură.',
    '+3 gloanțe':'Încarci 4 gloanțe în această tură.', '−1 glonț':'Pierzi un glonț din rezervă; încarci unul.',
    'Schimb':'Schimbi câte un glonț aleatoriu cu adversarul ales.', 'Fură':'Iei un cartonaș obișnuit din mâna adversarului.',
    'Mystery Bullet':'Primești un glonț cu efect ascuns și încarci unul.',
    'Reverse':'Efectul următorului glonț special revine la cel care trage.',
    'Sudden Death':'La următoarea împușcătură, un glonț încărcat devine adevărat.',
    'Steal':'Furi un glonț aleatoriu din rezerva adversarului.', 'Skip Turn':'Adversarul ales pierde următoarea tură.',
    'Double Risk':'Dacă următoarea împușcătură este goală sau oarbă, pierzi două ture.',
    'Reveal':'Vezi în privat numărul gloanțelor adversarului.', 'Steal Card':'Iei un cartonaș special din mâna adversarului.'
  })[card] || 'Trage un cartonaș pentru a începe tura.';
}

// Regulile se execută numai pe server. Browserul trimite intenții și primește starea permisă.
export class Rules {
  constructor(rng = max => randomInt(max)) {
    this.rng=rng; this.code=String(100000+rng(900000)); this.players=[]; this.history=[];
    this.cylinder=Array(6).fill(null); this.stage='lobby'; this.active=0; this.turn=0;
    this.card=''; this.message='Așteptăm 2–4 jucători.'; this.winner=''; this.privateInfo='';
    this.required=1; this.targetIndex=-1; this.reverse=false; this.sudden=false; this.doubleRisk=false;
    this.recent=new Map(); this.resultAt=0;
  }
  get current() {return this.players[this.active] || null;}
  get loaded() {return this.cylinder.filter(Boolean).length;}
  get started() {return this.stage !== 'lobby';}
  authenticate(token) {return typeof token==='string' && token ? this.players.find(p=>p.token===token) : null;}
  bullet(mystery=true) {
    const n=this.rng(100);
    return {id:randomUUID(),kind:n<12?'Real':n<55?'Blank':n<80?'Smoke':'Shock',mystery};
  }
  log(message) {this.message=message; this.history.unshift(message); this.history.length=Math.min(this.history.length,30);}
  join(code,name,local=false,now=Date.now()) {
    if(code!==this.code)return {error:'Codul camerei este greșit.'};
    if(this.started)return {error:'Partida a început. Așteaptă revenirea în lobby.'};
    if(this.players.length>=4)return {error:'Camera are deja 4 jucători.'};
    name=String(name??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18);
    if(!name)return {error:'Scrie un nume.'};
    if(this.players.some(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return {error:'Numele este deja folosit.'};
    const player={id:randomUUID(),token:randomUUID(),name,local,lastSeen:now,ammo:[],cards:[],skip:0,wins:0};
    this.players.push(player);this.log(name+' a intrat în cameră.');return {player};
  }
  start() {
    if(!['lobby','finished'].includes(this.stage))return 'Partida este deja pornită.';
    if(this.players.length<2||this.players.length>4)return 'Ai nevoie de 2–4 jucători.';
    for(const p of this.players){p.ammo=Array.from({length:6},()=>this.bullet());p.cards=['+1 glonț','Reveal'];p.skip=0;}
    this.cylinder.fill(null);this.active=this.rng(this.players.length);this.turn=1;this.winner='';this.card='';this.privateInfo='';
    this.reverse=this.sudden=this.doubleRisk=false;this.targetIndex=-1;this.required=1;this.stage='draw';this.resultAt=0;this.recent.clear();
    this.log('Partida începe. Este tura lui '+this.current.name+'.');return '';
  }
  lobby() {
    this.stage='lobby';this.winner=this.card=this.privateInfo='';this.active=0;this.targetIndex=-1;this.cylinder.fill(null);this.recent.clear();this.resultAt=0;
    this.log('Camera este deschisă. Jucătorii pot intra.');
  }
  remove(id) {
    if(this.stage!=='lobby')return 'Poți elimina jucători doar în lobby.';
    const i=this.players.findIndex(p=>p.id===id);if(i<0)return 'Jucător necunoscut.';
    const [p]=this.players.splice(i,1);this.log(p.name+' a ieșit.');return '';
  }
  act(cmd, now=Date.now()) {
    const p=this.authenticate(cmd?.token);if(!p)return 'Sesiune necunoscută. Intră din nou.';
    const key=p.id+':'+String(cmd.requestId??'');
    if(cmd.requestId&&this.recent.has(key))return this.recent.get(key);
    const error=this.apply(p,cmd,now);
    if(cmd.requestId){this.recent.set(key,error);while(this.recent.size>256)this.recent.delete(this.recent.keys().next().value);}
    return error;
  }
  apply(p,cmd,now) {
    if(['lobby','finished'].includes(this.stage))return 'Partida nu este în desfășurare.';
    if(p!==this.current)return 'Așteaptă tura ta.';
    const slot=cmd.slot;
    switch(cmd.action){
      case 'draw':case 'useCard':
        if(this.stage!=='draw')return 'Ai deja un cartonaș pentru această tură.';
        if(cmd.action==='useCard'){
          const i=p.cards.indexOf(cmd.bullet);if(i<0)return 'Nu ai acest cartonaș în mână.';
          this.card=p.cards.splice(i,1)[0];
        }else this.card=DECK[this.rng(DECK.length)];
        this.privateInfo='';if(targeted.has(this.card))this.stage='cardTarget';else this.resolve(null);
        this.log(p.name+' a tras un cartonaș secret.');return '';
      case 'applyCard':{
        if(this.stage!=='cardTarget')return 'Cartonașul nu așteaptă o țintă.';
        const other=this.players.find(x=>x.id===cmd.target);if(!other||other===p)return 'Alege un adversar.';
        this.resolve(other);return '';
      }
      case 'take':
      case 'open':
        return 'Roata este pregătită automat după cartonaș.';
      case 'load':{
        if(this.stage!=='load')return 'Deschide roata înainte de încărcare.';
        if(!Number.isInteger(slot)||slot<0||slot>=6||this.cylinder[slot])return 'Alege un loc liber.';
        if(this.loaded>=this.required)return 'Ai încărcat toate gloanțele cerute.';
        const i=p.ammo.findIndex(b=>b.id===cmd.bullet);if(i<0)return 'Glonțul nu este în rezerva ta.';
        this.cylinder[slot]=p.ammo.splice(i,1)[0];return '';
      }
      case 'unload':
        if(this.stage!=='load'||!Number.isInteger(slot)||slot<0||slot>=6||!this.cylinder[slot])return 'Nu poți scoate glonțul acum.';
        p.ammo.push(this.cylinder[slot]);this.cylinder[slot]=null;return '';
      case 'close':
        if(this.stage!=='load')return 'Roata nu este deschisă.';
        if(this.loaded!==this.required)return 'Încarcă exact '+this.required+' gloanțe.';
        this.stage='decision';this.log(p.name+' a încărcat roata.');return '';
      case 'skip':
        if(this.stage!=='decision')return 'Alege după ce ai încărcat roata.';
        this.stage='result';this.resultAt=now;this.log(p.name+' a dat skip.');return '';
      case 'chooseShoot':
        if(this.stage!=='decision')return 'Alege după ce ai încărcat roata.';
        this.stage='aim';this.targetIndex=-1;this.log(p.name+' a ales să tragă.');return '';
      case 'target':{
        if(this.stage!=='aim')return 'Închide roata înainte să alegi ținta.';
        const i=this.players.findIndex(x=>x.id===cmd.target&&x!==p);
        if(i<0)return 'Alege un adversar.';this.targetIndex=i;return '';
      }
      case 'shoot':
        if(this.stage!=='aim'||this.targetIndex<0||!this.players[this.targetIndex]||this.players[this.targetIndex]===p)return 'Alege ținta înainte să tragi.';
        this.shoot(now);return '';
      case 'next':
        if(this.stage!=='result')return 'Încă nu s-a terminat tura.';this.next();return '';
      default:return 'Acțiune necunoscută.';
    }
  }
  resolve(other) {
    const p=this.current;this.required=1;
    switch(this.card){
      case '+1 glonț':this.required=2;break;case '+2 gloanțe':this.required=3;break;case '+3 gloanțe':this.required=4;break;
      case '−1 glonț':if(p.ammo.length)p.ammo.splice(this.rng(p.ammo.length),1);break;
      case 'Mystery Bullet':p.ammo.push(this.bullet());break;
      case 'Reverse':this.reverse=true;break;case 'Sudden Death':this.sudden=true;break;case 'Double Risk':this.doubleRisk=true;break;
      case 'Skip Turn':other.skip++;break;
      case 'Reveal':this.privateInfo=other.name+' are '+other.ammo.length+' gloanțe în rezervă.';break;
      case 'Steal':if(other.ammo.length)p.ammo.push(other.ammo.splice(this.rng(other.ammo.length),1)[0]);else this.privateInfo='Adversarul nu are gloanțe.';break;
      case 'Schimb':
        if(p.ammo.length&&other.ammo.length){const a=this.rng(p.ammo.length),b=this.rng(other.ammo.length);[p.ammo[a],other.ammo[b]]=[other.ammo[b],p.ammo[a]];}else this.privateInfo='Schimbul nu este posibil: o rezervă este goală.';break;
      case 'Fură':case 'Steal Card':{
        const options=other.cards.filter(c=>ordinary(c)===(this.card==='Fură'));
        if(options.length&&p.cards.length<6){const card=options[this.rng(options.length)];other.cards.splice(other.cards.indexOf(card),1);p.cards.push(card);this.privateInfo='Ai luat: '+card;}
        else this.privateInfo='Nu există un cartonaș potrivit sau mâna ta este plină.';break;
      }
    }
    while(p.ammo.length<this.required)p.ammo.push(this.bullet());this.stage='load';
  }
  shoot(now) {
    const index=this.rng(6),shot=this.cylinder[index];
    if(this.sudden){const loaded=this.cylinder.filter(Boolean);loaded[this.rng(loaded.length)].kind='Real';}
    const affected=this.reverse?this.current:this.players[this.targetIndex];let result;
    const miss=!shot||shot.kind==='Blank';
    if(!shot)result='CLICK! Cameră goală.';
    else if(shot.kind==='Real'){this.winner=this.current.name;this.current.wins++;this.stage='finished';result='BANG! '+this.winner+' a tras glonțul adevărat și câștigă!';}
    else if(shot.kind==='Smoke'){affected.skip++;result='PUF! '+affected.name+' pierde o tură din cauza fumului.';}
    else if(shot.kind==='Shock'){if(affected.ammo.length)affected.ammo.splice(this.rng(affected.ammo.length),1);result='ZAP! '+affected.name+' pierde un glonț din rezervă.';}
    else result='POC! Glonț orb. Partida continuă.';
    if(miss&&this.doubleRisk){this.current.skip+=2;result+=' Double Risk: pierzi două ture.';}
    for(let i=0;i<6;i++){if(this.cylinder[i]&&i!==index)this.current.ammo.push(this.cylinder[i]);this.cylinder[i]=null;}
    if(this.stage!=='finished')this.stage='result';this.resultAt=now;this.reverse=this.sudden=this.doubleRisk=false;this.log(result);
  }
  next() {
    let guard=0;
    do{this.active=(this.active+1)%this.players.length;if(!this.current.skip)break;this.current.skip--;this.log(this.current.name+' pierde această tură.');guard++;}while(guard<100);
    this.turn++;this.stage='draw';this.card=this.privateInfo='';this.targetIndex=-1;this.required=1;this.resultAt=0;
    while(this.current.ammo.length<4)this.current.ammo.push(this.bullet());this.log('Tura '+this.turn+': '+this.current.name+'.');
  }
  view(token,now=Date.now()) {
    const me=this.authenticate(token),mine=Boolean(me&&me===this.current&&this.started);
    return {
      ok:Boolean(me),token:me?.token||'',code:this.code,started:this.started,stage:this.stage,isTurn:mine,canStart:this.players.length>=2&&this.stage==='lobby',
      turn:this.turn,activeName:this.current?.name||'',myId:me?.id||'',myName:me?.name||'',card:mine?this.card:'',cardText:mine?description(this.card):'',
      privateInfo:mine?this.privateInfo:'',message:this.message,winner:this.winner,required:mine?this.required:0,loaded:this.loaded,targetIndex:mine?this.targetIndex:-1,
      reverse:mine&&this.reverse,sudden:mine&&this.sudden,doubleRisk:mine&&this.doubleRisk,
      players:this.players.map(p=>({id:p.id,name:p.name,ammo:-1,skip:p.skip,wins:p.wins,connected:p.local||now-p.lastSeen<8000,local:p.local})),
      ammo:me?me.ammo.map(b=>({id:b.id,label:b.mystery?'Mister':({Real:'Adevărat',Smoke:'Fum',Shock:'Șoc',Blank:'Orb'})[b.kind]})):[],
      hand:me?[...me.cards]:[],chambers:this.cylinder.map(b=>b?'•':'')
    };
  }
}
