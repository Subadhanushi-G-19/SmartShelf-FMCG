const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { verifyToken } = require('./auth');

router.use(verifyToken);

// Get financial waste dashboard
router.get('/waste-dashboard', (req, res) => {
  const userId = req.user.userId;
  const { startDate, endDate } = req.query;

  let dateFilter = '';
  const params = [userId];

  if (startDate && endDate) {
    dateFilter = 'AND waste_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  db.all(
    `SELECT 
      SUM(original_price) as total_money_wasted,
      SUM(environmental_impact) as total_carbon_footprint,
      COUNT(*) as total_items_wasted,
      category,
      SUM(quantity) as quantity_wasted,
      SUM(original_price) as category_waste
     FROM waste_log 
     WHERE user_id = ? ${dateFilter}
     GROUP BY category`,
    params,
    (err, categoryData) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch waste data' 
        });
      }

      db.get(
        `SELECT 
          SUM(original_price) as total_waste,
          SUM(environmental_impact) as total_impact,
          COUNT(*) as total_items
         FROM waste_log 
         WHERE user_id = ? ${dateFilter}`,
        params,
        (err, totals) => {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Failed to fetch totals' 
            });
          }

          res.json({
            success: true,
            data: {
              totalMoneyWasted: totals.total_waste || 0,
              totalCarbonFootprint: totals.total_impact || 0,
              totalItemsWasted: totals.total_items || 0,
              categoryBreakdown: categoryData,
              averageWastePerItem: totals.total_items > 0 
                ? (totals.total_waste / totals.total_items).toFixed(2) 
                : 0
            }
          });
        }
      );
    }
  );
});

// Get consumption analytics
router.get('/consumption-patterns', (req, res) => {
  const userId = req.user.userId;

  db.all(
    `SELECT 
      category,
      COUNT(*) as consumption_count,
      SUM(quantity) as total_quantity,
      SUM(CASE WHEN was_expired = 1 THEN 1 ELSE 0 END) as expired_count,
      strftime('%Y-%m', consumed_date) as month
     FROM consumption_history
     WHERE user_id = ?
     GROUP BY category, month
     ORDER BY month DESC
     LIMIT 100`,
    [userId],
    (err, patterns) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch consumption patterns' 
        });
      }

      res.json({
        success: true,
        data: patterns
      });
    }
  );
});

// Get predictive buying insights
router.get('/buying-insights', (req, res) => {
  const userId = req.user.userId;

  // Analyze past 3 months of consumption
  db.all(
    `SELECT 
      category,
      product_name,
      COUNT(*) as purchase_frequency,
      AVG(quantity) as avg_quantity,
      SUM(CASE WHEN was_expired = 1 THEN 1 ELSE 0 END) as waste_count
     FROM consumption_history
     WHERE user_id = ? 
       AND consumed_date >= date('now', '-3 months')
     GROUP BY category, product_name
     HAVING purchase_frequency >= 2
     ORDER BY purchase_frequency DESC`,
    [userId],
    (err, insights) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch buying insights' 
        });
      }

      // Generate recommendations
      const recommendations = insights.map(item => {
        const wasteRate = item.waste_count / item.purchase_frequency;
        let suggestion = '';

        if (wasteRate > 0.3) {
          suggestion = `Consider buying ${item.product_name} in smaller quantities - ${Math.round(wasteRate * 100)}% waste rate detected`;
        } else if (item.purchase_frequency > 8) {
          suggestion = `${item.product_name} is frequently used - consider buying in bulk to save money`;
        } else {
          suggestion = `Your ${item.product_name} consumption is optimal`;
        }

        return {
          ...item,
          waste_rate: (wasteRate * 100).toFixed(1),
          recommendation: suggestion
        };
      });

      res.json({
        success: true,
        insights: recommendations
      });
    }
  );
});

// Get current inventory summary
router.get('/inventory-summary', (req, res) => {
  const userId = req.user.userId;

  db.all(
    `SELECT 
      category,
      COUNT(*) as item_count,
      SUM(quantity) as total_quantity,
      SUM(CASE 
        WHEN julianday(expiry_date) - julianday('now') < 0 THEN 1 
        ELSE 0 
      END) as expired_count,
      SUM(CASE 
        WHEN julianday(expiry_date) - julianday('now') BETWEEN 0 AND 3 THEN 1 
        ELSE 0 
      END) as critical_count,
      SUM(CASE 
        WHEN julianday(expiry_date) - julianday('now') BETWEEN 4 AND 7 THEN 1 
        ELSE 0 
      END) as warning_count
     FROM products
     WHERE user_id = ?
     GROUP BY category`,
    [userId],
    (err, summary) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch inventory summary' 
        });
      }

      res.json({
        success: true,
        summary
      });
    }
  );
});

// Get rescue recommendations
router.get('/rescue-recommendations', (req, res) => {
  const userId = req.user.userId;

  db.all(
    `SELECT 
      id, name, category, quantity, expiry_date,
      julianday(expiry_date) - julianday('now') as days_remaining
     FROM products
     WHERE user_id = ?
       AND julianday(expiry_date) - julianday('now') BETWEEN 0 AND 7
     ORDER BY days_remaining ASC`,
    [userId],
    (err, products) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch products' 
        });
      }

      const recommendations = products.map(product => {
        const suggestions = generateRescueSuggestions(product);
        return {
          ...product,
          recommendations: suggestions
        };
      });

      res.json({
        success: true,
        recommendations
      });
    }
  );
});

// Helper function to generate rescue suggestions
function generateRescueSuggestions(product) {
  const suggestions = [];
  const daysRemaining = Math.floor(product.days_remaining);

  if (product.category === 'food') {
    if (daysRemaining <= 2) {
      suggestions.push({
        type: 'recipe',
        title: `Quick ${product.name} Recipe`,
        description: `Make a quick dish with ${product.name} today!`
      });
      suggestions.push({
        type: 'preservation',
        title: 'Freeze It',
        description: `Freeze ${product.name} to extend shelf life by several months`
      });
    }
    if (product.quantity > 2) {
      suggestions.push({
        type: 'donation',
        title: 'Donate to Food Bank',
        description: `Consider donating excess ${product.name} to local food banks`
      });
    }
  } else if (product.category === 'medicine') {
    suggestions.push({
      type: 'alert',
      title: 'Medicine Expiring',
      description: `${product.name} needs to be used or disposed of safely`
    });
  } else if (product.category === 'cosmetics') {
    suggestions.push({
      type: 'usage',
      title: 'Use Daily',
      description: `Increase usage frequency of ${product.name}`
    });
  }

  return suggestions;
}

module.exports = router;