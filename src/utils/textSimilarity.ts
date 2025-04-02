/**
 * Clean input text by removing extra whitespace and newlines
 */
export function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ');
}

/**
 * Tokenize string into words
 */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(word => word.length > 0);
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 100;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(item => set2.has(item)));
  const union = new Set([...set1, ...set2]);
  
  return (intersection.size / union.size) * 100;
}

/**
 * Get text similarity using word-level Jaccard similarity
 */
export function getTextMatchPercentage(text1: string, text2: string): number {
  const cleanedStr1 = cleanText(text1);
  const cleanedStr2 = cleanText(text2);
  
  const tokens1 = tokenize(cleanedStr1);
  const tokens2 = tokenize(cleanedStr2);
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  return jaccardSimilarity(set1, set2);
}