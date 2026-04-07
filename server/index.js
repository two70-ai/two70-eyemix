require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initialize: initializeDb } = require('./db');
const { ensureBucketsExist } = require('./services/storageFactory');

const authRoutes = require('./routes/auth');
const couplesRoutes = require('./routes/couples');
const templatesRoutes = require('./routes/templates');
const mergesRoutes = require('./routes/merges');
const clientRoutes = require('./routes/client');
const cleanupRoutes = require('./routes/cleanup');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? true  // Allow same-origin in production (Express serves the frontend)
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve local storage files when using SQLite backend
if ((process.env.DB_SOURCE || '').toLowerCase() === 'sqlite') {
  const storageServe = require('./routes/storageServe');
  app.use('/api/storage', storageServe);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/couples', couplesRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/merges', mergesRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/cleanup', cleanupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // In development, also serve the client dist if it exists
  const clientDistPath = path.join(__dirname, '../client/dist');
  const fs = require('fs');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

// Initialize database and storage, then start listening
(async () => {
  try {
    await initializeDb();
    await ensureBucketsExist();
    console.log(`Database: ${process.env.DB_SOURCE || 'supabase'}`);
  } catch (err) {
    console.error('Startup initialization error:', err);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EyeMix server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
})();

module.exports = app;
