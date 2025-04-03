/**
 * Clean input text by removing punctuation, newlines, and normalizing whitespace
 */
export function cleanText(text: string): string {
	// Remove all punctuation and special characters, keeping only letters, numbers and spaces
	const cleanedText = text
		.replace(/[^\w\s]/g, "") // Remove all punctuation and special characters
		.replace(/[\r\n\t]/g, " ") // Replace newlines and tabs with spaces
		.replace(/\s+/g, " ") // Normalize whitespace (multiple spaces to single space)
		.trim() // Remove leading/trailing whitespace
		.toLowerCase(); // Convert to lowercase

	return cleanedText;
}

/**
 * Tokenize string into words or characters
 */
export function tokenize(text: string, byCharacter = false): string[] {
	if (byCharacter) {
		return text.split("");
	}
	return text.split(/\s+/);
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity(
	set1: Set<string>,
	set2: Set<string>,
): number {
	if (set1.size === 0 && set2.size === 0) return 100;
	if (set1.size === 0 || set2.size === 0) return 0;

	const intersection = new Set([...set1].filter((item) => set2.has(item)));
	const union = new Set([...set1, ...set2]);

	return (intersection.size / union.size) * 100;
}

/**
 * Calculate Jaccard similarity between two strings
 */
export function calculateJaccardSimilarity(
	str1: string,
	str2: string,
	byCharacter = false,
): number {
	const cleanedStr1 = cleanText(str1);
	const cleanedStr2 = cleanText(str2);

	const tokens1 = tokenize(cleanedStr1, byCharacter);
	const tokens2 = tokenize(cleanedStr2, byCharacter);

	const set1 = new Set(tokens1);
	const set2 = new Set(tokens2);

	return jaccardSimilarity(set1, set2);
}

/**
 * Generate n-grams from text
 */
export function generateNgrams(
	text: string,
	n: number,
	byCharacter = false,
): string[] {
	const tokens = tokenize(text, byCharacter);
	const ngrams: string[] = [];

	for (let i = 0; i <= tokens.length - n; i++) {
		ngrams.push(tokens.slice(i, i + n).join(byCharacter ? "" : " "));
	}

	return ngrams;
}

/**
 * Calculate n-gram based Jaccard similarity
 */
export function ngramJaccardSimilarity(
	str1: string,
	str2: string,
	n = 2,
	byCharacter = false,
): number {
	const cleanedStr1 = cleanText(str1);
	const cleanedStr2 = cleanText(str2);

	const ngrams1 = generateNgrams(cleanedStr1, n, byCharacter);
	const ngrams2 = generateNgrams(cleanedStr2, n, byCharacter);

	const set1 = new Set(ngrams1);
	const set2 = new Set(ngrams2);

	return jaccardSimilarity(set1, set2);
}

interface TextMatchResult {
	characterSimilarity: number;
	wordSimilarity: number;
	bigramSimilarity: number;
	averageSimilarity: number;
}

/**
 * Get text similarity using multiple metrics
 */
export function getTextMatchPercentage(
	text1: string,
	text2: string,
): TextMatchResult {
	const charSimilarity = calculateJaccardSimilarity(text1, text2, true);
	const wordSimilarity = calculateJaccardSimilarity(text1, text2, false);
	const bigramSimilarity = ngramJaccardSimilarity(text1, text2, 2, true);
	const avgSimilarity =
		(charSimilarity + wordSimilarity + bigramSimilarity) / 3;

	return {
		characterSimilarity: charSimilarity,
		wordSimilarity: wordSimilarity,
		bigramSimilarity: bigramSimilarity,
		averageSimilarity: avgSimilarity,
	};
}
