import type { z } from "zod";
import type { parseWorkExperienceSchema } from "../prompts/parse-work-experience";
import { cleanText, getTextMatchPercentage } from "./textSimilarity";

/**
 * Utilities for text matching and comparison
 */
export const matchUtils = {
	/**
	 * Get the match percentage between two strings
	 */
	getMatchPercentage: (exStr: string, gtStr: string) => {
		if (!exStr || !gtStr) return 0;
		if (exStr === gtStr) return 100;

		// For dates
		if (
			gtStr.match(/\d{4}-\d{2}(-\d{2})?/) &&
			exStr.match(/\d{4}(-\d{2}(-\d{2})?)?/)
		) {
			const parts1 = exStr.split("-");
			const parts2 = gtStr.split("-");

			if (parts1[0] === parts2[0]) {
				if (parts1.length === 1) return 33; // Year only
				if (parts1.length >= 2 && parts1[1] === parts2[1]) return 67; // Year and month
			}
			return 0;
		}

		// For text, use Jaccard similarity
		return getTextMatchPercentage(exStr, gtStr).averageSimilarity;
	},

	/**
	 * Get match emoji based on score
	 */
	getEmoji: (score: number) =>
		score === 100 ? "✅" : score > 50 ? "⚠️ " : "❌",

	/**
	 * Get date-specific note
	 */
	getDateNote: (score: number) =>
		score === 67 ? " (Year-Month)" : score === 33 ? " (Year only)" : "",

	/**
	 * Highlight differences in text
	 */
	highlightDifferences: (
		extractedText: string,
		groundTruthText: string,
	): string => {
		if (!extractedText || !groundTruthText) return extractedText || "N/A";
		if (extractedText === groundTruthText) return extractedText;

		// For dates or simple values, just return the extracted text
		if (extractedText.length < 20 || groundTruthText.length < 20) {
			return extractedText;
		}

		// For longer text like descriptions, highlight word differences
		const extractedWords = cleanText(extractedText).split(/\s+/);
		const groundTruthWords = cleanText(groundTruthText).split(/\s+/);

		const highlightedWords = extractedWords.map((word) => {
			// Using toLowerCase for case-insensitive comparison
			if (
				!groundTruthWords.some(
					(gtWord) => gtWord.toLowerCase() === word.toLowerCase(),
				)
			) {
				// Highlight different words with ANSI color codes (red)
				return `\x1b[31m${word}\x1b[0m`;
			}
			return word;
		});

		return highlightedWords.join(" ");
	},
};

/**
 * Find the best matching job in ground truth jobs based on field similarity
 */
export function findBestMatch(
	job: z.infer<typeof parseWorkExperienceSchema>["workExperiences"][0],
	groundTruthJobs: z.infer<typeof parseWorkExperienceSchema>["workExperiences"],
): { index: number; score: number } {
	let bestIndex = -1;
	let bestScore = 0;

	for (const [j, gtJob] of groundTruthJobs.entries()) {
		const fields = ["title", "company", "startDate", "endDate"];
		let score = 0;

		for (const field of fields) {
			if (
				job[field as keyof typeof job] &&
				gtJob[field as keyof typeof gtJob]
			) {
				score +=
					matchUtils.getMatchPercentage(
						job[field as keyof typeof job] as string,
						gtJob[field as keyof typeof gtJob] as string,
					) > 50
						? 1
						: 0;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestIndex = j;
		}
	}

	return { index: bestIndex, score: bestScore };
}

/**
 * Compare fields between an extracted job and a ground truth job
 */
export function compareFields(
	job: z.infer<typeof parseWorkExperienceSchema>["workExperiences"][0],
	gtJob: z.infer<typeof parseWorkExperienceSchema>["workExperiences"][0],
	verbose = true,
): { fieldMatches: number[]; fieldTypeScores: Record<string, number> } {
	const fieldMatches: number[] = [];
	const fieldTypeScores: Record<string, number> = {};

	const fields: Array<{
		key: keyof z.infer<typeof parseWorkExperienceSchema>["workExperiences"][0];
		name: string;
		isDate: boolean;
	}> = [
		{ key: "title", name: "Title", isDate: false },
		{ key: "company", name: "Company", isDate: false },
		{ key: "startDate", name: "Start Date", isDate: true },
		{ key: "endDate", name: "End Date", isDate: true },
		{ key: "description", name: "Description", isDate: false },
	];

	for (const field of fields) {
		if (gtJob[field.key]) {
			if (!job[field.key]) {
				fieldMatches.push(0);
				fieldTypeScores[field.name] = 0;
				continue;
			}

			const match = matchUtils.getMatchPercentage(
				job[field.key] as string,
				gtJob[field.key] as string,
			);
			fieldMatches.push(match);

			// Store the match score for this field type
			fieldTypeScores[field.name] = match;

			if (verbose) {
				const emoji = matchUtils.getEmoji(match);
				const note = field.isDate ? matchUtils.getDateNote(match) : "";

				// Only show expected value when score is less than 100%
				const expectedValue =
					match < 100 ? ` (Expected: ${gtJob[field.key]})` : "";

				// Highlight differences in text
				const displayValue = (job[field.key] as string) || "N/A";

				// For descriptions or other long fields, we format the output nicely
				if (field.key === "description") {
					console.log(
						`  ${emoji} ${field.name.padEnd(12)}: ${match.toFixed(0)}% match${note}`,
					);

					// If there's an expected value, print it on a separate line for better readability
					if (match < 100) {
						console.log(`    ${displayValue}`);
						console.log(`    Expected: ${gtJob[field.key]}`);
					}
				} else {
					// For other fields, keep the current inline format
					console.log(
						`  ${emoji} ${field.name.padEnd(12)}: ${match.toFixed(0)}% match${note}, ` +
							`${displayValue}${expectedValue}`,
					);
				}
			}
		}
	}

	return { fieldMatches, fieldTypeScores };
}
