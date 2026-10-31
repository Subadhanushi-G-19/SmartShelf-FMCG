console.log('🚀 Starting ExpireXpert Server...');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('✅ Packages loaded successfully');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

console.log('✅ Middleware configured');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');

console.log('✅ Routes loaded');

// Initialize database
const db = require('./database/init');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

console.log('✅ API routes configured');

// Serve main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start notification scheduler
const notificationScheduler = require('./services/notificationScheduler');
notificationScheduler.start();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🎉 ExpireXpert Server RUNNING!');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('========================================\n');
  console.log('✅ Server is ready!');
  console.log('Open http://localhost:3000 in your browser');
  console.log('Press Ctrl+C to stop\n');
});

console.log('🎯 Server setup complete, waiting for connections...');