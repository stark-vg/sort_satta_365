const express = require('express');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3005;
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

app.use(session({
    secret: 'satta-365-secret-key',
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', async (req, res) => {
    try {
        if (req.session.loggedIn) {
            return res.redirect('/sort365');
        } else {
            return res.redirect('/login');
        }
    } catch (err) {
        console.log("err", err);
    }
});

app.get('/login', async (req, res) => {
    try {
        return res.render('login.ejs');
    } catch (err) {
        console.log("err", err);
    }
});

app.post('/login', async (req, res) => {
    try {
        let loginData = req.body;
        if (process.env.EMAIL === loginData.username && process.env.PASSWORD === loginData.password) {
            req.session.loggedIn = true;
            return res.redirect('/sort365');
        } else {
            return res.redirect('back');
        }
    } catch (err) {
        console.log("err", err);
    }
});

app.get(['/sort365', '/sort65Days', '/sort'], async (req, res) => {
    try {
        if (req.session.loggedIn) {
            return res.render('sort365.ejs');
        } else {
            return res.redirect('/login');
        }
    } catch (err) {
        console.log("err", err);
    }
});

app.get('/logout', async (req, res) => {
    try {
        req.session.loggedIn = false;
        return res.redirect('/login');
    } catch (err) {
        console.log("err", err);
    }
});

const nodemailer = require('nodemailer');

// Setup Email Transporter (uses environment config if SMTP parameters are set, with fallback test account)
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL || 'Davinderwadhwa974@gmail.com',
        pass: process.env.EMAIL_PASS || process.env.PASSWORD
    }
});

app.post('/notify-winner', async (req, res) => {
    try {
        const { year, winnerSet, month, startDate, values } = req.body;
        const timestamp = new Date().toLocaleString();
        const recipientEmail = process.env.NOTIFY_EMAIL || 'vaibhavgoel1903@gmail.com';
        
        console.log(`\n======================================================`);
        console.log(`[HOST GAME WINNER NOTIFICATION] - ${timestamp}`);
        console.log(`Recipient: ${recipientEmail}`);
        console.log(`Year: ${year} | Exclusive Winner: ${winnerSet}`);
        console.log(`Match Location: ${month}, Dates ${startDate}-${Number(startDate) + (values ? values.length - 1 : 3)}`);
        console.log(`Winning Values: [${values ? values.join(', ') : ''}]`);
        console.log(`======================================================\n`);
        
        // 1. Send Email via FormSubmit Webhook API (Guaranteed Instant Delivery to vaibhavgoel1903@gmail.com)
        try {
            fetch(`https://formsubmit.co/ajax/${recipientEmail}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    _subject: `🏆 UNIQ Game Winner Pre-Notification: ${winnerSet}`,
                    _template: 'table',
                    "Designated Winner Set": winnerSet,
                    "Year": year,
                    "Month": month,
                    "Dates Range": `${startDate} to ${Number(startDate) + (values ? values.length - 1 : 3)}`,
                    "Winning Values": `[ ${values ? values.join(', ') : ''} ]`,
                    "Timestamp": timestamp
                })
            }).then(r => r.json()).then(resData => {
                console.log('✅ [FORMSUBMIT EMAIL DISPATCHED] Result:', resData);
            }).catch(e => console.error('FormSubmit error:', e.message));
        } catch (fErr) {
            console.error('Fetch error:', fErr.message);
        }

        // 2. Send Email via Nodemailer SMTP Transporter
        const senderEmail = process.env.SENDER_EMAIL || process.env.EMAIL || 'Davinderwadhwa974@gmail.com';
        const senderPass = process.env.EMAIL_PASS || process.env.PASSWORD;

        const emailTransporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: senderEmail,
                pass: senderPass
            }
        });

        const mailOptions = {
            from: `"UNIQ Game" <${senderEmail}>`,
            to: recipientEmail,
            subject: `🏆 Game Winner Secret Pre-Notification: ${winnerSet}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0f172a; color: #ffffff; border-radius: 8px;">
                    <h2 style="color: #10b981;">🏆 UNIQ Game - Winner Pre-Notification</h2>
                    <p style="color: #94a3b8;">Host pre-calculation notification dispatched at ${timestamp}</p>
                    <hr style="border: 1px solid #334155;" />
                    <div style="background-color: #1e293b; padding: 15px; border-radius: 6px; margin-top: 15px;">
                        <p style="font-size: 1.1rem; color: #fbbf24;"><b>Designated Winning Set:</b> ${winnerSet}</p>
                        <p><b>Year:</b> ${year}</p>
                        <p><b>Month:</b> ${month}</p>
                        <p><b>Dates Range:</b> ${startDate} to ${Number(startDate) + (values ? values.length - 1 : 3)}</p>
                        <p style="font-size: 1.1rem; color: #34d399;"><b>Winning Values:</b> [ ${values ? values.join(', ') : ''} ]</p>
                    </div>
                </div>
            `
        };

        emailTransporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('[GMAIL SMTP ERROR]:', error.message);
            } else {
                console.log('✅ [GMAIL SMTP SENT] Message ID:', info.messageId);
            }
        });

        return res.json({ 
            success: true, 
            message: `Host email & console notification dispatched for ${winnerSet}`,
            timestamp: timestamp,
            winnerSet: winnerSet,
            recipient: recipientEmail
        });
    } catch (err) {
        console.error("Notification error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

const server = app.listen(PORT, () => {
    console.log(`365/366 Satta Sort Server successfully running on port http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        const nextPort = Number(PORT) + 1;
        console.log(`Port ${PORT} is busy, trying port http://localhost:${nextPort}...`);
        app.listen(nextPort, () => {
            console.log(`365/366 Satta Sort Server successfully running on port http://localhost:${nextPort}`);
        });
    } else {
        console.error("Server error:", err);
    }
});
