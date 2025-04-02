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
 * @returns Comparison results
 */
export async function compareToGroundTruth(
	imageInputFn: (
		imagePath: string,
	) => Promise<z.infer<typeof parseWorkExperienceSchema>>,
	dataFolder = "./assets/samples",
): Promise<
	Array<{
		imagePath: string;
		fieldMatchRate: number;
		fieldTypeScores: Record<string, number>;
	}>
> {
	try {
		// Use processDataFolder but with saveOutput=false
		const extractedResults = await processDataFolder(
			imageInputFn,
			dataFolder,
			false,
		);

		console.log(
			`Process images: ${extractedResults.map((r) => r.imagePath).join(", ")}\n`,
		);

		const results: Array<{
			imagePath: string;
			fieldMatchRate: number;
			fieldTypeScores: Record<string, number>;
		}> = [];

		for (const { imagePath, extractedData } of extractedResults) {
			try {
				// Find ground truth JSON in the same folder as the image
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

				// Use the already extracted data instead of calling imageInputFn again
				const comparison = compareExperiences(
					extractedData,
					groundTruth,
					imagePath,
				);
				results.push(comparison);
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

/**
 * Generate a detailed report of differences between extracted data and ground truth
 * @param extracted - Extracted work experience data
 * @param groundTruth - Ground truth work experience data
 * @returns HTML report as a string
 */
export function generateDifferenceReport(
	extracted: z.infer<typeof parseWorkExperienceSchema>,
	groundTruth: z.infer<typeof parseWorkExperienceSchema>,
): string {
	let report = "<html><head><style>";
	report += "body { font-family: Arial, sans-serif; }";
	report += ".match { color: green; }";
	report += ".partial { color: orange; }";
	report += ".mismatch { color: red; }";
	report += "table { border-collapse: collapse; width: 100%; }";
	report +=
		"th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }";
	report += "th { background-color: #f2f2f2; }";
	report += "</style></head><body>";

	report += "<h1>Work Experience Comparison Report</h1>";

	// For each extracted job, find best match and show differences
	for (let i = 0; i < extracted.workExperiences.length; i++) {
		const job = extracted.workExperiences[i];
		report += `<h2>Work Experience #${i + 1}</h2>`;

		// Find best match in ground truth
		const bestMatch = findBestMatch(job, groundTruth.workExperiences);

		if (bestMatch.score >= 2) {
			const gtJob = groundTruth.workExperiences[bestMatch.index];
			report += `<p>Matched with ground truth job #${bestMatch.index + 1}</p>`;

			report += "<table>";
			report +=
				"<tr><th>Field</th><th>Extracted</th><th>Ground Truth</th><th>Match %</th></tr>";

			const fields = [
				{ key: "title", name: "Title" },
				{ key: "company", name: "Company" },
				{ key: "startDate", name: "Start Date" },
				{ key: "endDate", name: "End Date" },
				{ key: "description", name: "Description" },
			];

			for (const field of fields) {
				const extractedValue =
					(job[field.key as keyof typeof job] as string) || "N/A";
				const groundTruthValue =
					(gtJob[field.key as keyof typeof gtJob] as string) || "N/A";

				let match = 0;
				if (extractedValue && groundTruthValue) {
					match = Math.round(findBestMatch(job, [gtJob]).score * 25); // Convert to percentage
				}

				let matchClass = "mismatch";
				if (match === 100) matchClass = "match";
				else if (match > 50) matchClass = "partial";

				report += `<tr class="${matchClass}">`;
				report += `<td>${field.name}</td>`;
				report += `<td>${extractedValue}</td>`;
				report += `<td>${groundTruthValue}</td>`;
				report += `<td>${match}%</td>`;
				report += "</tr>";
			}

			report += "</table>";
		} else {
			report +=
				'<p class="mismatch">No good match found in ground truth data</p>';
		}
	}

	report += "</body></html>";
	return report;
}
