const express = require('express');
const db = require('../db');

const router = express.Router();

// Simple in-memory session store (for demo; in production use Redis/sessions)
const sessions = new Map();

function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * POST /api/auth/register
 * Body: { email, password, name }
 */
router.post('/register', (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Create new user (in production, hash password with bcrypt)
    const user = {
      email,
      password, // WARNING: Never store plain passwords in production!
      name,
      created_at: new Date().toISOString()
    };

    db.addUser(user);

    // Create session
    const token = generateSessionToken();
    sessions.set(token, { email, name, created_at: Date.now() });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { email, name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register user', details: err.message });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // In production, use bcrypt to compare hashed password
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create session
    const token = generateSessionToken();
    sessions.set(token, { email: user.email, name: user.name, created_at: Date.now() });

    res.json({
      message: 'Login successful',
      token,
      user: { email: user.email, name: user.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to login', details: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Headers: { Authorization: "Bearer <token>" }
 */
router.post('/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      sessions.delete(token);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout', details: err.message });
  }
});

/**
 * GET /api/auth/me
 * Headers: { Authorization: "Bearer <token>" }
 */
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);
    const session = sessions.get(token);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.json({ user: { email: session.email, name: session.name } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify session', details: err.message });
  }
});

module.exports = router;
