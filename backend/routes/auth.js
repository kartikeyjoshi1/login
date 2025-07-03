const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ✅ Smart login or auto-register route
router.post('/smart-login', async (req, res) => {
  const { email, password, username } = req.body;

  try {
    let user = await User.findOne({ email });

    if (user) {
      // ✅ User exists → check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: '❌ Wrong password' });
      }
    } else {
      // ✅ Check if username already exists
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: '❌ Username already taken' });
      }

      // ✅ New user → register
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        email,
        username: username || email.split('@')[0],
        password: hashedPassword
      });
      await user.save();
    }

    // ✅ Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });

    res.json({ message: '✅ Login/Register successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '❌ Server error' });
  }
});

// ✅ Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// ✅ Protected route: Get user profile info
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      userId: user._id,
      email: user.email,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
const multer = require('multer');
const path = require('path');

// ✅ Storage config for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, req.userId + ext);
  }
});

const upload = multer({ storage });

// ✅ Upload photo (protected route)
router.post('/upload-photo', verifyToken, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '❌ No file uploaded' });
  }

  // You can also save the file path in the User model here
  res.json({ message: '✅ Photo uploaded successfully', file: req.file.filename });
});
