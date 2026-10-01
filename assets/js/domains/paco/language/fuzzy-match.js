import { normalizePacoText } from "./normalize.js";

export function editDistance(a,b){
  const x=normalizePacoText(a),y=normalizePacoText(b);
  if(x===y)return 0;
  if(!x)return y.length;
  if(!y)return x.length;
  const row=Array.from({length:y.length+1},(_,i)=>i);
  for(let i=1;i<=x.length;i++){
    let prev=row[0];
    row[0]=i;
    for(let j=1;j<=y.length;j++){
      const old=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(x[i-1]===y[j-1]?0:1));
      prev=old;
    }
  }
  return row[y.length];
}

export function fuzzyWord(word,target){
  const a=normalizePacoText(word),b=normalizePacoText(target);
  if(!a||!b)return false;
  if(a===b||a.includes(b)||b.includes(a))return true;
  const min=Math.min(a.length,b.length),max=Math.max(a.length,b.length);
  if(min<=3)return false;
  const distance=editDistance(a,b);
  if(min===4)return distance<=1;
  return distance<=Math.max(1,Math.floor(max*.30));
}

export function fuzzyPhrase(text,phrase){
  const a=normalizePacoText(text),b=normalizePacoText(phrase);
  if(!a||!b)return false;
  if(a.includes(b))return true;
  const words=a.split(" ").filter(Boolean);
  const targets=b.split(" ").filter(Boolean);
  return targets.every(target=>words.some(word=>fuzzyWord(word,target)));
}

export function matchesAny(text,aliases=[]){
  return aliases.some(alias=>fuzzyPhrase(text,alias));
}
