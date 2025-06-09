/**
 * Get suggested shoe based on session type
 * Centralized logic for shoe recommendations across the app
 */
export function getSuggestedShoe(sessionType: string): string | null {
  const type = sessionType.toLowerCase();

  // Cloudmonster for easy runs, easy run + strides, progression run, strides
  if (type.includes('easy run') || type.includes('progression run') || type === 'strides') {
    return 'Cloudmonster';
  }

  // Cloudeclipse for long run, strength training
  if (type.includes('long run') || type.includes('strength training')) {
    return 'Cloudeclipse';
  }

  // Cloudboom Zone for tempo run, hills, fartlek, strides
  if (type.includes('tempo run') || type.includes('hills') || type.includes('fartlek')) {
    return 'Cloudboom Zone';
  }

  // Cloudboom Strike for track workout, threshold
  if (type.includes('track workout') || type.includes('threshold')) {
    return 'Cloudboom Strike';
  }

  // No recommendation for cross training/rest activities
  if (type.includes('cross training') || type.includes('rest')) {
    return null;
  }

  // Default fallback for any unmatched session types
  return 'Cloudmonster';
}

/**
 * Map shoe names to product IDs for navigation to gear screen
 */
export function getProductIdFromShoeName(shoeName: string): string | null {
  const shoeNameLower = shoeName.toLowerCase();

  if (shoeNameLower.includes('cloudmonster')) {
    return 'cloudmonster-1';
  }

  if (shoeNameLower.includes('cloudeclipse')) {
    return 'cloudeclipse-1';
  }

  if (shoeNameLower.includes('cloudboom zone')) {
    return 'cloudboom-zone-1';
  }

  if (shoeNameLower.includes('cloudboom strike')) {
    return 'cloudboom-strike-1';
  }

  return null;
}
