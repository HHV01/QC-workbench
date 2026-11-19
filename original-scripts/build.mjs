import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const assets={};
for(const [path,file,type] of [
 ['/','index.html','text/html'],['/style.css','style.css','text/css'],
 ['/app.js','app.js','text/javascript'],['/rd-data.js','rd-data.js','text/javascript']
]){
 assets[path]={body:await readFile('web/'+file,'utf8'),type};
}
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\n'+await readFile('worker/index.js','utf8'));
