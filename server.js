const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./autism_data.db');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serves static files from the 'public' directory

// Create tables if they don't exist
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT,
            name TEXT,
            age INTEGER
        )
    `);

    // Screening table
    db.run(`
        CREATE TABLE IF NOT EXISTS screening (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            q1 TEXT,
            q2 TEXT,
            q3 TEXT,
            q4 TEXT,
            q5 TEXT,
            percentage REAL,
            level TEXT,
            recommendations TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);
});

// Routes

// Serve Registration Page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve Screening Page
app.get('/screening', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'screening.html'));
});

// Handle Registration
app.post('/register', async (req, res) => {
    const { name, email, password, age } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (name, email, password, age) VALUES (?, ?, ?, ?)`,
            [name, email, hashedPassword, age],
            (err) => {
                if (err) {
                    console.error(err);
                    return res.send('Error registering user. Maybe the email is already in use.');
                }
                res.send('<h1>Registration successful!</h1><p><a href="/login">Go to Login</a></p>');
            }
        );
    } catch (error) {
        res.status(500).send('Error registering user.');
    }
});

// Handle Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.send('Invalid email or password.');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (isValid) {
            res.redirect('/screening'); // Redirect to screening page on successful login
        } else {
            res.send('Invalid email or password.');
        }
    });
});

// Handle Screening Submission
app.post('/submit_screening', (req, res) => {
    const { userId, q1, q2, q3, q4, q5 } = req.body;
    const points = { "often": 3, "sometimes": 2, "rarely": 1, "never": 0 };

    const totalScore = points[q1] + points[q2] + points[q3] + points[q4] + points[q5];
    const percentage = (totalScore / 15) * 100;

    let level = '';
    let recommendations = '';

    if (percentage >= 70) {
        level = 'Severe';
        recommendations = 'Consult a specialist. Focus on sensory toys, routines, and calming games.';
    } else if (percentage >= 40) {
        level = 'Moderate';
        recommendations = 'Try picture games, music, and interactive activities.';
    } else {
        level = 'Mild';
        recommendations = 'Encourage group play, storytelling, and creative activities.';
    }

    // Save data to the database
    db.run(
        `INSERT INTO screening (user_id, q1, q2, q3, q4, q5, percentage, level, recommendations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, q1, q2, q3, q4, q5, percentage, level, recommendations],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error saving screening data.');
            }
            res.json({ percentage, level, recommendations });
        }
    );
});

// Start the Server
const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
