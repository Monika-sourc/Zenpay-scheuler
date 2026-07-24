const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

const EMAIL_API_URL = 'https://getzenpay-email-api.onrender.com/api/send-welcome';
const API_KEY = process.env.API_KEY;

app.use(cors({ origin: '*' }));
app.use(express.json());

let tasks = [];
function parseDateWithTimezone(dateStr, label) {
  let offset = "+01:00";
  if (label && label.toLowerCase().includes('varsovie')) offset = "+02:00";
  let iso = dateStr.trim().replace(' ', 'T');
  if (iso.length === 16) iso += ":00";
  if (!iso.includes('+') && !iso.includes('Z')) iso += offset;
  return new Date(iso);
}

app.get('/', (req,res) => res.send(`ZenPay Scheduler OK - KEY present: ${!!API_KEY}`));
app.get('/api/tasks', (req,res) => res.json(tasks));
app.post('/api/schedule', (req,res) => {
  const { email, subject, message, scheduledAt, timezone, pays } = req.body;
  const t = {
    id: Date.now().toString(),
    email, subject, message, scheduledAt,
    timezone: timezone || pays || 'Bénin - Cotonou',
    status: 'EN ATTENTE',
    scheduledAtUTC: parseDateWithTimezone(scheduledAt, timezone || pays).toISOString()
  };
  tasks.push(t);
  res.json(t);
});
app.delete('/api/tasks/:id', (req,res) => { tasks = tasks.filter(x=>x.id!==req.params.id); res.json({success:true}); });
app.delete('/api/tasks', (req,res) => {
  const { status } = req.query;
  if(status) tasks = tasks.filter(x=>x.status!==status);
  else tasks = [];
  res.json({success:true});
});

setInterval(async () => {
  const now = new Date();
  for (let task of tasks) {
    if (task.status !== 'EN ATTENTE') continue;
    if (new Date(task.scheduledAtUTC) <= now) {
      try {
        console.log(`[SEND] vers ${task.email} avec KEY=${!!API_KEY}`);
        const r = await fetch(EMAIL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'X-API-KEY': API_KEY,
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({ to: task.email, email: task.email, subject: task.subject, text: task.message, html: `<p>${task.message}</p>` })
        });
        const txt = await r.text();
        console.log(`[RESPONSE] ${r.status} - ${txt}`);
        task.status = r.ok ? 'ENVOYÉ' : 'ÉCHEC';
      } catch(e) {
        console.log(`[ERROR] ${e.message}`);
        task.status = 'ÉCHEC';
      }
    }
  }
}, 5000);

app.listen(PORT, () => console.log('Scheduler ready'));
