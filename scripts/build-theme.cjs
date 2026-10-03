const fs=require('node:fs/promises');const path=require('node:path');
async function buildTheme(){
 const root=path.resolve(__dirname,'..');const {build}=await import('vite');
 const out=path.join(root,'.theme-build');
 await build({configFile:false,root:path.join(root,'landing'),base:'/journey/',publicDir:false,build:{outDir:out,emptyOutDir:true,chunkSizeWarningLimit:650,rollupOptions:{output:{manualChunks:{three:['three'],animation:['gsap','gsap/ScrollTrigger','animejs']}}}}});
 const target=path.join(root,'public','journey');
 // Only replace this generated directory, never the application's public directory.
 if(path.dirname(target)!==path.join(root,'public'))throw new Error('Invalid asset output path');
 await fs.mkdir(target,{recursive:true});
 const old=await fs.readdir(target);for(const name of old){if(name==='assets')await fs.rm(path.join(target,name),{recursive:true,force:true});}
 await fs.cp(path.join(out,'assets'),path.join(target,'assets'),{recursive:true});
 await fs.writeFile(path.join(root,'public','landing.html'),(await fs.readFile(path.join(out,'index.html'),'utf8')).trimEnd()+'\n');
 console.log('Landing integrated into public/landing.html; editor HTML preserved.');
}
if(require.main===module)buildTheme().catch(error=>{console.error(error);process.exitCode=1});
module.exports={buildTheme};
