import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { parseWorkExperienceSchema } from "../prompts/parse-work-experience";
import { findBestMatch, compareFields } from "./comparisonUtils";
import { processDataFolder } from "./dataProcessor";

/**
 * Compare work experience descriptions line counts to ground truth
 * @param extracted - Extracted work experience data
 * @param groundTruth - Ground truth data with expected description line counts
 * @param imagePath - Path to the image (for reporting)
 * @returns Comparison results with matching rate
 */
export function compareDescriptionLineCounts(
	extracted: z.infer<typeof parseWorkExperienceSchema>,
	groundTruth: { workExperiences: number[] },
	imagePath: string,
): {
	imagePath: string;
	matchRate: number;
	details: {
		extractedCounts: number[];
		expectedCounts: number[];
	};
} {
	console.log("\n===== EASY CHECK MODE: DESCRIPTION LINE COUNTS =====");

	// Count the number of description lines for each work experience
	const extractedCounts: number[] = [];

	for (const job of extracted.workExperiences) {
		if (!job.description) {
			extractedCounts.push(0);
			continue;
		}

		// Count sentences by splitting on periods, question marks, and exclamation marks
		// followed by a space or end of string
		const sentences = job.description
			.split(/[.!?](?:\s|$)/)
			.filter((s) => s.trim().length > 0);
		extractedCounts.push(sentences.length);
	}

	// Get expected counts from ground truth
	const expectedCounts = groundTruth.workExperiences;

	console.log("Expected description line counts:", expectedCounts);
	console.log("Extracted description line counts:", extractedCounts);

	// Calculate match rate based on relative similarity between counts, not just exact matches
	let totalMatchScore = 0;

	// Use the ground truth count as the total to check
	const totalToCheck = expectedCounts.length;

	if (totalToCheck === 0) {
		console.log("No work experiences to compare");
		return {
			imagePath,
			matchRate: 0,
			details: {
				extractedCounts,
				expectedCounts,
			},
		};
	}

	// Compare each count, iterating through ground truth first
	for (let i = 0; i < totalToCheck; i++) {
		const expected = expectedCounts[i];
		const extracted = i < extractedCounts.length ? extractedCounts[i] : 0;

		// Calculate match percentage based on the ratio of the smaller to larger value
		let matchPercent = 0;
		if (expected === 0 && extracted === 0) {
			matchPercent = 100; // Both zero is a 100% match
		} else if (expected === 0 || extracted === 0) {
			matchPercent = 0; // One zero and one non-zero is a 0% match
		} else {
			// Calculate similarity percentage
			matchPercent =
				(Math.min(expected, extracted) / Math.max(expected, extracted)) * 100;
		}

		// Round to nearest whole number
		matchPercent = Math.round(matchPercent);

		// Get status emoji based on match percentage
		let statusEmoji: string;
		if (matchPercent === 100) {
			statusEmoji = "✅"; // Perfect match
		} else if (matchPercent >= 50) {
			statusEmoji = "⚠️"; // Partial match
		} else {
			statusEmoji = "❌"; // Poor match
		}

		const extractedStatus = i < extractedCounts.length ? extracted : "Missing";

		console.log(
			`Work experience #${i + 1}: ${statusEmoji} Expected: ${expected}, Got: ${extractedStatus}, Match: ${matchPercent}%`,
		);

		totalMatchScore += matchPercent;
	}

	// Report any extra work experiences in extracted data
	if (extractedCounts.length > expectedCounts.length) {
		console.log(
			`❌ Extra ${extractedCounts.length - expectedCounts.length} work experiences in extracted data`,
		);
		for (let i = expectedCounts.length; i < extractedCounts.length; i++) {
			console.log(
				`  Extra work experience #${i + 1}: ${extractedCounts[i]} lines`,
			);
		}
	}

	// Calculate the overall match rate as the average of all match percentages
	const matchRate = totalMatchScore / totalToCheck;
	console.log(`\nDescription line count match rate: ${matchRate.toFixed(1)}%`);
	console.log("================================================");

	return {
		imagePath,
		matchRate,
		details: {
			extractedCounts,
			expectedCounts,
		},
	};
}

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
 * @param easyCheckMode - Force easy check mode if true, auto-detect based on JSON format if undefined
 * @returns Comparison results including both extracted and ground truth data
 */
export async function compareToGroundTruth(
	imageInputFn: (
		imagePath: string,
	) => Promise<z.infer<typeof parseWorkExperienceSchema>>,
	dataFolder = "./assets/inputs/samples",
	easyCheckMode?: boolean,
): Promise<
	Array<{
		imagePath: string;
		fieldMatchRate: number;
		fieldTypeScores: Record<string, number>;
		extractedData: z.infer<typeof parseWorkExperienceSchema>;
		groundTruth:
			| z.infer<typeof parseWorkExperienceSchema>
			| { workExperiences: number[] };
		easyCheckResult?: {
			matchRate: number;
			details: {
				extractedCounts: number[];
				expectedCounts: number[];
			};
		};
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
			groundTruth:
				| z.infer<typeof parseWorkExperienceSchema>
				| { workExperiences: number[] };
			easyCheckResult?: {
				matchRate: number;
				details: {
					extractedCounts: number[];
					expectedCounts: number[];
				};
			};
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

				const groundTruth = JSON.parse(fs.readFileSync(gtPath, "utf8"));

				// Auto-detect easy check mode format if easyCheckMode is undefined
				// If easyCheckMode is explicitly true or false, respect that setting
				const shouldUseEasyCheckMode =
					easyCheckMode !== undefined
						? easyCheckMode
						: Array.isArray(groundTruth.workExperiences) &&
							groundTruth.workExperiences.every(
								(n: unknown) => typeof n === "number",
							);

				if (shouldUseEasyCheckMode) {
					// Check if data format is compatible with easy check mode
					if (
						Array.isArray(groundTruth.workExperiences) &&
						groundTruth.workExperiences.every(
							(n: unknown) => typeof n === "number",
						)
					) {
						console.log(
							`Using easy check mode for ${imagePath} based on ground truth format`,
						);
						const easyCheckResult = compareDescriptionLineCounts(
							extractedData,
							groundTruth as { workExperiences: number[] },
							imagePath,
						);

						results.push({
							imagePath,
							fieldMatchRate: easyCheckResult.matchRate, // Use the match rate from easy check
							fieldTypeScores: { Description: easyCheckResult.matchRate }, // Only description score is relevant
							extractedData,
							groundTruth,
							easyCheckResult,
						});
					} else {
						console.warn(
							`Ground truth file ${gtPath} does not have the expected format for easy check mode. Expected { workExperiences: [n1, n2, ...] }`,
						);

						if (easyCheckMode === true) {
							// Skip this file if easy check mode was explicitly requested but format is incompatible
							continue;
						}

						// Fall back to regular comparison if auto-detecting
						const { fieldMatchRate, fieldTypeScores } = compareExperiences(
							extractedData,
							groundTruth as z.infer<typeof parseWorkExperienceSchema>,
							imagePath,
						);

						results.push({
							imagePath,
							fieldMatchRate,
							fieldTypeScores,
							extractedData,
							groundTruth,
						});
					}
				} else {
					// Regular comparison mode
					const { fieldMatchRate, fieldTypeScores } = compareExperiences(
						extractedData,
						groundTruth as z.infer<typeof parseWorkExperienceSchema>,
						imagePath,
					);

					results.push({
						imagePath,
						fieldMatchRate,
						fieldTypeScores,
						extractedData,
						groundTruth,
					});
				}
			} catch (error) {
				console.error(`Error processing ${imagePath}:`, error);
			}
		}

		// Print summary
		console.log("\n========== SUMMARY ==========");

		// Group results by comparison mode
		const easyCheckResults = results.filter((r) => r.easyCheckResult);
		const regularResults = results.filter((r) => !r.easyCheckResult);

		// Print easy check mode results first if any
		if (easyCheckResults.length > 0) {
			console.log("\n=== EASY CHECK MODE RESULTS ===");
			for (const r of easyCheckResults) {
				console.log(
					`${r.imagePath}: Description line count match rate: ${r.easyCheckResult?.matchRate.toFixed(1)}%`,
				);
			}

			const avgMatchRate =
				easyCheckResults.reduce(
					(sum, r) => sum + (r.easyCheckResult?.matchRate || 0),
					0,
				) / easyCheckResults.length;
			console.log("\n==========================");
			console.log(
				`Average description line count match rate: ${avgMatchRate.toFixed(1)}%`,
			);
			console.log("==========================");
		}

		// Print regular comparison results if any
		if (regularResults.length > 0) {
			if (easyCheckResults.length > 0) {
				console.log("\n=== REGULAR COMPARISON RESULTS ===");
			}

			for (const r of regularResults) {
				console.log(`${r.imagePath}: Fields: ${r.fieldMatchRate.toFixed(1)}%`);
			}

			const avgFieldMatch =
				regularResults.reduce((sum, r) => sum + r.fieldMatchRate, 0) /
				regularResults.length;

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
				const scores = regularResults
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
		}

		return results;
	} catch (error) {
		console.error("Comparison error:", error);
		throw error;
	}
}
