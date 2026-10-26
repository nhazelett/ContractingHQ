// Access JWT validation is required because Static Assets routing does not forward ctx.access.
import {CONFIG} from '../portfolio/ingest.mjs';
const caches=new Map(),encoder=new TextEncoder();
function decode(value){const padded=value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4);return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));}
export function protectedCoverage(path){
 try{path=decodeURIComponent(path).replace(/\/{2,}/g,'/');}catch{return true;}
 return /^\/coverage(?:[./]|$)/.test(path)||/^\/api\/office\/coverage\/details(?:\/|$)/.test(path);
}
export async function accessAllowed(request,env,{fetcher=fetch,now=Date.now}={}){
 const path=new URL(request.url).pathname,issuer=env.COVERAGE_ACCESS_ISSUER,audience=path.includes('/api/')?env.COVERAGE_ACCESS_DATA_AUD:env.COVERAGE_ACCESS_PAGE_AUD,token=request.headers.get('Cf-Access-Jwt-Assertion')||'';
 if(!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!audience||token.length>CONFIG.access.maxTokenBytes)return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1]))),seconds=now()/1000;
  if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer||![claims.aud].flat().includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=seconds-CONFIG.access.clockSkewSeconds||claims.nbf!==undefined&&claims.nbf>seconds+CONFIG.access.clockSkewSeconds||claims.iat!==undefined&&claims.iat>seconds+CONFIG.access.clockSkewSeconds)return false;
  let cached=caches.get(issuer);
  if(!cached||cached.until<=now()){
   const response=await fetcher(issuer+'/cdn-cgi/access/certs',{redirect:'error',signal:AbortSignal.timeout(CONFIG.access.timeoutMs)});
   if(!response.ok)return false;
   const reader=response.body.getReader(),parts=[];let length=0;
   for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>CONFIG.access.maxJwksBytes){await reader.cancel();return false;}parts.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
   const jwks=JSON.parse(new TextDecoder().decode(bytes));if(!Array.isArray(jwks.keys)||jwks.keys.length>CONFIG.access.maxKeys)return false;
   cached={keys:jwks.keys,until:now()+CONFIG.access.jwksCacheMs};caches.set(issuer,cached);
  }
  const key=cached.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));if(!key)return false;
  const cryptoKey=await crypto.subtle.importKey('jwk',{kty:key.kty,n:key.n,e:key.e},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5',cryptoKey,decode(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
 }catch{return false;}
}
