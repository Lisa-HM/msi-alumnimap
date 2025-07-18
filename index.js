require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// 📁 Upload-Speicher
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

// ⚙️ Middleware
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('views'));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// 🔐 LinkedIn-Login
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: process.env.LINKEDIN_CALLBACK_URL,
  scope: ['r_liteprofile'],
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

// 🌐 Landing Page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/login.html');
});

// 🔗 LinkedIn Auth
app.get('/auth/linkedin', passport.authenticate('linkedin'));

app.get('/auth/linkedin/callback',
  passport.authenticate('linkedin', { failureRedirect: '/' }),
  (req, res) => {
    res.send(`<h2>Hallo ${req.user.displayName}!</h2><pre>${JSON.stringify(req.user, null, 2)}</pre><br><a href="/">Zurück</a>`);
  }
);

// 📤 Upload-Route
app.post('/upload', upload.single('cv'), (req, res) => {
  if (!req.file) {
    return res.send('❌ Fehler: Keine Datei hochgeladen.');
  }

  res.send(`
    <h1>📄 Lebenslauf erfolgreich hochgeladen!</h1>
    <p>Dateiname: ${req.file.originalname}</p>
    <p>Gespeichert unter: <code>${req.file.path}</code></p>
    <a href="/">Zurück zur Startseite</a>
  `);
});

// 🔐 Admin Login
app.get('/admin', (req, res) => {
  res.send(`
    <h1>🔒 Adminbereich</h1>
    <form method="POST" action="/admin">
      <input type="password" name="password" placeholder="Passwort eingeben" required />
      <button type="submit">Anmelden</button>
    </form>
    <a href="/">Zurück</a>
  `);
});

app.post('/admin', (req, res) => {
  const entered = req.body.password;
  const correct = process.env.ADMIN_PASSWORD;

  if (entered === correct) {
    req.session.loggedIn = true;
    res.redirect('/liste');
  } else {
    res.send(`
      <h1>🚫 Falsches Passwort</h1>
      <a href="/admin">Nochmal versuchen</a>
    `);
  }
});

// 📁 Gesicherte Liste hochgeladener Lebensläufe
app.get('/liste', (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect('/admin');
  }

  fs.readdir('./uploads', (err, files) => {
    if (err) {
      return res.send('❌ Fehler beim Lesen des Upload-Ordners.');
    }

    const links = files.map(file => {
      return `<li><a href="/uploads/${file}" target="_blank">${file}</a></li>`;
    }).join('');

    res.send(`
      <h1>📁 Hochgeladene Lebensläufe</h1>
      <ul>${links}</ul>
      <a href="/">Zurück zur Startseite</a>
    `);
  });
});

// 🚀 Server starten
app.listen(3000, () => console.log('Server läuft auf http://localhost:3000'));

