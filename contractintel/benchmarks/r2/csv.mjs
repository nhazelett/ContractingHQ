// Execute the existing export function with a captured Blob; no duplicate CSV implementation.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {csvCell,dollars,portfolioStatus,totalPop,daysRemaining,contractEnd} from '../../web/format.mjs';
import {lifecycle} from '../../web/lifecycle.mjs';
import {scopeRows} from '../../web/presentation.mjs';
import {selectRows} from '../../web/register.mjs';
import {PILOT,digest} from './core.mjs';
export async function csvBytes(records,{scope='all',basis='current',today}={}){
 const app=await fs.readFile(new URL('../../web/app.mjs',import.meta.url),'utf8'),fields=/const fields=(\[.*?\]);/s.exec(app)?.[1],producer=/^function exportLoaded\(\)\{.*\}$/m.exec(app)?.[0];
 if(!fields||!producer)throw new Error('Original CSV producer changed; benchmark needs review.');
 let captured;const context=vm.createContext({state:{rows:selectRows(scopeRows(records,scope,today),{basis,today}),scope,office:PILOT.office},csvCell,dollars,portfolioStatus,totalPop,daysRemaining,contractEnd,lifecycle,Blob,Date,URL:{createObjectURL(blob){captured=blob;return 'memory:csv';},revokeObjectURL(){}},el:()=>({click(){}}),setTimeout(){}});
 vm.runInContext('const fields='+fields+';'+producer+';exportLoaded();',context);if(!captured)throw new Error('Original export did not produce a CSV.');return captured.text();
}
export async function compareCSV(left,right,today){const results=[];for(const scope of ['active','completed','review','all'])for(const basis of ['current','potential']){const a=await csvBytes(left,{scope,basis,today}),b=await csvBytes(right,{scope,basis,today});results.push({scope,basis,bytes:Buffer.byteLength(a),sha256:await digest(a),match:a===b});}return results;}
