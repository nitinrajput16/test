// Local presentation preview only. Not imported by the production server.
const express=require('express');const http=require('node:http');const path=require('node:path');const fs=require('node:fs');const ejs=require('ejs');const {Server}=require('socket.io');const {fixtures,user,fileList}=require('./theme-fixtures.cjs');
function createPreview(){
 const root=path.resolve(__dirname,'..');const app=express();app.use(express.json());app.use(express.urlencoded({extended:false}));
 const sampleBanner='<div style="position:fixed;left:12px;bottom:12px;z-index:90;font:10px system-ui;background:#1d2830;color:#d8fa72;border:1px solid #36444d;padding:6px 10px;border-radius:5px">LOCAL PREVIEW · sample data</div>';
 const html=file=>fs.readFileSync(path.join(root,'public',file),'utf8').replace('</body>',sampleBanner+'</body>');
 const render=(page,extra={})=>async(req,res,next)=>{try{const body=await ejs.renderFile(path.join(root,'src/views',page+'.ejs'),fixtures({...extra,themeV2:req.query.legacy!=='1'}));res.send(body.replace('</body>',sampleBanner+'</body>'));}catch(error){next(error);}};
 app.get(['/', '/landing'],(req,res)=>res.send(html('landing.html')));
 app.get('/login',render('login',{title:'Sign in — Codeplat',message:'Welcome back. Your workspace is ready.'}));app.get(['/signup','/auth/signup'],render('signup',{title:'Create account — Codeplat'}));
 app.get('/profile',render('profile'));app.get('/profile/:key',render('profile',{viewingOther:true}));app.get('/dashboard',(_req,res)=>res.redirect('/profile'));app.get('/dashboard-legacy',render('dashboard'));
 app.get('/admin',render('dashboard',{admin:true,title:'Admin — Codeplat'}));app.get('/whiteboard',render('whiteboard'));app.get('/error-preview',render('error',{error:{},message:'The workspace could not load. Please try again.',title:'Workspace unavailable'}));app.get('/404-preview',render('404',{title:'Page not found'}));
 app.get('/editor',(req,res)=>res.send(html(req.query.legacy==='1'?'index-legacy.html':'index.html').replace('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min','http://127.0.0.1:5175/monaco-editor/min').replaceAll('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min','http://127.0.0.1:5175/monaco-editor/min').replace('/vs/loader.min.js','/vs/loader.js')));
 app.get('/auth/status',(_req,res)=>res.json({authenticated:true,user}));
 app.get('/api/code/list',(_req,res)=>res.json({files:fileList}));app.get('/api/code/load',(_req,res)=>res.json(fileList[0]));app.get('/api/editor/today',(_req,res)=>res.json({seconds:5040,totalSeconds:5040,time:'1h 24m'}));app.post('/api/editor/activity',(_req,res)=>res.json({ok:true}));app.get('/api/dashboard',(_req,res)=>res.json({stats:{filesSaved:2,todaysCoding:'1h 24m',streak:7},recentFiles:fileList}));
 // Fixture actions have no persistence or external side effects.
 app.use(['/api','/profile','/auth','/admin'],(req,res,next)=>{if(req.method==='GET')return next();res.status(503).json({error:'This is a presentation preview. Connect a development backend to perform this action.'});});
 app.use('/vendor/fontawesome',express.static(path.join(root,'node_modules/@fortawesome/fontawesome-free')));app.use('/monaco-editor',express.static(path.join(root,'node_modules/monaco-editor')));app.use(express.static(path.join(root,'public')));
 app.use(render('404',{title:'Page not found'}));
 const server=http.createServer(app);const io=new Server(server);
 io.on('connection',socket=>{socket.emit('whoami',{userId:user.username,socketId:socket.id});socket.on('join-room',roomId=>{socket.emit('joined-room',{roomId});socket.emit('user-name',[{...user,userId:user.username,socketId:socket.id}]);});socket.on('ot-request-state',({roomId})=>socket.emit('ot-sync',{roomId,doc:fileList[0].code,version:0}));socket.on('chat-history-request',()=>socket.emit('chat-history',{messages:[]}));socket.on('whiteboard:request-sync',()=>socket.emit('whiteboard:sync',{strokes:[],shapes:[],texts:[]}));});
 return {app,server,io};
}
if(require.main===module){const {server}=createPreview();server.listen(5175,'127.0.0.1',()=>console.log('Local fixture preview: http://127.0.0.1:5175 (sample data; no database)'));}
module.exports={createPreview};
