const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const YOUR_EXISTING_API_URL = 'https://getzenpay-email-api.onrender.com/api/send-welcome';
const YOUR_API_KEY = 'GETZENPAY_2026_SECRET';

let scheduledTasks = [];
let taskIdCounter = 1;

app.get('/', (req,res)=>{
 res.send(`<html><body style="font-family:Arial;padding:40px"><h1>✅ Scheduler Tous Pays + Edit/Delete</h1><p>En attente: ${scheduledTasks.filter(t=>t.status==='pending').length}</p><p><a href="/api/scheduled-tasks">Voir tâches</a></p></body></html>`);
});

async function callYourExistingApi(p){
 try{
  const r=await fetch(YOUR_EXISTING_API_URL,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':YOUR_API_KEY},body:JSON.stringify({email:p.recipientEmail,prenom:p.recipientName,sujet:p.subject,html:p.html,text:p.text})});
  if(!r.ok) throw new Error('Erreur API');
  return {success:true};
 }catch(e){return {success:false,error:e.message}}
}

// PROGRAMMER
app.post('/api/schedule',(req,res)=>{
 const {subject,recipientEmail,recipientName,brandName,messageHtml,messageText,scheduledAt,clientTimezone,clientTimezoneLabel,clientLocalDateTime}=req.body;
 if(!subject||!recipientEmail||!scheduledAt) return res.status(400).json({error:'Champs manquants'});
 const d=new Date(scheduledAt);
 if(d<=new Date()) return res.status(400).json({error:'Date future obligatoire'});
 const task={
  id:String(taskIdCounter++),
  subject:`${generateSuffix()} ${subject}`,
  originalSubject:subject,
  recipientEmail, recipientName:recipientName||'Klient', brandName:brandName||'ZenPay',
  html:`<div style="padding:30px"><h2>${brandName}</h2><p>Bonjour ${recipientName}</p><div>${messageHtml}</div></div>`,
  text:messageText,
  originalMessageHtml:messageHtml,
  originalMessageText:messageText,
  scheduledAt:d.toISOString(),
  clientTimezone:clientTimezone||'UTC',
  clientTimezoneLabel:clientTimezoneLabel||clientTimezone,
  clientLocalDateTime:clientLocalDateTime||scheduledAt,
  status:'pending', createdAt:new Date().toISOString()
 };
 scheduledTasks.push(task);
 res.status(201).json(task);
});

// VOIR
app.get('/api/scheduled-tasks',(req,res)=>res.json(scheduledTasks));

// MODIFIER - nouveau
app.put('/api/scheduled-tasks/:id',(req,res)=>{
 const task=scheduledTasks.find(t=>t.id===req.params.id);
 if(!task) return res.status(404).json({error:'Tâche non trouvée'});
 if(task.status!=='pending') return res.status(400).json({error:'On ne peut modifier que les tâches en attente'});
 
 const {subject,recipientEmail,recipientName,brandName,messageHtml,messageText,scheduledAt,clientTimezone,clientTimezoneLabel,clientLocalDateTime}=req.body;
 if(subject){task.originalSubject=subject; task.subject=`${generateSuffix()} ${subject}`;}
 if(recipientEmail) task.recipientEmail=recipientEmail;
 if(recipientName) task.recipientName=recipientName;
 if(brandName) task.brandName=brandName;
 if(messageHtml){task.originalMessageHtml=messageHtml; task.html=`<div style="padding:30px"><h2>${task.brandName}</h2><p>Bonjour ${task.recipientName}</p><div>${messageHtml}</div></div>`;}
 if(messageText) task.originalMessageText=messageText, task.text=messageText;
 if(scheduledAt) task.scheduledAt=new Date(scheduledAt).toISOString();
 if(clientTimezone) task.clientTimezone=clientTimezone;
 if(clientTimezoneLabel) task.clientTimezoneLabel=clientTimezoneLabel;
 if(clientLocalDateTime) task.clientLocalDateTime=clientLocalDateTime;

 res.json({message:'Modifié',task});
});

// SUPPRIMER 1 tâche
app.delete('/api/scheduled-tasks/:id',(req,res)=>{
 const before=scheduledTasks.length;
 scheduledTasks=scheduledTasks.filter(t=>t.id!==req.params.id);
 if(scheduledTasks.length===before) return res.status(404).json({error:'Non trouvé'});
 res.json({message:'Supprimé'});
});

// SUPPRIMER EN LOT - nouveau
app.delete('/api/scheduled-tasks',(req,res)=>{
 const {status}=req.query;
 if(!status) return res.status(400).json({error:'Ajoute ?status=sent ou ?status=failed'});
 const before=scheduledTasks.length;
 scheduledTasks=scheduledTasks.filter(t=>t.status!==status);
 res.json({message:`${before-scheduledTasks.length} tâches ${status} supprimées`,deleted:before-scheduledTasks.length});
});

setInterval(async()=>{
 const now=new Date();
 for(let t of scheduledTasks){
  if(t.status!=='pending') continue;
  if(new Date(t.scheduledAt)<=now){
   const r=await callYourExistingApi(t);
   t.status=r.success?'sent':'failed';
   t.sentAt=new Date().toISOString();
  }
 }
},30000);

function generateSuffix(){let r='';const c='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';for(let i=0;i<4;i++)r+=c[Math.floor(Math.random()*c.length)];return r;}
app.listen(process.env.PORT||10000,()=>console.log('🚀 Scheduler Edit/Delete prêt'));
