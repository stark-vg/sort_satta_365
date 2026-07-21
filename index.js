const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'sort365_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Set EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication Middleware
function checkAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect('/login');
}

// Routes
app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const email = req.body.email || req.body.username;
    const password = req.body.password;

    const envEmail = process.env.EMAIL || 'Davinderwadhwa974@gmail.com';
    const envPassword = process.env.PASSWORD || 'Love123456@';

    if (email === envEmail && password === envPassword) {
        req.session.user = { email: email };
        return res.redirect('/');
    } else {
        return res.render('login', { error: 'Invalid Email or Password! Please try again.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

app.get('/', checkAuth, (req, res) => {
    res.render('sort365', { user: req.session.user });
});

// API endpoint to dispatch Email & Telegram Notifications when Winner is Predicted
app.post('/notify-winner', checkAuth, (req, res) => {
    try {
        const { year, winnerSet, month, startDate, values } = req.body;
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

        const recipientEmail = process.env.NOTIFY_EMAIL || 'vaibhavgoel1903@gmail.com';

        console.log(`\n======================================================`);
        console.log(`[HOST GAME WINNER NOTIFICATION] - ${timestamp}`);
        console.log(`Recipient: ${recipientEmail}`);
        console.log(`Year: ${year} | Exclusive Winner: ${winnerSet}`);
        console.log(`Match Location: ${month}, Dates ${startDate}-${Number(startDate) + (values ? values.length - 1 : 3)}`);
        console.log(`Winning Values: [${values ? values.join(', ') : ''}]`);
        console.log(`======================================================\n`);

        // 1. Send Email via Web3Forms API (Instant Delivery to vaibhavgoel1903@gmail.com)
        try {
            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    access_key: '2161f366-234b-4861-ad7b-6c4ff984beec',
                    subject: `🎉 Thank you so much for playing UNIQ Game! (Winner: ${winnerSet})`,
                    from_name: "UNIQ Game Engine",
                    to: recipientEmail,
                    message: `Thank you so much for playing UNIQ Game!\n\nHere are your Game Winner Details:\n\n🏆 Winning Set: ${winnerSet}\nYear: ${year}\nMonth: ${month}\nDates Range: ${startDate} to ${Number(startDate) + (values ? values.length - 1 : 3)}\nWinning Values: [ ${values ? values.join(', ') : ''} ]\n\nTimestamp: ${timestamp}`
                })
            }).then(async r => {
                const text = await r.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { success: r.ok, message: text };
                }
            }).then(resData => {
                console.log('✅ [WEB3FORMS EMAIL DISPATCHED] Result:', resData);
            }).catch(e => console.error('Web3Forms error:', e.message));
        } catch (wErr) {
            console.error('Web3Forms fetch error:', wErr.message);
        }

        // 2. Send Telegram Push Notification if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are provided
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;

        if (telegramToken && telegramChatId) {
            try {
                const tgText = `🎉 *THANK YOU FOR PLAYING UNIQ GAME!* 🎉\n\n` +
                    `🏆 *Winning Set:* \`${winnerSet}\`\n` +
                    `📅 *Year:* ${year}\n` +
                    `🗓️ *Month:* ${month}\n` +
                    `📆 *Dates:* ${startDate} to ${Number(startDate) + (values ? values.length - 1 : 3)}\n` +
                    `🔢 *Winning Values:* \`[ ${values ? values.join(', ') : ''} ]\`\n\n` +
                    `Thank you for using UNIQ Game Engine!`;

                fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramChatId,
                        text: tgText,
                        parse_mode: 'Markdown'
                    })
                }).then(r => r.json()).then(resData => {
                    console.log('✅ [TELEGRAM NOTIFICATION DISPATCHED] Result:', resData);
                }).catch(e => console.error('Telegram error:', e.message));
            } catch (tgErr) {
                console.error('Telegram fetch error:', tgErr.message);
            }
        }

        // 3. Send Email via Nodemailer SMTP Transporter
        const senderEmail = process.env.SENDER_EMAIL || process.env.EMAIL || 'Davinderwadhwa974@gmail.com';
        const senderPass = process.env.EMAIL_PASS || process.env.PASSWORD;

        if (senderEmail && senderPass) {
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
                subject: `🎉 Thank you so much for playing UNIQ Game! (Winner: ${winnerSet})`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 12px; max-width: 600px; margin: auto;">
                        <h2 style="color: #10b981; margin-top: 0;">🎉 Thank You So Much For Playing UNIQ Game!</h2>
                        <p style="color: #cbd5e1; font-size: 1rem; line-height: 1.5;">
                            We are thrilled to have you! Here is the designated winning set summary for your game session:
                        </p>
                        <hr style="border: 1px solid #334155; margin: 20px 0;" />
                        <div style="background-color: #1e293b; padding: 18px; border-radius: 8px; border-left: 4px solid #10b981;">
                            <p style="font-size: 1.15rem; color: #fbbf24; margin: 0 0 10px 0;"><b>🏆 Winning Set:</b> ${winnerSet}</p>
                            <p style="margin: 6px 0; color: #e2e8f0;"><b>Year:</b> ${year}</p>
                            <p style="margin: 6px 0; color: #e2e8f0;"><b>Month:</b> ${month}</p>
                            <p style="margin: 6px 0; color: #e2e8f0;"><b>Dates Range:</b> ${startDate} to ${Number(startDate) + (values ? values.length - 1 : 3)}</p>
                            <p style="font-size: 1.1rem; color: #34d399; margin: 10px 0 0 0;"><b>Winning Values:</b> [ ${values ? values.join(', ') : ''} ]</p>
                        </div>
                        <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 24px; text-align: center;">
                            Thank you for using UNIQ Game Engine • ${timestamp}
                        </p>
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
        }

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
        console.error('Server error:', err);
    }
});
