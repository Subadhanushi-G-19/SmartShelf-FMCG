const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { verifyToken } = require('./auth');

router.use(verifyToken);

// Get all notifications for user
router.get('/', (req, res) => {
  const userId = req.user.userId;
  const { unreadOnly } = req.query;

  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params = [userId];

  if (unreadOnly === 'true') {
    sql += ' AND is_read = 0';
  }

  sql += ' ORDER BY created_at DESC LIMIT 100';

  db.all(sql, params, (err, notifications) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch notifications' 
      });
    }

    res.json({
      success: true,
      notifications
    });
  });
});

// Get unread count
router.get('/unread-count', (req, res) => {
  const userId = req.user.userId;

  db.get(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch count' 
        });
      }

      res.json({
        success: true,
        count: result.count
      });
    }
  );
});

// Mark notification as read
router.put('/:id/read', (req, res) => {
  const userId = req.user.userId;
  const notificationId = req.params.id;

  db.run(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notificationId, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to update notification' 
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    }
  );
});

// Mark all as read
router.put('/mark-all-read', (req, res) => {
  const userId = req.user.userId;

  db.run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [userId],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to update notifications' 
        });
      }

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    }
  );
});

// Delete notification
router.delete('/:id', (req, res) => {
  const userId = req.user.userId;
  const notificationId = req.params.id;

  db.run(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [notificationId, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to delete notification' 
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted'
      });
    }
  );
});

module.exports = router;