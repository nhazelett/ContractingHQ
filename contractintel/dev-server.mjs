import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {handle} from './worker/api.mjs';
const root=fileURLToPath(new URL('./web/',import.meta.url));
const db=new DatabaseSync(process.argv[2]||fileURLToPath(new URL('./.runtime/sample-build/dataset.sqlite',import.meta.url)),{readOnly:true});
const env={DB:{prepare:sql=>({bind:(...args)=>({all:async()=>({results:db.prepare(sql).all(...args)})})})}};
createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1:8898');
  if(url.pathname.startsWith('/api/')){const response=await handle(new Request(url,{method:req.method,headers:req.headers}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  let path=decodeURIComponent(url.pathname).replace(/^\/contractintel\/web\//,'/');if(path==='/'||path==='/index.html')path='/index.html';
  const target=resolve(root,'.'+path);
  if(!target.startsWith(root.replace(/[\\/]$/,'')+sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(target),extension=target.split('.').pop();
  res.writeHead(200,{'Content-Type':({html:'text/html',css:'text/css',mjs:'text/javascript'})[extension]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch{res.writeHead(404);res.end('Not found');}}).listen(8898,'127.0.0.1',()=>console.log('ContractIntel preview: http://127.0.0.1:8898/contractintel/web/'));
