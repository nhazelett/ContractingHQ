export function money(value, compact=false) {
  if (value===null || value===undefined) return 'Not reported';
  const cents=BigInt(value), negative=cents<0n, absolute=negative?-cents:cents;
  if(compact && absolute>=100000000n) return (negative?'−':'')+'$'+(Number(absolute)/100000000).toLocaleString('en-US',{maximumFractionDigits:2})+'M';
  if(compact && absolute>=100000n) return (negative?'−':'')+'$'+(Number(absolute)/100000).toLocaleString('en-US',{maximumFractionDigits:1})+'K';
  return (negative?'−':'')+'$'+(absolute/100n).toLocaleString('en-US')+'.'+String(absolute%100n).padStart(2,'0');
}
export function csvCell(value) {
  let text=String(value??'');
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text)&&!/^-[0-9]+(\.[0-9]+)?$/.test(text))) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function dollars(cents) {
  if(cents==null) return '';
  const n=BigInt(cents), a=n<0n?-n:n;
  return (n<0n?'-':'')+String(a/100n)+'.'+String(a%100n).padStart(2,'0');
}
export const text=value=>value===null||value===undefined||value===''?'Not reported':String(value);
export function coveredFiscalYear(dataset,fy){return dataset.coverage_start<=`${fy}-09-30`&&dataset.coverage_end>=`${fy-1}-10-01`;}
