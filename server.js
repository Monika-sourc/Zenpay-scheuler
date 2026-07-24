const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// 1. CONFIGURATION
// ============================================
const YOUR_EXISTING_API_URL = 'https://getzenpay-email-api.onrender.com/api/send-welcome';
const YOUR_API_KEY = 'GETZENPAY_2026_SECRET';

let scheduledTasks = [];
let taskIdCounter = 1;

// ============================================
// 2. PAGE D'ACCUEIL
// ============================================
app.get('/', (req, res) => {
  res.send(`
    <html><head><meta charset="utf-8"><title>ZenPay Scheduler</title></head>
    <body style="font-family:Arial;padding:40px;background:#f5f7fa">
      <h1>✅ ZenPay Scheduler est en ligne - Version Tous Pays</h1>
      <p><b>URL:</b> https://zenpay-scheuler.onrender.com</p>
      <p><b>Tâches en attente:</b> ${scheduledTasks.filter(t=>t.status==='pending').length} / ${scheduledTasks.length}</p>
      <hr>
      <p><a href="/api/scheduled-tasks">Voir /api/scheduled-tasks</a></p>
      <p style="color:#64748b;font-size:13px">Chaque tâche garde son pays et son heure exacte</p>
    </body></html>
  `);
});

// ============================================
// 3. FONCTION QUI APPELLE TON API
// ============================================
async function callYourExistingApi(params) {
    const { recipientEmail, recipientName, subject, html, text } = params;
    try {
        const response = await fetch(YOUR_EXISTING_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': YOUR_API_KEY },
            body: JSON.stringify({ email: recipientEmail, prenom: recipientName, sujet: subject, html, text })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
        }
        return { success: true, data: await response.json() };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// 4. PROGRAMMER - CORRIGÉ TOUS PAYS
// ============================================
app.post('/api/schedule', (req, res) => {
    const { 
      subject, recipientEmail, recipientName, brandName, 
      messageHtml, messageText, scheduledAt,
      clientTimezone, clientTimezoneLabel, clientLocalDateTime 
    } = req.body;

    if (!subject ||!recipientEmail ||!scheduledAt) {
        return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'La date doit être dans le futur' });
    }
    const suffix = generateSuffix();
    const fullSubject = `${suffix} ${subject}`;
    const fullHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa; padding:20px;">
        <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden;">
                <tr><td style="background-color:#6A1B9A; padding:45px 20px; text-align:center;">
                    <span style="font-size:72px; font-weight:bold; color:#ffffff;">${brandName || 'ZenPay'}</span>
                </td></tr>
                <tr><td style="padding:35px; color:#333; font-size:22px; line-height:2.0;">
                    <p>Dzień dobry, <strong>${recipientName || 'Klient'}</strong></p>
                    <div style="font-size:20px; color:#1f2937;">${messageHtml}</div>
                </td></tr>
            </table>
        </td></tr>
    </table>`;
    const fullText = `Dzień dobry ${recipientName || 'Klient'},\n\n${messageText}`;

    const newTask = {
        id: taskIdCounter++,
        subject: fullSubject,
        originalSubject: subject,
        recipientEmail,
        recipientName: recipientName || 'Klient',
        brandName: brandName || 'ZenPay',
        html: fullHtml,
        text: fullText,
        scheduledAt: scheduledDate.toISOString(), // Heure UTC réelle d'envoi
        
        // NOUVEAU - On garde le pays
        clientTimezone: clientTimezone || 'UTC',
        clientTimezoneLabel: clientTimezoneLabel || clientTimezone || 'UTC',
        clientLocalDateTime: clientLocalDateTime || scheduledAt, // ex: 2026-07-24T06:57

        status: 'pending',
        createdAt: new Date().toISOString()
    };
    scheduledTasks.push(newTask);
    console.log(`📅 #${newTask.id} ${newTask.originalSubject} -> ${newTask.clientTimezoneLabel} à ${newTask.clientLocalDateTime} = ${newTask.scheduledAt}`);
    res.status(201).json({ message: 'Email programmé', taskId: newTask.id, task: newTask });
});

// ============================================
// 5. VOIR LES TACHES
// ============================================
app.get('/api/scheduled-tasks', (req, res) => {
    res.json(scheduledTasks);
});

// ============================================
// 6. WORKER
// ============================================
setInterval(async () => {
    const now = new Date();
    for (let i = scheduledTasks.length - 1; i >= 0; i--) {
        const task = scheduledTasks[i];
        if (task.status!== 'pending') continue;
        if (new Date(task.scheduledAt) <= now) {
            console.log(`⏰ Envoi #${task.id} ${task.clientTimezoneLabel} ${task.clientLocalDateTime}`);
            const result = await callYourExistingApi({
                recipientEmail: task.recipientEmail,
                recipientName: task.recipientName,
                subject: task.subject,
                html: task.html,
                text: task.text
            });
            task.status = result.success ? 'sent' : 'failed';
            task.sentAt = new Date().toISOString();
        }
    }
}, 30000);

function generateSuffix() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let r = ''; for (let i = 0; i < 4; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return r;
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Scheduler Tous Pays sur ${PORT}`));
