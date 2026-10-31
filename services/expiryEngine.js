// Dynamic Expiry Recalculation Engine
// Adjusts expiry dates based on storage conditions and product characteristics

const storageFactors = {
  refrigerated: {
    food: 1.5,        // Extends by 50%
    medicine: 1.2,
    cosmetics: 1.3,
    household: 1.0,
    other: 1.1
  },
  frozen: {
    food: 3.0,        // Extends by 200%
    medicine: 1.5,
    cosmetics: 1.0,
    household: 1.0,
    other: 1.2
  },
  room_temperature: {
    food: 1.0,        // No change
    medicine: 1.0,
    cosmetics: 1.0,
    household: 1.0,
    other: 1.0
  },
  hot_humid: {
    food: 0.7,        // Reduces by 30%
    medicine: 0.6,
    cosmetics: 0.8,
    household: 0.9,
    other: 0.85
  },
  direct_sunlight: {
    food: 0.5,
    medicine: 0.4,
    cosmetics: 0.6,
    household: 0.8,
    other: 0.7
  }
};

const openedProductFactors = {
  food: 0.3,          // Once opened, use within 30% of original shelf life
  medicine: 0.5,
  cosmetics: 0.6,
  household: 0.8,
  other: 0.7
};

function calculateDynamicExpiry(product) {
  const mfgDate = new Date(product.manufacturing_date);
  const originalExpiry = new Date(product.original_expiry_date);
  const now = new Date();

  // Calculate original shelf life in days
  const originalShelfLife = Math.floor((originalExpiry - mfgDate) / (1000 * 60 * 60 * 24));

  // Get storage factor
  const storageFactor = storageFactors[product.storage_condition]?.[product.category] || 1.0;

  // Adjust shelf life based on storage
  let adjustedShelfLife = originalShelfLife * storageFactor;

  // If product is opened, apply opened factor
  if (product.date_opened) {
    const openedDate = new Date(product.date_opened);
    const daysOpenedFactor = openedProductFactors[product.category] || 0.7;
    
    // Calculate remaining life from opened date
    const postOpeningShelfLife = Math.floor(adjustedShelfLife * daysOpenedFactor);
    const newExpiry = new Date(openedDate);
    newExpiry.setDate(newExpiry.getDate() + postOpeningShelfLife);
    
    return newExpiry.toISOString().split('T')[0];
  }

  // Calculate new expiry date from manufacturing date
  const dynamicExpiry = new Date(mfgDate);
  dynamicExpiry.setDate(dynamicExpiry.getDate() + Math.floor(adjustedShelfLife));

  return dynamicExpiry.toISOString().split('T')[0];
}

function getStorageRecommendation(product) {
  const recommendations = [];

  if (product.category === 'food') {
    if (product.storage_condition === 'room_temperature') {
      recommendations.push('Consider refrigerating to extend shelf life by 50%');
    } else if (product.storage_condition === 'hot_humid') {
      recommendations.push('⚠️ Hot/humid storage reduces shelf life by 30% - move to cooler location');
    }
  }

  if (product.storage_condition === 'direct_sunlight') {
    recommendations.push('⚠️ Direct sunlight exposure significantly reduces product quality - store in dark place');
  }

  if (product.date_opened && !product.storage_condition.includes('refrigerated')) {
    const category = product.category;
    if (['food', 'medicine'].includes(category)) {
      recommendations.push('Opened products should be refrigerated when possible');
    }
  }

  return recommendations;
}

function calculateOptimalUsageSchedule(products) {
  // Sort products by adjusted expiry and priority
  const sorted = products
    .map(p => ({
      ...p,
      dynamic_expiry: calculateDynamicExpiry(p),
      priority_score: calculatePriorityScore(p)
    }))
    .sort((a, b) => {
      const dateA = new Date(a.dynamic_expiry);
      const dateB = new Date(b.dynamic_expiry);
      return dateA - dateB;
    });

  return sorted;
}

function calculatePriorityScore(product) {
  const daysRemaining = Math.ceil(
    (new Date(calculateDynamicExpiry(product)) - new Date()) / (1000 * 60 * 60 * 24)
  );

  let score = 100;

  // Urgency factor
  if (daysRemaining <= 0) score += 100;
  else if (daysRemaining <= 2) score += 50;
  else if (daysRemaining <= 5) score += 25;
  else if (daysRemaining <= 10) score += 10;

  // Category factor
  if (product.category === 'medicine') score += 30;
  else if (product.category === 'food') score += 20;

  // Quantity factor (more items = higher priority)
  score += product.quantity * 2;

  return score;
}

module.exports = {
  calculateDynamicExpiry,
  getStorageRecommendation,
  calculateOptimalUsageSchedule,
  calculatePriorityScore
};