const cron = require('node-cron');
const db = require('../database/init');
const expiryEngine = require('./expiryEngine');
const riskCalculator = require('./riskCalculator');

function start() {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', () => {
    console.log('🔔 Running daily notification check...');
    checkAndCreateNotifications();
  });

  // Also run on startup
  setTimeout(() => {
    console.log('🔔 Running initial notification check...');
    checkAndCreateNotifications();
  }, 5000);

  console.log('✅ Notification scheduler started');
}

function checkAndCreateNotifications() {
  // Get all users with notification preferences
  db.all(
    `SELECT u.id as user_id, up.* 
     FROM users u 
     LEFT JOIN user_preferences up ON u.id = up.user_id 
     WHERE up.notification_enabled = 1 OR up.notification_enabled IS NULL`,
    [],
    (err, users) => {
      if (err) {
        console.error('Error fetching users:', err);
        return;
      }

      users.forEach(user => {
        checkUserProducts(user);
      });
    }
  );
}

function checkUserProducts(user) {
  const criticalDays = user.critical_alert_days || 3;
  const warningDays = user.warning_alert_days || 7;
  const normalDays = user.normal_alert_days || 14;

  db.all(
    'SELECT * FROM products WHERE user_id = ?',
    [user.user_id],
    (err, products) => {
      if (err) {
        console.error('Error fetching products:', err);
        return;
      }

      products.forEach(product => {
        const dynamicExpiry = expiryEngine.calculateDynamicExpiry(product);
        const riskScore = riskCalculator.calculateRiskScore(product, dynamicExpiry);
        const daysRemaining = Math.ceil(
          (new Date(dynamicExpiry) - new Date()) / (1000 * 60 * 60 * 24)
        );

        // Check if notification already exists for today
        db.get(
          `SELECT id FROM notifications 
           WHERE user_id = ? 
             AND product_id = ? 
             AND date(created_at) = date('now')`,
          [user.user_id, product.id],
          (err, existing) => {
            if (err || existing) return;

            let shouldNotify = false;
            let priority = 'low';
            let title = '';
            let message = '';

            if (daysRemaining < 0) {
              shouldNotify = true;
              priority = 'critical';
              title = `⛔ ${product.name} has EXPIRED`;
              message = `This ${product.category} expired ${Math.abs(daysRemaining)} days ago. Risk Score: ${riskScore}/100. Do not use.`;
            } else if (daysRemaining <= criticalDays) {
              shouldNotify = true;
              priority = 'critical';
              title = `🚨 URGENT: ${product.name} expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
              message = `Risk Score: ${riskScore}/100. Use immediately or discard safely.`;
            } else if (daysRemaining <= warningDays) {
              shouldNotify = true;
              priority = 'high';
              title = `⚠️ ${product.name} expires soon`;
              message = `${daysRemaining} days remaining. Plan to use this ${product.category} soon.`;
            } else if (daysRemaining <= normalDays) {
              shouldNotify = true;
              priority = 'medium';
              title = `📅 ${product.name} expiry reminder`;
              message = `${daysRemaining} days until expiry. Add to your shopping list if you need more.`;
            }

            // Additional notifications for poor storage
            if (product.storage_condition === 'direct_sunlight' || 
                product.storage_condition === 'hot_humid') {
              shouldNotify = true;
              if (priority === 'low') priority = 'medium';
              message += ` ⚠️ Poor storage conditions detected - move to better location.`;
            }

            if (shouldNotify) {
              createNotification(user.user_id, product.id, priority, title, message);
            }
          }
        );
      });
    }
  );
}

function createNotification(userId, productId, priority, title, message) {
  const type = priority === 'critical' ? 'expiry_critical' : 
               priority === 'high' ? 'expiry_warning' : 'expiry_reminder';

  db.run(
    `INSERT INTO notifications (user_id, product_id, type, priority, title, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, productId, type, priority, title, message],
    (err) => {
      if (err) {
        console.error('Error creating notification:', err);
      } else {
        console.log(`✅ Notification created: ${title}`);
      }
    }
  );
}

// Manual trigger for testing
function triggerManualCheck() {
  console.log('🔔 Manual notification check triggered');
  checkAndCreateNotifications();
}

module.exports = {
  start,
  triggerManualCheck
};