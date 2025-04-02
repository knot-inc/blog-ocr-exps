import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { parseWorkExperienceSchema } from "../prompts/parse-work-experience";

// String matching utilities
const matchUtils = {
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

		// For text
		const words2 = [...new Set(gtStr.toLowerCase().split(/\s+/))].filter(
			(w) => w.length > 3,
		);
		const words1 = exStr.toLowerCase().split(/\s+/);
		return (
			(words2.filter((w) => words1.includes(w)).length / words2.length) * 100
		);
	},

	// Get match emoji based on score
	getEmoji: (score: number) => (score === 100 ? "✅" : score > 50 ? "⚠️ " : "❌"),

	// Get date-specific note
	getDateNote: (score: number) =>
		score === 67 ? " (Year-Month)" : score === 33 ? " (Year only)" : "",
};

export async function compareToGroundTruth(
	imageInputFn: (
		imagePath: string,
	) => Promise<z.infer<typeof parseWorkExperienceSchema>>,
	groundTruthPath: string,
): Promise<
	Array<{
		imagePath: string;
		fieldMatchRate: number;
	}>
> {
	try {
		const imagePaths: string[] = [
			"./assets/images/standard.png",
			"./assets/images/side-by-side.png",
			"./assets/images/split.png",
			"./assets/images/decorated.png",
		];

		const groundTruth: z.infer<typeof parseWorkExperienceSchema> = JSON.parse(
			fs.readFileSync(path.resolve(groundTruthPath), "utf8"),
		);
		const results: Array<{
			imagePath: string;
			fieldMatchRate: number;
		}> = [];

		for (const imagePath of imagePaths) {
			try {
				const result = await imageInputFn(imagePath);
				const comparison = compareExperiences(result, groundTruth, imagePath);
				results.push(comparison);
			} catch (error) {
				console.error(`Error processing ${imagePath}:`, error);
			}
		}

		// Print summary
		console.log("\n===== SUMMARY =====");
		for (const r of results) {
			console.log(`${r.imagePath}: Fields: ${r.fieldMatchRate}%`);
		}

		const avgFieldMatch =
			results.reduce((sum, r) => sum + r.fieldMatchRate, 0) / results.length;

		console.log(`Average field match: ${avgFieldMatch.toFixed(1)}%`);

		return results;
	} catch (error) {
		console.error("Comparison error:", error);
		throw error;
	}
}
function findBestMatch(
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

function compareFields(
	job: z.infer<typeof parseWorkExperienceSchema>["workExperiences"][0],
	gtJob: z.infer<typeof parseWorkExperienceSchema>["workExperiences"][0],
): number[] {
	const fieldMatches: number[] = [];
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
		if (job[field.key] && gtJob[field.key]) {
			const match = matchUtils.getMatchPercentage(
				job[field.key] as string,
				gtJob[field.key] as string,
			);
			fieldMatches.push(match);

			const emoji = matchUtils.getEmoji(match);
			const note = field.isDate ? matchUtils.getDateNote(match) : "";

			// Only show expected value when score is less than 100%
			const expectedValue = match < 100 ? ` (Expected: ${gtJob[field.key]})` : '';
			
			console.log(
				`  ${emoji} ${field.name.padEnd(12)}: ${match.toFixed(0)}% match${note}, ` +
					`${job[field.key] || "N/A"}${expectedValue}`,
			);
		}
	}

	return fieldMatches;
}

function compareExperiences(
	extracted: z.infer<typeof parseWorkExperienceSchema>,
	groundTruth: z.infer<typeof parseWorkExperienceSchema>,
	imagePath: string,
): {
	imagePath: string;
	fieldMatchRate: number;
} {
	console.log(`\n========== ${imagePath} ==========`);
	const fieldMatchRates: number[] = [];

	for (let i = 0; i < extracted.workExperiences.length; i++) {
		const job = extracted.workExperiences[i];
		console.log(`\nWork experience #${i + 1}:`);

		// Find best match
		const bestMatch = findBestMatch(job, groundTruth.workExperiences);

		if (bestMatch.score >= 2) {
			console.log(`Match with ground truth #${bestMatch.index + 1}`);

			// Compare fields
			const gtJob = groundTruth.workExperiences[bestMatch.index];
			const fieldMatches = compareFields(job, gtJob);

			// Calculate job match rate
			const jobMatchRate =
				fieldMatches.reduce((sum, rate) => sum + rate, 0) / fieldMatches.length;
			console.log(`  Field match rate: ${jobMatchRate.toFixed(1)}%`);
			fieldMatchRates.push(jobMatchRate);
		} else {
			console.log(`❌ No good match found. Best score: ${bestMatch.score}`);
		}
	}

	// Calculate overall field match rate
	const overallMatchRate =
		fieldMatchRates.length > 0
			? fieldMatchRates.reduce((sum, rate) => sum + rate, 0) /
				fieldMatchRates.length
			: 0;

	console.log(`\nOverall field match rate: ${overallMatchRate.toFixed(1)}%`);

	return {
		imagePath,
		fieldMatchRate: overallMatchRate,
	};
}
