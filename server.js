const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// --- CONFIG ---
const EMAIL_API_URL = 'https://getzenpay-email-api.onrender.com/api/send-welcome';

app.use(cors({ origin: '*' }));
app.use(express.json());

let tasks = []; // Stockage en mémoire

// Fonction pour comprendre l'heure Bénin / Pologne
function parseDateWithTimezone(dateStr, timezoneLabel) {
  // dateStr reçu: "2026-07-24 11:31" ou "2026-07-24T11:31"
  let offset = "+01:00"; // Bénin - Cotonou par défaut
  if (timezoneLabel) {
    const t = timezoneLabel.toLowerCase();
    if (t.includes('varsovie') || t.includes('pologne') || t.includes('poland')) offset = "+02:00";
    if (t.includes('cotonou') || t.includes('porto-novo') || t.includes('bénin') || t.includes('benin')) offset = "+01:00";
  }
  let iso = dateStr.trim().replace(' ', 'T');
  if (iso.length === 16) iso += ":00"; // ajoute les secondes
  if (!iso.includes('+') && !iso.includes('Z')) {
    iso += offset;
  }
  return new Date(iso);
}

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('ZenPay Scheduler OK - ' + new Date().toISOString());
});

app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.post('/api/schedule', (req, res) => {
  const { email, subject, message, scheduledAt, timezone, pays } = req.body;
  
  if (!email || !scheduledAt) {
    return res.status(400).json({ error: 'email et scheduledAt requis' });
  }

  const task = {
    id: Date.now().toString(),
    email: email,
    subject: subject || 'Bienvenue chez nous Jeanne.',
    message: message || '',
    scheduledAt: scheduledAt, // ex: "2026-07-24 11:31"
    timezone: timezone || pays || 'Bénin - Cotonou',
    pays: pays || timezone || 'Bénin - Cotonou',
    status: 'EN ATTENTE',
    createdAt: new Date().toISOString(),
    scheduledAtUTC: parseDateWithTimezone(scheduledAt, timezone || pays).toISOString()
  };

  tasks.push(task);
  console.log(`[NEW TASK] ${task.email} programmé pour ${task.scheduledAt} (${task.timezone}) -> UTC: ${task.scheduledAtUTC}`);
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  tasks = tasks.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

app.delete('/api/tasks', (req, res) => {
  const { status } = req.query; // ?status=ÉCHEC ou ENVOYÉ
  if (status) {
    tasks = tasks.filter(t => t.status !== status);
  } else {
    tasks = [];
  }
  res.json({ success: true });
});

app.put('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  Object.assign(task, req.body);
  if (req.body.scheduledAt) {
    task.scheduledAtUTC = parseDateWithTimezone(req.body.scheduledAt, req.body.timezone || task.timezone).toISOString();
  }
  res.json(task);
});

// --- MOTEUR D'ENVOI (toutes les 5 secondes) ---

setInterval(async () => {
  const now = new Date();
  for (let task of tasks) {
    if (task.status !== 'EN ATTENTE') continue;

    const scheduledTime = new Date(task.scheduledAtUTC);
    
    if (scheduledTime <= now) {
      console.log(`[SEND] Tentative d'envoi à ${task.email} prévu à ${task.scheduledAtUTC}`);
      try {
        const response = await fetch(EMAIL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: task.email,
            subject: task.subject,
            text: task.message,
            html: task.message
          })
        });
        
        if (response.ok) {
          task.status = 'ENVOYÉ';
          task.sentAt = new Date().toISOString();
          console.log(`[SUCCESS] Envoyé à ${task.email}`);
        } else {
          const txt = await response.text();
          console.log(`[FAIL] API Email a répondu ${response.status}: ${txt}`);
          task.status = 'ÉCHEC';
        }
      } catch (err) {
        console.error(`[ERROR] Impossible de joindre Email API:`, err.message);
        task.status = 'ÉCHEC';
      }
    }
  }
}, 5000);

app.listen(PORT, () => {
  console.log(`Scheduler démarré sur port ${PORT}`);
});
