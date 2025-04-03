import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { parseWorkExperienceSchema } from "../prompts/parse-work-experience";
import { findBestMatch, compareFields } from "./comparisonUtils";
import { processDataFolder } from "./dataProcessor";

/**
 * Compare extracted work experience data to ground truth
 * @param extracted - Extracted work experience data
 * @param groundTruth - Ground truth work experience data
 * @param imagePath - Path to the image (for reporting)
 * @returns Comparison results
 */
export function compareExperiences(
	extracted: z.infer<typeof parseWorkExperienceSchema>,
	groundTruth: z.infer<typeof parseWorkExperienceSchema>,
	imagePath: string,
): {
	imagePath: string;
	fieldMatchRate: number;
	fieldTypeScores: Record<string, number>;
} {
	const fieldMatchRates: number[] = [];
	// Track all field scores by type
	const fieldTypeAccumulator: Record<string, number[]> = {
		Title: [],
		Company: [],
		"Start Date": [],
		"End Date": [],
		Description: [],
	};

	for (let i = 0; i < extracted.workExperiences.length; i++) {
		const job = extracted.workExperiences[i];
		console.log(`\nWork experience #${i + 1}:`);

		// Find best match
		const bestMatch = findBestMatch(job, groundTruth.workExperiences);

		if (bestMatch.score >= 2) {
			console.log(`Match with ground truth #${bestMatch.index + 1}`);

			// Compare fields
			const gtJob = groundTruth.workExperiences[bestMatch.index];
			const { fieldMatches, fieldTypeScores } = compareFields(job, gtJob);

			// Add individual field scores to accumulator
			for (const [fieldName, score] of Object.entries(fieldTypeScores)) {
				fieldTypeAccumulator[fieldName].push(score);
			}

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

	// Calculate average for each field type
	const fieldTypeScores: Record<string, number> = {};
	console.log("\nField Type Averages:");
	for (const [fieldName, scores] of Object.entries(fieldTypeAccumulator)) {
		if (scores.length > 0) {
			fieldTypeScores[fieldName] =
				scores.reduce((sum, score) => sum + score, 0) / scores.length;
			console.log(
				`Average ${fieldName} match rate: ${fieldTypeScores[fieldName].toFixed(1)}%`,
			);
		} else {
			fieldTypeScores[fieldName] = 0;
			console.log(`${fieldName.padEnd(12)}: N/A`);
		}
	}

	console.log(`\nOverall field match rate: ${overallMatchRate.toFixed(1)}%`);

	return {
		imagePath,
		fieldMatchRate: overallMatchRate,
		fieldTypeScores,
	};
}

/**
 * Compare extracted work experiences to ground truth files in the same folder
 * @param imageInputFn - Function to process an image and extract work experience data
 * @param dataFolder - Folder containing images and ground truth JSON files
 * @returns Comparison results including both extracted and ground truth data
 */
export async function compareToGroundTruth(
	imageInputFn: (
		imagePath: string,
	) => Promise<z.infer<typeof parseWorkExperienceSchema>>,
	dataFolder = "./assets/inputs/samples",
): Promise<
	Array<{
		imagePath: string;
		fieldMatchRate: number;
		fieldTypeScores: Record<string, number>;
		extractedData: z.infer<typeof parseWorkExperienceSchema>;
		groundTruth: z.infer<typeof parseWorkExperienceSchema>;
	}>
> {
	try {
		const extractedResults = await processDataFolder(
			imageInputFn,
			dataFolder,
			false,
		);

		console.log(
			`Processed images: ${extractedResults.map((r) => r.imagePath).join(", ")}\n`,
		);

		const results: Array<{
			imagePath: string;
			fieldMatchRate: number;
			fieldTypeScores: Record<string, number>;
			extractedData: z.infer<typeof parseWorkExperienceSchema>;
			groundTruth: z.infer<typeof parseWorkExperienceSchema>;
		}> = [];

		for (const { imagePath, extractedData } of extractedResults) {
			try {
				const imageBasename = path.basename(imagePath, path.extname(imagePath));
				const imageDir = path.dirname(imagePath);
				const gtPath = path.join(imageDir, `${imageBasename}.json`);

				if (!fs.existsSync(gtPath)) {
					console.warn(
						`Ground truth file not found: ${gtPath}, skipping image`,
					);
					continue;
				}

				const groundTruth: z.infer<typeof parseWorkExperienceSchema> =
					JSON.parse(fs.readFileSync(gtPath, "utf8"));

				// Compare the extracted data with ground truth
				const { fieldMatchRate, fieldTypeScores } = compareExperiences(
					extractedData,
					groundTruth,
					imagePath,
				);

				// Add both extractedData and groundTruth to the comparison result
				results.push({
					imagePath,
					fieldMatchRate,
					fieldTypeScores,
					extractedData,
					groundTruth,
				});
			} catch (error) {
				console.error(`Error processing ${imagePath}:`, error);
			}
		}

		// Print summary
		console.log("\n========== SUMMARY ==========");
		for (const r of results) {
			console.log(`${r.imagePath}: Fields: ${r.fieldMatchRate.toFixed(1)}%`);
		}

		const avgFieldMatch =
			results.reduce((sum, r) => sum + r.fieldMatchRate, 0) / results.length;

		// Calculate and display average of each field type across all images
		console.log("\nField Type Averages:");
		const fieldTypes = [
			"Title",
			"Company",
			"Start Date",
			"End Date",
			"Description",
		];
		const fieldTypeAverages: Record<string, number> = {};

		for (const fieldType of fieldTypes) {
			const scores = results
				.map((r) => r.fieldTypeScores[fieldType])
				.filter((score) => score > 0);

			if (scores.length > 0) {
				const avgScore =
					scores.reduce((sum, score) => sum + score, 0) / scores.length;
				fieldTypeAverages[fieldType] = avgScore;
				console.log(`${fieldType.padEnd(12)}: ${avgScore.toFixed(1)}%`);
			} else {
				fieldTypeAverages[fieldType] = 0;
				console.log(`${fieldType.padEnd(12)}: N/A`);
			}
		}

		console.log("=========================");
		console.log(`Average field match: ${avgFieldMatch.toFixed(1)}%`);
		console.log("==========================");

		return results;
	} catch (error) {
		console.error("Comparison error:", error);
		throw error;
	}
}
