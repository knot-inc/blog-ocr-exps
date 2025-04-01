import fs from "fs";
import path from "path";

/**
 * Calculate match percentage between two strings
 */
function calculateMatchPercentage(
	extracted: string,
	groundTruth: string,
): number {
	if (!extracted || !groundTruth) return 0;
	if (extracted === groundTruth) return 100;

	// Special handling for dates
	if (
		groundTruth.match(/\d{4}-\d{2}-\d{2}/) &&
		extracted.match(/\d{4}(-\d{2}(-\d{2})?)?/)
	) {
		const gtParts = groundTruth.split("-");
		const extractedParts = extracted.split("-");

		if (extractedParts[0] === gtParts[0]) {
			if (extractedParts.length === 1) return 33; // Only year
			if (extractedParts.length >= 2 && extractedParts[1] === gtParts[1])
				return 67; // Year and month
		}
		return 0;
	}

	// For text fields
	const gtWords = [...new Set(groundTruth.toLowerCase().split(/\s+/))].filter(
		(word) => word.length > 3,
	);
	const extractedWords = extracted.toLowerCase().split(/\s+/);
	const foundWords = gtWords.filter((word) => extractedWords.includes(word));

	return (foundWords.length / gtWords.length) * 100;
}

/**
 * Compare extracted work experiences with ground truth
 */
function compareWorkExperiences(
	extracted: any[],
	groundTruth: any[],
	imagePath: string,
) {
	console.log(`\n========== ${imagePath} ==========`);
	const matchedEntries = new Array(groundTruth.length).fill(false);
	const fieldMatchRates: number[] = [];

	extracted.forEach((job, i) => {
		console.log(`\nWork experience #${i + 1}:`);
		let bestMatchIndex = -1;
		let bestMatchScore = 0;

		groundTruth.forEach((gtJob, j) => {
			let score = 0;
			// Calculate scores
			if (job.title && gtJob.title) {
				score += calculateMatchPercentage(job.title, gtJob.title) > 50 ? 1 : 0;
			}
			if (job.company && gtJob.company) {
				score +=
					calculateMatchPercentage(job.company, gtJob.company) > 50 ? 1 : 0;
			}
			if (job.startDate && gtJob.startDate) {
				score +=
					calculateMatchPercentage(job.startDate, gtJob.startDate) > 50 ? 1 : 0;
			}
			if (job.endDate && gtJob.endDate) {
				score +=
					calculateMatchPercentage(job.endDate, gtJob.endDate) > 50 ? 1 : 0;
			}

			if (score > bestMatchScore) {
				bestMatchScore = score;
				bestMatchIndex = j;
			}
		});

		if (bestMatchScore >= 2) {
			console.log(`Match with ground truth #${bestMatchIndex + 1}`);
			matchedEntries[bestMatchIndex] = true;

			const gtJob = groundTruth[bestMatchIndex];
			const jobFieldMatches: number[] = [];

			// Compare each field with emoji first
			const titleMatch = calculateMatchPercentage(job.title, gtJob.title);
			jobFieldMatches.push(titleMatch);
			const titleEmoji =
				titleMatch === 100 ? "✅" : titleMatch > 50 ? "⚠️" : "❌";
			console.log(
				`  Title: ${titleEmoji} ${titleMatch.toFixed(0)}% match, ${job.title || "N/A"} (Expected: ${gtJob.title})`,
			);

			const companyMatch = calculateMatchPercentage(job.company, gtJob.company);
			jobFieldMatches.push(companyMatch);
			const companyEmoji =
				companyMatch === 100 ? "✅" : companyMatch > 50 ? "⚠️" : "❌";
			console.log(
				`  Company: ${companyEmoji} ${companyMatch.toFixed(0)}% match, ${job.company || "N/A"} (Expected: ${gtJob.company})`,
			);

			// Date handling
			const startDateMatch = calculateMatchPercentage(
				job.startDate,
				gtJob.startDate,
			);
			jobFieldMatches.push(startDateMatch);
			let startDateEmoji = "❌";
			let startDateNote = "";

			if (startDateMatch === 100) {
				startDateEmoji = "✅";
			} else if (startDateMatch === 67) {
				startDateEmoji = "⚠️";
				startDateNote = " (Year-Month)";
			} else if (startDateMatch === 33) {
				startDateEmoji = "⚠️";
				startDateNote = " (Year only)";
			}

			console.log(
				`  Start Date: ${startDateEmoji} ${startDateMatch.toFixed(0)}% match${startDateNote}, ${job.startDate || "N/A"} (Expected: ${gtJob.startDate})`,
			);

			const endDateMatch = calculateMatchPercentage(job.endDate, gtJob.endDate);
			jobFieldMatches.push(endDateMatch);
			let endDateEmoji = "❌";
			let endDateNote = "";

			if (endDateMatch === 100) {
				endDateEmoji = "✅";
			} else if (endDateMatch === 67) {
				endDateEmoji = "⚠️";
				endDateNote = " (Year-Month)";
			} else if (endDateMatch === 33) {
				endDateEmoji = "⚠️";
				endDateNote = " (Year only)";
			}

			console.log(
				`  End Date: ${endDateEmoji} ${endDateMatch.toFixed(0)}% match${endDateNote}, ${job.endDate || "N/A"} (Expected: ${gtJob.endDate})`,
			);

			let descMatch = 0;
			if (job.description && gtJob.description) {
				descMatch = calculateMatchPercentage(
					job.description,
					gtJob.description,
				);
				jobFieldMatches.push(descMatch);
				const descEmoji =
					descMatch === 100 ? "✅" : descMatch > 50 ? "⚠️" : "❌";
				console.log(
					`  Description: ${descEmoji} ${descMatch.toFixed(0)}% match`,
				);
			} else {
				console.log(
					`  Description: ❌ 0% match, ${!job.description ? "Missing in extracted" : "Missing in ground truth"}`,
				);
			}

			// Calculate average match rate for this job entry
			const jobMatchRate =
				jobFieldMatches.reduce((sum, rate) => sum + rate, 0) /
				jobFieldMatches.length;
			console.log(`  Entry match rate: ${jobMatchRate.toFixed(1)}%`);

			// Add to overall field match rates
			fieldMatchRates.push(jobMatchRate);
		} else {
			console.log(`❌ No good match found. Best score: ${bestMatchScore}`);
		}
	});

	// Report unmatched entries
	const unmatchedCount = matchedEntries.filter((matched) => !matched).length;
	if (unmatchedCount > 0) {
		console.log(`\n❌ ${unmatchedCount} ground truth entries not matched:`);
		groundTruth.forEach((gtJob, i) => {
			if (!matchedEntries[i]) {
				console.log(
					`  ${i + 1}. ${gtJob.title} at ${gtJob.company} (${gtJob.startDate} to ${gtJob.endDate})`,
				);
			}
		});
	}

	// Calculate the match rate based on matched entries
	const matchedCount = matchedEntries.filter(Boolean).length;
	const entryMatchPercent = ((matchedCount / groundTruth.length) * 100).toFixed(
		1,
	);

	// Calculate the overall match rate as the mean of all field match percentages
	const overallMatchRate =
		fieldMatchRates.length > 0
			? fieldMatchRates.reduce((sum, rate) => sum + rate, 0) /
				fieldMatchRates.length
			: 0;

	console.log(
		`\nEntry match: ${matchedCount}/${groundTruth.length} (${entryMatchPercent}%)`,
	);
	console.log(
		`Overall match rate (all items percentage mean): ${overallMatchRate.toFixed(1)}%`,
	);

	return {
		imagePath,
		entryMatchRate: parseFloat(entryMatchPercent),
		fieldMatchRate: overallMatchRate,
	};
}

/**
 * Main function to run comparison across multiple images
 */
export async function compareToGroundTruth(
	imageInputFn: (imagePath: string) => Promise<any>,
	groundTruthPath: string,
) {
	try {
		// Define image paths
		const imagePaths = [
			"./assets/images/standard.png",
			"./assets/images/side-by-side.png",
			"./assets/images/split.png",
			"./assets/images/decorated.png",
		];

		// Load ground truth data
		const groundTruth = JSON.parse(
			fs.readFileSync(path.resolve(groundTruthPath), "utf8"),
		);

		// Process each image and compare results
		const results = [];
		for (const imagePath of imagePaths) {
			try {
				// Process the image using the provided function
				const result = await imageInputFn(imagePath);

				// Compare with ground truth
				const comparisonResult = compareWorkExperiences(
					result.workExperiences,
					groundTruth.workExperiences,
					imagePath,
				);

				results.push(comparisonResult);
			} catch (error) {
				console.error(`Error processing ${imagePath}:`, error);
			}
		}

		// Output final summary
		console.log("\n===== FINAL SUMMARY =====");
		results.forEach((r) => {
			console.log(
				`${r.imagePath}: Entry match: ${r.entryMatchRate}%, Field match: ${r.fieldMatchRate}%`,
			);
		});

		const avgEntryMatchRate =
			results.reduce((sum, r) => sum + r.entryMatchRate, 0) / results.length;
		const avgFieldMatchRate =
			results.reduce((sum, r) => sum + r.fieldMatchRate, 0) / results.length;

		console.log(`Average entry match rate: ${avgEntryMatchRate.toFixed(1)}%`);
		console.log(
			`Average field match rate (all items percentage mean): ${avgFieldMatchRate.toFixed(1)}%`,
		);

		return results;
	} catch (error) {
		console.error("Error in comparison:", error);
		throw error;
	}
}
