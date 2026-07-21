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
