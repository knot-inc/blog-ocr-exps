/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[str1.length][str2.length];
}

/**
 * Convert Levenshtein distance to similarity percentage (0-100%)
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 100;
  return (1 - distance / maxLength) * 100;
}

/**
 * Result interface for text match percentage
 */
interface TextMatchResult {
  charSimilarity: string;
  wordSimilarity: string;
  averageSimilarity: string;
}

/**
 * Get text match percentage with multiple metrics
 */
export function getTextMatchPercentage(text1: string, text2: string): TextMatchResult {
  const charSimilarity = levenshteinSimilarity(text1, text2);
  
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);
  
  const wordDistance = levenshteinDistance(words1.join(' '), words2.join(' '));
  const maxWordLength = Math.max(words1.length, words2.length);
  const wordSimilarity = maxWordLength > 0 ? (1 - wordDistance / maxWordLength) * 100 : 100;
  
  return {
    charSimilarity: charSimilarity.toFixed(2),
    wordSimilarity: wordSimilarity.toFixed(2),
    averageSimilarity: ((charSimilarity + wordSimilarity) / 2).toFixed(2)
  };
}