const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// 1. CONFIGURATION - Pointez vers VOTRE API EXISTANTE
// ============================================
const YOUR_EXISTING_API_URL = 'https://getzenpay-email-api.onrender.com/api/send-welcome';
const YOUR_API_KEY = 'GETZENPAY_2026_SECRET'; // Utilisez la même clé ou une clé dédiée

// ============================================
// 2. STOCKAGE (Base de données fictive)
//    ⚠️ En production, remplacez par MongoDB, PostgreSQL ou Redis.
// ============================================
let scheduledTasks = [];
let taskIdCounter = 1;

// ============================================
// 3. FONCTION QUI APPELLE VOTRE API EXISTANTE
// ============================================
async function callYourExistingApi(params) {
    const { recipientEmail, recipientName, subject, html, text } = params;

    try {
        const response = await fetch(YOUR_EXISTING_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': YOUR_API_KEY
            },
            body: JSON.stringify({
                email: recipientEmail,
                prenom: recipientName,
                sujet: subject,
                html: html,
                text: text
            })
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
// 4. ENDPOINT POUR RECEVOIR UNE PROGRAMMATION
//    (C'est là que votre site web enverra les données)
// ============================================
app.post('/api/schedule', (req, res) => {
    const { 
        subject, 
        recipientEmail, 
        recipientName, 
        brandName, 
        messageHtml, 
        messageText, 
        scheduledAt 
    } = req.body;

    // Validations
    if (!subject || !recipientEmail || !scheduledAt) {
        return res.status(400).json({ error: 'Champs obligatoires manquants (sujet, email, date)' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'La date doit être dans le futur' });
    }

    // Construction du sujet avec le suffixe (comme dans votre frontend)
    const suffix = generateSuffix();
    const fullSubject = `${suffix} ${subject}`;

    // Génération du HTML complet (copié depuis votre frontend)
    const fullHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa; padding:20px;">
        <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden;">
                <tr><td style="background-color:#6A1B9A; padding:45px 20px; text-align:center;">
                    <span style="font-size:72px; font-weight:bold; color:#ffffff; letter-spacing:2px;">${brandName || 'ZenPay'}</span>
                </td></tr>
                <tr><td style="padding:35px; color:#333333; font-size:22px; line-height:2.0;">
                    <p style="margin-top:0; font-size:24px;">Dzień dobry, <strong>${recipientName || 'Klient'}</strong></p>
                    <div style="font-size:20px; color:#1f2937;">${messageHtml}</div>
                    <hr style="border:none; border-top:1px solid #e0e0e0; margin:35px 0;">
                    <p style="font-size:16px; color:#6b7280;"><i>Wiadomość wysłana via ${brandName || 'ZenPay'}</i></p>
                </td></tr>
            </table>
        </td></tr>
    </table>`;

    const fullText = `Dzień dobry ${recipientName || 'Klient'},\n\n${messageText}\n\n--\nWiadomość wysłana via ${brandName || 'ZenPay'}`;

    const newTask = {
        id: taskIdCounter++,
        subject: fullSubject,
        recipientEmail,
        recipientName: recipientName || 'Klient',
        brandName: brandName || 'ZenPay',
        html: fullHtml,
        text: fullText,
        scheduledAt: scheduledDate.toISOString(),
        status: 'pending', // pending | sent | failed
        createdAt: new Date().toISOString()
    };

    scheduledTasks.push(newTask);
    console.log(`📅 [${new Date().toISOString()}] Tâche #${newTask.id} programmée pour ${newTask.scheduledAt}`);

    res.status(201).json({ 
        message: 'Email programmé avec succès', 
        taskId: newTask.id 
    });
});

// ============================================
// 5. (OPTIONNEL) ENDPOINT POUR VOIR LES TÂCHES
// ============================================
app.get('/api/scheduled-tasks', (req, res) => {
    res.json(scheduledTasks);
});

// ============================================
// 6. WORKER : Vérification toutes les 30 secondes
// ============================================
setInterval(async () => {
    const now = new Date();

    for (let i = scheduledTasks.length - 1; i >= 0; i--) {
        const task = scheduledTasks[i];
        if (task.status !== 'pending') continue;

        const scheduledTime = new Date(task.scheduledAt);
        if (scheduledTime <= now) {
            console.log(`⏰ [${new Date().toISOString()}] Exécution de la tâche #${task.id}...`);

            // Ici, on appelle VOTRE API existante !
            const result = await callYourExistingApi({
                recipientEmail: task.recipientEmail,
                recipientName: task.recipientName,
                subject: task.subject,
                html: task.html,
                text: task.text
            });

            if (result.success) {
                task.status = 'sent';
                console.log(`✅ Tâche #${task.id} envoyée avec succès via l'API existante.`);
            } else {
                task.status = 'failed';
                console.error(`❌ Échec de la tâche #${task.id}: ${result.error}`);
            }
        }
    }
}, 30000); // 30 secondes

// ============================================
// 7. FONCTION UTILITAIRE
// ============================================
function generateSuffix() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

// ============================================
// 8. LANCER LE SERVEUR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Service de planification ZenPay en écoute sur le port ${PORT}`);
    console.log(`📡 Il utilisera l'API existante : ${YOUR_EXISTING_API_URL}`);
    console.log('⏳ Worker de vérification actif (toutes les 30 secondes).');
});
