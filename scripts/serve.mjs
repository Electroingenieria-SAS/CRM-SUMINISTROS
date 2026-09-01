import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const port=Number(process.env.PORT||4173);
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",".ico":"image/x-icon",".csv":"text/csv; charset=utf-8"};
const headers={
  "Cache-Control":"no-store",
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "X-Frame-Options":"DENY"
};
const safePath=urlPath=>{
  const decoded=decodeURIComponent(urlPath.split("?")[0]);
  const rel=decoded==="/"?"index.html":decoded.replace(/^\/+/,"");
  const full=path.resolve(root,rel);
  return full.startsWith(root+path.sep)?full:null;
};
http.createServer((req,res)=>{
  if(!["GET","HEAD"].includes(req.method||"")){res.writeHead(405,headers);return res.end("Method Not Allowed");}
  let file=safePath(req.url||"/");
  if(!file){res.writeHead(400,headers);return res.end("Bad Request");}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,"index.html");
  const ext=path.extname(file).toLowerCase();
  res.writeHead(200,{...headers,"Content-Type":mime[ext]||"application/octet-stream"});
  if(req.method==="HEAD")return res.end();
  fs.createReadStream(file).pipe(res);
}).listen(port,"127.0.0.1",()=>console.log(`ERP EI local: http://127.0.0.1:${port}`));
