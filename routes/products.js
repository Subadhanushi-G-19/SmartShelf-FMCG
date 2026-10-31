const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { verifyToken } = require('./auth');
const expiryEngine = require('../services/expiryEngine');
const riskCalculator = require('../services/riskCalculator');

// Apply authentication to all product routes
router.use(verifyToken);

// Get all products for user
router.get('/', (req, res) => {
  const userId = req.user.userId;
  
  db.all(
    `SELECT * FROM products WHERE user_id = ? ORDER BY expiry_date ASC`,
    [userId],
    (err, products) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch products' 
        });
      }

      // Calculate dynamic expiry and risk for each product
      const enrichedProducts = products.map(product => {
        const dynamicExpiry = expiryEngine.calculateDynamicExpiry(product);
        const riskScore = riskCalculator.calculateRiskScore(product, dynamicExpiry);
        const daysRemaining = Math.ceil((new Date(dynamicExpiry) - new Date()) / (1000 * 60 * 60 * 24));
        
        return {
          ...product,
          dynamic_expiry_date: dynamicExpiry,
          health_risk_score: riskScore,
          days_remaining: daysRemaining,
          status: daysRemaining < 0 ? 'expired' : 
                  daysRemaining <= 3 ? 'critical' : 
                  daysRemaining <= 7 ? 'warning' : 'safe'
        };
      });

      res.json({ 
        success: true, 
        products: enrichedProducts 
      });
    }
  );
});

// Get single product
router.get('/:id', (req, res) => {
  const userId = req.user.userId;
  const productId = req.params.id;

  db.get(
    'SELECT * FROM products WHERE id = ? AND user_id = ?',
    [productId, userId],
    (err, product) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch product' 
        });
      }

      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }

      const dynamicExpiry = expiryEngine.calculateDynamicExpiry(product);
      const riskScore = riskCalculator.calculateRiskScore(product, dynamicExpiry);

      res.json({
        success: true,
        product: {
          ...product,
          dynamic_expiry_date: dynamicExpiry,
          health_risk_score: riskScore
        }
      });
    }
  );
});

// Add new product
router.post('/', (req, res) => {
  const userId = req.user.userId;
  const {
    name, category, manufacturing_date, expiry_date,
    date_opened, storage_condition, storage_location,
    quantity, unit, brand, barcode, notes
  } = req.body;

  if (!name || !category || !manufacturing_date || !expiry_date) {
    return res.status(400).json({ 
      success: false, 
      message: 'Required fields missing' 
    });
  }

  const sql = `
    INSERT INTO products (
      user_id, name, category, manufacturing_date, expiry_date, 
      original_expiry_date, date_opened, storage_condition, 
      storage_location, quantity, unit, brand, barcode, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      userId, name, category, manufacturing_date, expiry_date,
      expiry_date, date_opened, storage_condition || 'room_temperature',
      storage_location, quantity || 1, unit || 'piece', brand, barcode, notes
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to add product' 
        });
      }

      res.status(201).json({
        success: true,
        message: 'Product added successfully',
        productId: this.lastID
      });
    }
  );
});

// Update product
router.put('/:id', (req, res) => {
  const userId = req.user.userId;
  const productId = req.params.id;
  const updates = req.body;

  // Track tampering if expiry date is modified
  let tamperLog = null;
  if (updates.expiry_date) {
    db.get(
      'SELECT expiry_date, tamper_log FROM products WHERE id = ? AND user_id = ?',
      [productId, userId],
      (err, product) => {
        if (!err && product && product.expiry_date !== updates.expiry_date) {
          const log = JSON.parse(product.tamper_log || '[]');
          log.push({
            date: new Date().toISOString(),
            old_expiry: product.expiry_date,
            new_expiry: updates.expiry_date,
            user_id: userId
          });
          tamperLog = JSON.stringify(log);
        }
      }
    );
  }

  const allowedFields = [
    'name', 'category', 'manufacturing_date', 'expiry_date',
    'date_opened', 'storage_condition', 'storage_location',
    'quantity', 'unit', 'brand', 'barcode', 'notes'
  ];

  const updateFields = [];
  const updateValues = [];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      updateValues.push(updates[field]);
    }
  });

  if (tamperLog) {
    updateFields.push('tamper_log = ?');
    updateValues.push(tamperLog);
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(productId, userId);

  const sql = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

  db.run(sql, updateValues, function(err) {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update product' 
      });
    }

    if (this.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  });
});

// Delete product (move to waste log)
router.delete('/:id', (req, res) => {
  const userId = req.user.userId;
  const productId = req.params.id;
  const { reason, price } = req.body;

  // First get the product details
  db.get(
    'SELECT * FROM products WHERE id = ? AND user_id = ?',
    [productId, userId],
    (err, product) => {
      if (err || !product) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }

      // Add to waste log if expired or being discarded
      const isExpired = new Date(product.expiry_date) < new Date();
      if (isExpired || reason) {
        const environmentalImpact = calculateEnvironmentalImpact(product.category, product.quantity);
        
        db.run(
          `INSERT INTO waste_log (user_id, product_name, category, quantity, 
           original_price, waste_date, reason, environmental_impact) 
           VALUES (?, ?, ?, ?, ?, date('now'), ?, ?)`,
          [
            userId, product.name, product.category, product.quantity,
            price || 0, reason || 'Expired', environmentalImpact
          ]
        );
      }

      // Delete the product
      db.run(
        'DELETE FROM products WHERE id = ? AND user_id = ?',
        [productId, userId],
        function(err) {
          if (err) {
            return res.status(500).json({ 
              success: false, 
              message: 'Failed to delete product' 
            });
          }

          res.json({
            success: true,
            message: 'Product deleted successfully'
          });
        }
      );
    }
  );
});

// Mark product as consumed
router.post('/:id/consume', (req, res) => {
  const userId = req.user.userId;
  const productId = req.params.id;
  const { quantity } = req.body;

  db.get(
    'SELECT * FROM products WHERE id = ? AND user_id = ?',
    [productId, userId],
    (err, product) => {
      if (err || !product) {
        return res.status(404).json({ 
          success: false, 
          message: 'Product not found' 
        });
      }

      const consumedQty = quantity || 1;
      const wasExpired = new Date(product.expiry_date) < new Date();

      // Add to consumption history
      db.run(
        `INSERT INTO consumption_history (user_id, product_name, category, 
         quantity, consumed_date, was_expired) VALUES (?, ?, ?, ?, date('now'), ?)`,
        [userId, product.name, product.category, consumedQty, wasExpired ? 1 : 0]
      );

      // Update or delete product based on remaining quantity
      const newQuantity = product.quantity - consumedQty;
      
      if (newQuantity <= 0) {
        db.run('DELETE FROM products WHERE id = ?', [productId]);
      } else {
        db.run(
          'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newQuantity, productId]
        );
      }

      res.json({
        success: true,
        message: 'Consumption recorded successfully'
      });
    }
  );
});

// Helper function to calculate environmental impact
function calculateEnvironmentalImpact(category, quantity) {
  const impactPerUnit = {
    food: 2.5,      // kg CO2e
    medicine: 0.5,
    cosmetics: 1.0,
    household: 1.5,
    other: 1.0
  };
  return (impactPerUnit[category] || 1.0) * quantity;
}

module.exports = router;