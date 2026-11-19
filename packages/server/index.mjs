import http from 'node:http';
import {listSystems,assessSystem,verifyAudit} from '../core/index.mjs';
export function createGovernanceServer({root='.',token}){
 if(!token||String(token).length<24) throw new Error('A token of at least 24 characters is required');
 const buckets=new Map();
 return http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
  const ip=req.socket.remoteAddress||''; if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)){res.writeHead(403,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'loopback clients only'}));}
  const minute=Math.floor(Date.now()/60000), bucket=buckets.get(ip); if(!bucket||bucket.minute!==minute)buckets.set(ip,{minute,count:1});else if(++bucket.count>120){res.writeHead(429,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'rate limit exceeded'}));}
  if(req.headers.origin){res.writeHead(403,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'CORS disabled'}));}
  if(req.method!=='GET'){res.writeHead(405,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'read-only API'}));}
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'unauthorized'}));}
  const url=new URL(req.url,'http://127.0.0.1'); let data;
  try{
   if(url.pathname==='/health') data={ok:true,mode:'read-only'};
   else if(url.pathname==='/systems') data=listSystems(root).map(s=>({id:s.id,name:s.name,lifecycle:s.lifecycle,owner:s.owner}));
   else if(url.pathname.startsWith('/systems/')){const id=decodeURIComponent(url.pathname.slice('/systems/'.length));data=assessSystem(root,id);}
   else if(url.pathname==='/audit/verify') data=verifyAudit(root);
   else {res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'not found'}));}
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
 });
}
