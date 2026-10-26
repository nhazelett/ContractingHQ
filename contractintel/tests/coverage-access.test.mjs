import test from 'node:test';
import assert from 'node:assert/strict';
import {accessAllowed,protectedCoverage} from '../worker/access.mjs';
import {fetchProtected} from '../worker/entry.mjs';
const b64=bytes=>Buffer.from(bytes).toString('base64url'),encode=value=>b64(Buffer.from(JSON.stringify(value)));
test('Cloudflare Access verifies signature, issuer, exact application audience and expiry',async()=>{
 const now=Date.now(),issuer='https://fixture-authority.cloudflareaccess.com',env={COVERAGE_ACCESS_ISSUER:issuer,COVERAGE_ACCESS_PAGE_AUD:'page',COVERAGE_ACCESS_DATA_AUD:'data'};
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='fixture';let reads=0;
 const fetcher=async url=>{reads++;assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 const token=async changes=>{const header=encode({alg:'RS256',kid:'fixture'}),payload=encode({iss:issuer,aud:['page'],exp:Math.floor(now/1000)+3600,iat:Math.floor(now/1000),...changes}),signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(header+'.'+payload));return header+'.'+payload+'.'+b64(signature);};
 const request=(jwt,path='/coverage.html')=>new Request('https://site'+path,{headers:{'Cf-Access-Jwt-Assertion':jwt}});
 assert.equal(await accessAllowed(request(await token({})),env,{fetcher,now:()=>now}),true);
 assert.equal(await accessAllowed(request(await token({aud:['data']}),'/api/office/coverage/details'),env,{fetcher,now:()=>now}),true);
 assert.equal(reads,1,'Public signing keys are cached');
 for(const changes of [{iss:'https://evil.invalid'},{aud:['other']},{exp:0},{nbf:Math.floor(now/1000)+3600}]){
  assert.equal(await accessAllowed(request(await token(changes)),env,{fetcher,now:()=>now}),false);
 }
 const good=await token({}),parts=good.split('.');parts[2]=b64(new Uint8Array(256));
 assert.equal(await accessAllowed(request(parts.join('.')),env,{fetcher,now:()=>now}),false);
 assert.equal(await accessAllowed(request(good),{}, {fetcher,now:()=>now}),false);
});
test('Both coverage page aliases and detailed API fail closed before assets or data can run',async()=>{
 let assets=0;const env={ASSETS:{fetch:async()=>{assets++;return new Response('public asset');}}};
 for(const path of ['/coverage','/coverage.html','/coverage/','/%63overage.html','/api/office/coverage/details','/api//office/coverage/details']){
  assert.equal(protectedCoverage(path),true,path);
  const response=await fetchProtected(new Request('https://site'+path),env,{});assert.equal(response.status,403,path);
  assert.match(response.headers.get('Cache-Control'),/no-store/);
 }
 assert.equal(assets,0);assert.equal(protectedCoverage('/api/office/coverage'),false);
 assert.equal((await fetchProtected(new Request('https://site/'),env,{})).status,200);
 assert.equal((await fetchProtected(new Request('https://site/api/status'),env,{})).status,200);
});
