const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const YOUR_EXISTING_API_URL = 'https://getzenpay-email-api.onrender.com/api/send-welcome';
const YOUR_API_KEY = 'GETZENPAY_2026_SECRET';

let scheduledTasks = [];
let taskIdCounter = 1;

// Réveille ton API email au démarrage
fetch(YOUR_EXISTING_API_URL).catch(()=>{});

app.get('/',(req,res)=>res.send(`<h1>✅ ZenPay Scheduler Tous Pays</h1><p>Pending: ${scheduledTasks.filter(t=>t.status==='pending').length}</p>`));

async function callYourExistingApi(p){
 for(let attempt=1; attempt<=5; attempt++){
  try{
   if(attempt>1) await new Promise(r=>setTimeout(r, 3000*attempt));
   if(attempt===1) await fetch(YOUR_EXISTING_API_URL).catch(()=>{});
   
   const controller = new AbortController();
   const t = setTimeout(()=>controller.abort(), 30000);
   
   const response = await fetch(YOUR_EXISTING_API_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':YOUR_API_KEY},
    body:JSON.stringify({
     email:p.recipientEmail,
     prenom:p.recipientName,
     sujet:p.subject,
     html:p.html,
     text:p.text
    }),
    signal:controller.signal
   });
   clearTimeout(t);
   const txt = await response.text();
   if(!response.ok) throw new Error(txt);
   return {success:true};
  }catch(e){
   console.log(`Tentative ${attempt}/5 échouée: ${e.message}`);
   if(attempt===5) return {success:false, error:e.message};
  }
 }
}

app.post('/api/schedule',(req,res)=>{
 const {subject,recipientEmail,recipientName,brandName,messageHtml,messageText,scheduledAt,clientTimezone,clientTimezoneLabel,clientLocalDateTime}=req.body;
 if(!subject||!recipientEmail||!scheduledAt) return res.status(400).json({error:'Champs manquants'});
 const task={
  id:String(taskIdCounter++),
  subject:`${generateSuffix()} ${subject}`,
  originalSubject:subject,
  recipientEmail, recipientName:recipientName||'Klient', brandName:brandName||'ZenPay',
  html:`<table width="100%" style="background:#f5f7fa;padding:20px"><tr><td align="center"><table width="600" style="background:#fff;border-radius:10px;overflow:hidden"><tr><td style="background:#6A1B9A;padding:30px;text-align:center;color:#fff;font-size:28px;font-weight:bold">${brandName||'ZenPay'}</td></tr><tr><td style="padding:30px;font-size:18px">${messageHtml}</td></tr></table></td></tr></table>`,
  text:messageText,
  originalMessageHtml:messageHtml, originalMessageText:messageText,
  scheduledAt:new Date(scheduledAt).toISOString(),
  clientTimezone:clientTimezone||'UTC', clientTimezoneLabel:clientTimezoneLabel||clientTimezone, clientLocalDateTime:clientLocalDateTime||scheduledAt,
  status:'pending', createdAt:new Date().toISOString(), attempts:0
 };
 scheduledTasks.push(task);
 res.status(201).json(task);
});

app.get('/api/scheduled-tasks',(req,res)=>res.json(scheduledTasks));

app.put('/api/scheduled-tasks/:id',(req,res)=>{
 const t=scheduledTasks.find(x=>x.id===req.params.id);
 if(!t||t.status!=='pending') return res.status(400).json({error:'Non modifiable'});
 const {subject,recipientEmail,recipientName,brandName,messageHtml,messageText,scheduledAt,clientTimezone,clientTimezoneLabel,clientLocalDateTime}=req.body;
 if(subject) t.originalSubject=subject, t.subject=`${generateSuffix()} ${subject}`;
 if(recipientEmail) t.recipientEmail=recipientEmail;
 if(recipientName) t.recipientName=recipientName;
 if(brandName) t.brandName=brandName;
 if(messageHtml) t.originalMessageHtml=messageHtml, t.html=t.html.replace(/<div>.*<\/div>/s, `<div>${messageHtml}</div>`);
 if(messageText) t.originalMessageText=messageText, t.text=messageText;
 if(scheduledAt) t.scheduledAt=new Date(scheduledAt).toISOString();
 if(clientTimezone) t.clientTimezone=clientTimezone;
 if(clientTimezoneLabel) t.clientTimezoneLabel=clientTimezoneLabel;
 if(clientLocalDateTime) t.clientLocalDateTime=clientLocalDateTime;
 res.json(t);
});

app.delete('/api/scheduled-tasks/:id',(req,res)=>{
 scheduledTasks=scheduledTasks.filter(x=>x.id!==req.params.id);
 res.json({ok:true});
});
app.delete('/api/scheduled-tasks',(req,res)=>{
 const {status}=req.query;
 if(!status) return res.status(400).json({error:'?status=sent ou failed'});
 const before=scheduledTasks.length;
 scheduledTasks=scheduledTasks.filter(t=>t.status!==status);
 res.json({deleted:before-scheduledTasks.length});
});

setInterval(async()=>{
 const now=new Date();
 for(let t of scheduledTasks){
  if(t.status!=='pending') continue;
  if(new Date(t.scheduledAt)<=now){
   console.log(`⏰ Envoi #${t.id} ${t.clientTimezoneLabel} ${t.clientLocalDateTime}`);
   const r=await callYourExistingApi(t);
   if(r.success){
    t.status='sent'; t.sentAt=new Date().toISOString();
    console.log(`✅ #${t.id} envoyé`);
   }else{
    // Ne passe pas en échec, reprogramme dans 1 min
    t.attempts++;
    t.scheduledAt=new Date(Date.now()+60000).toISOString();
    console.log(`🔄 #${t.id} retry dans 1min (tentative ${t.attempts})`);
    if(t.attempts>20) t.status='failed';
   }
  }
 }
},20000);

function generateSuffix(){let r='';const c='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';for(let i=0;i<4;i++)r+=c[Math.floor(Math.random()*c.length)];return r;}
app.listen(process.env.PORT||10000,()=>console.log('Scheduler FINAL prêt'));
