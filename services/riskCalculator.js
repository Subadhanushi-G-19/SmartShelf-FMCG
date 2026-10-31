// Health Risk Score Calculator
// Assigns risk scores (0-100) based on product type, expiry status, and storage

function calculateRiskScore(product, dynamicExpiryDate) {
  const now = new Date();
  const expiry = new Date(dynamicExpiryDate);
  const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  let riskScore = 0;

  // 1. Time-based risk (0-40 points)
  if (daysRemaining < 0) {
    const daysExpired = Math.abs(daysRemaining);
    riskScore += Math.min(40, 20 + daysExpired * 2);
  } else if (daysRemaining <= 2) {
    riskScore += 15;
  } else if (daysRemaining <= 5) {
    riskScore += 10;
  } else if (daysRemaining <= 10) {
    riskScore += 5;
  }

  // 2. Category-based risk (0-30 points)
  const categoryRisk = {
    medicine: 30,      // Highest risk - expired medicine can be harmful
    food: 25,          // High risk - food poisoning
    cosmetics: 15,     // Moderate risk - skin reactions
    household: 5,      // Low risk - reduced effectiveness
    other: 10
  };
  riskScore += categoryRisk[product.category] || 10;

  // 3. Storage condition risk (0-20 points)
  const storageRisk = {
    direct_sunlight: 20,
    hot_humid: 15,
    room_temperature: 5,
    refrigerated: 0,
    frozen: 0
  };
  riskScore += storageRisk[product.storage_condition] || 10;

  // 4. Opened product risk (0-10 points)
  if (product.date_opened) {
    const daysOpened = Math.floor((now - new Date(product.date_opened)) / (1000 * 60 * 60 * 24));
    
    if (product.category === 'food' && daysOpened > 7) {
      riskScore += 10;
    } else if (product.category === 'medicine' && daysOpened > 30) {
      riskScore += 10;
    } else if (product.category === 'cosmetics' && daysOpened > 90) {
      riskScore += 5;
    }
  }

  // Cap at 100
  return Math.min(100, riskScore);
}

function getRiskLevel(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  if (score >= 10) return 'LOW';
  return 'SAFE';
}

function getRiskDescription(score, product) {
  const level = getRiskLevel(score);
  const descriptions = {
    CRITICAL: {
      medicine: '⛔ DO NOT USE - Expired medicine may be ineffective or harmful',
      food: '⛔ DO NOT CONSUME - High risk of food poisoning',
      cosmetics: '⚠️ DO NOT USE - May cause severe skin reactions',
      household: '⚠️ Product effectiveness significantly reduced',
      other: '⚠️ Not recommended for use'
    },
    HIGH: {
      medicine: '⚠️ Use with extreme caution - consult pharmacist',
      food: '⚠️ Check for signs of spoilage before consuming',
      cosmetics: '⚠️ May cause irritation - perform patch test',
      household: 'Reduced effectiveness expected',
      other: 'Use with caution'
    },
    MEDIUM: {
      medicine: 'Use soon - effectiveness may decrease',
      food: 'Consume within next few days',
      cosmetics: 'Use soon for best results',
      household: 'Use before quality degrades',
      other: 'Use within recommended timeframe'
    },
    LOW: {
      medicine: 'Safe to use - monitor expiry date',
      food: 'Fresh and safe to consume',
      cosmetics: 'Good condition',
      household: 'Normal usage',
      other: 'Normal usage'
    },
    SAFE: {
      medicine: 'Fully safe to use',
      food: 'Fresh and safe',
      cosmetics: 'Optimal condition',
      household: 'Normal usage',
      other: 'Normal usage'
    }
  };

  return descriptions[level][product.category] || descriptions[level]['other'];
}

function generateSafetyRecommendations(product, riskScore) {
  const recommendations = [];
  const level = getRiskLevel(riskScore);

  if (level === 'CRITICAL' || level === 'HIGH') {
    if (product.category === 'medicine') {
      recommendations.push({
        icon: '💊',
        title: 'Safe Disposal',
        description: 'Take expired medicine to pharmacy for proper disposal'
      });
    } else if (product.category === 'food') {
      recommendations.push({
        icon: '🗑️',
        title: 'Discard Immediately',
        description: 'Do not consume expired food products'
      });
      recommendations.push({
        icon: '♻️',
        title: 'Compost if Possible',
        description: 'Consider composting food waste instead of trash'
      });
    }
  }

  if (level === 'MEDIUM') {
    if (product.category === 'food') {
      recommendations.push({
        icon: '👃',
        title: 'Smell Test',
        description: 'Check for unusual odor before consuming'
      });
      recommendations.push({
        icon: '👁️',
        title: 'Visual Check',
        description: 'Look for mold, discoloration, or texture changes'
      });
    }
  }

  // Storage recommendations
  if (product.storage_condition === 'direct_sunlight' || product.storage_condition === 'hot_humid') {
    recommendations.push({
      icon: '📦',
      title: 'Improve Storage',
      description: 'Move to cool, dry place away from direct sunlight'
    });
  }

  return recommendations;
}

module.exports = {
  calculateRiskScore,
  getRiskLevel,
  getRiskDescription,
  generateSafetyRecommendations
};