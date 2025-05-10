/**
 * Formats field names for display
 */
export function formatField(field: string): string {
  // Format camelCase to Title Case (e.g. currentMileage -> Current Mileage)
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Helper function to normalize extracted data
 */
export function normalizeProfileData(
  extractedData: Record<string, string | null>,
  currentProfile: Record<string, any>
): Record<string, string | null> {
  const normalized: Record<string, string | null> = {};
  
  // Process each extracted field
  Object.entries(extractedData).forEach(([key, value]) => {
    // Skip undefined, but properly handle explicit null values
    if (value === undefined) return;
    
    // Handle explicit null values for race-related fields
    if (value === null && (key === 'race_distance' || key === 'race_date')) {
      normalized[key] = null;
      return;
    }
    
    // Skip empty strings
    if (value === '') return;
    
    // Handle special cases for null or negative responses
    if (value && typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      
      // Handle negative responses for race-related fields
      if ((key === 'race_distance' || key === 'race_date') && 
          (lowerValue.includes('no race') || 
           lowerValue.includes('none') || 
           lowerValue.includes('no upcoming') || 
           lowerValue === 'null' || 
           lowerValue === 'n/a')) {
        normalized[key] = null;
        return;
      }
    }
    
    // If we reach here, we have a non-null value to process
    if (!value) return;
    
    switch (key) {
      case 'current_mileage':
        // Better handling for mileage values with or without units
        if (/^\d+$/.test(value)) {
          // Just a number, add the current units
          const units = currentProfile.units || 'km';
          normalized[key] = `${value} ${units}`;
        } else if (/^\d+\s*(km|kms|kilometers|miles|mi)/.test(value.toLowerCase())) {
          // Number with units included - keep as is
          normalized[key] = value;
        } else {
          // Any other format, keep as is
          normalized[key] = value;
        }
        break;
        
      case 'current_frequency':
        // Ensure frequency mentions days or times per week
        if (/^\d+$/.test(value)) {
          normalized[key] = `${value} days per week`;
        } else {
          normalized[key] = value;
        }
        break;
        
      case 'units':
        // Normalize units to km or miles
        if (value.toLowerCase().includes('km') || 
            value.toLowerCase().includes('kilometer')) {
          normalized[key] = 'km';
        } else if (value.toLowerCase().includes('mile')) {
          normalized[key] = 'miles';
        } else {
          normalized[key] = value;
        }
        break;
        
      case 'experience_level':
        // Normalize experience levels but keep years if mentioned
        if (/\d+\s*years?/.test(value.toLowerCase())) {
          // Keep the year information intact
          normalized[key] = value;
        } else if (value.toLowerCase().includes('begin')) {
          normalized[key] = 'beginner';
        } else if (value.toLowerCase().includes('inter')) {
          normalized[key] = 'intermediate';
        } else if (value.toLowerCase().includes('advanc')) {
          normalized[key] = 'advanced';
        } else {
          normalized[key] = value;
        }
        break;
        
      case 'schedule_constraints':
        // Normalize schedule constraints for "open" or "flexible" responses
        if (value.toLowerCase().includes('open') || 
            value.toLowerCase().includes('flexible') || 
            value.toLowerCase().includes('available') ||
            value.toLowerCase().includes('no specific') ||
            value.toLowerCase().includes('none')) {
          normalized[key] = 'flexible schedule';
        } else {
          normalized[key] = value;
        }
        break;
        
      default:
        normalized[key] = value;
    }
  });
  
  console.log('NORMALIZED EXTRACTION RESULT:', normalized);
  return normalized;
} 