// Literal words/phrases and -exclusions; user FTS operators never pass through.
export function searchTerms(query){
 const include=[],exclude=[];let rest=query.trim(),count=0;
 while(rest){
  const negative=rest.startsWith('-');if(negative)rest=rest.slice(1);
  let value;
  if(rest.startsWith('"')){const end=rest.indexOf('"',1);if(end<0)throw new Error('Close the quotation marks around your search phrase.');value=rest.slice(1,end);rest=rest.slice(end+1);if(rest&&!/^\s/.test(rest))throw new Error('Separate search words and quoted phrases with a space.');}
  else{const match=rest.match(/^[^\s"]+/);if(!match)throw new Error('Enter a search word or a quoted phrase.');value=match[0];rest=rest.slice(value.length);if(rest.startsWith('"'))throw new Error('Separate search words and quoted phrases with a space.');}
  if(!/[\p{L}\p{N}]/u.test(value))throw new Error('Enter a title word or solicitation number.');
  if(++count>24)throw new Error('Use at most 24 search words or phrases.');
  (negative?exclude:include).push('"'+value.replaceAll('"','""')+'"');rest=rest.trimStart();
 }
 return {include:include.join(' AND '),exclude:exclude.join(' OR ')};
}
