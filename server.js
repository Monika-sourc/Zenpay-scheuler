const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

const EMAIL_API_URL = 'https://getzenpay-email-api.onrender.com/api/send-welcome';
// On lit la clé depuis les variables d'environnement de Render, pas en dur
const API_KEY = process.env.API_KEY; 

app.use(cors({ origin: '*' }));
app.use(express.json());

let tasks = [];

function parseDateWithTimezone(dateStr, timezoneLabel) {
  let offset = "+01:00";
  if (timezoneLabel) {
    const t = timezoneLabel.toLowerCase();
    if (t.includes('varsovie') || t.includes('pologne')) offset = "+02:00";
  }
  let iso = dateStr.trim().replace(' ', 'T');
  if (iso.length === 16) iso += ":00";
  if (!iso.includes('+') && !iso.includes('Z')) iso += offset;
  return new Date(iso);
}

app.get('/', (req,res) => res.send('ZenPay Scheduler OK'));
app.get('/api/tasks', (req,res) => res.json(tasks));

app.post('/api/schedule', (req,res) => {
  const { email, subject, message, scheduledAt, timezone, pays } = req.body;
  const task = {
    id: Date.now().toString(),
    email, subject, message, scheduledAt,
    timezone: timezone || pays || 'Bénin - Cotonou',
    pays: pays || timezone || 'Bénin - Cotonou',
    status: 'EN ATTENTE',
    scheduledAtUTC: parseDateWithTimezone(scheduledAt, timezone || pays).toISOString()
  };
  tasks.push(task);
  console.log(`[NEW] ${email} pour ${task.scheduledAtUTC}`);
  res.json(task);
});

app.delete('/api/tasks/:id', (req,res) => { tasks = tasks.filter(t=>t.id!==req.params.id); res.json({success:true}); });
app.delete('/api/tasks', (req,res) => {
  const { status } = req.query;
  if(status) tasks = tasks.filter(t=>t.status!==status);
  else tasks = [];
  res.json({success:true});
});

setInterval(async () => {
  const now = new Date();
  for (let task of tasks) {
    if (task.status !== 'EN ATTENTE') continue;
    if (new Date(task.scheduledAtUTC) <= now) {
      console.log(`[SEND] Appel API email pour ${task.email}`);
      try {
        const response = await fetch(EMAIL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'X-API-KEY': API_KEY,
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            to: task.email,
            email: task.email,
            subject: task.subject,
            text: task.message,
            html: task.message
          })
        });
        const txt = await response.text();
        console.log(`[API RESPONSE] ${response.status}: ${txt}`);
        if (response.ok) {
          task.status = 'ENVOYÉ';
        } else {
          task.status = 'ÉCHEC';
        }
      } catch (err) {
        console.error(`[ERROR] ${err.message}`);
        task.status = 'ÉCHEC';
      }
    }
  }
}, 5000);

app.listen(PORT, () => console.log(`Scheduler avec API KEY démarré sur ${PORT}`));
