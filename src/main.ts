import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import type { z } from "zod";
import type { parseWorkExperienceSchema } from "./prompts/parse-work-experience";
import { processDataFolder } from "./utils/dataProcessor";
import {
	compareToGroundTruth,
	generateDifferenceReport,
} from "./utils/comparisonTool";

// Define processor type
type ImageProcessor = (
	imagePath: string,
) => Promise<z.infer<typeof parseWorkExperienceSchema>>;

/**
 * Main function to handle command line interface
 */
async function main() {
	const program = new Command();

	program
		.name("work-experience-extractor")
		.description(
			"Extract work experience data from images and evaluate accuracy",
		)
		.version("1.0.0");

	// Command to save ground truth JSON
	program
		.command("save-ground-truth")
		.description("Process images and save extracted data as ground truth JSON")
		.requiredOption(
			"-d, --data-folder <path>",
			"Path to folder containing images",
		)
		.option("-o, --overwrite", "Overwrite existing JSON files", false)
		.action(async (options) => {
			const { dataFolder, overwrite } = options;

			// Check if folder exists
			if (!fs.existsSync(dataFolder)) {
				console.error(`Error: Folder does not exist: ${dataFolder}`);
				process.exit(1);
			}

			console.log(`Processing images in ${dataFolder}...`);

			try {
				// Process images with default processor
				const results = await processDataFolder(
					defaultImageProcessor,
					dataFolder,
					overwrite,
				);

				console.log(`\nProcessed ${results.length} images successfully.`);
				console.log(
					"JSON files have been saved in the same folder as the images.",
				);
				console.log(
					"\nPlease review and manually edit the JSON files as needed to create accurate ground truth.",
				);
			} catch (error) {
				console.error("Error processing images:", error);
				process.exit(1);
			}
		});

	// Command to save reports with multiple processors
	program
		.command("save-reports")
		.description("Compare results from multiple processors and save reports")
		.requiredOption(
			"-d, --data-folder <path>",
			"Path to folder containing images and ground truth JSON",
		)
		.requiredOption(
			"-o, --output-folder <path>",
			"Path to save comparison reports",
		)
		.action(async (options) => {
			const { dataFolder, outputFolder } = options;

			// Check if folders exist
			if (!fs.existsSync(dataFolder)) {
				console.error(`Error: Data folder does not exist: ${dataFolder}`);
				process.exit(1);
			}

			// Create output folder if it doesn't exist
			if (!fs.existsSync(outputFolder)) {
				fs.mkdirSync(outputFolder, { recursive: true });
			}

			console.log(
				`Processing images in ${dataFolder} using multiple processors...`,
			);

			try {
				// Define array of different processors to test
				const processors: Array<{ name: string; processor: ImageProcessor }> = [
					{ name: "default", processor: defaultImageProcessor },
					{ name: "alternative", processor: alternativeImageProcessor },
					// Add more processors as needed
				];

				// Track overall results for each processor
				const processorResults: Record<
					string,
					{
						totalImages: number;
						avgFieldMatchRate: number;
						fieldTypeScores: Record<string, number[]>;
					}
				> = {};

				// Initialize processor results
				for (const { name } of processors) {
					processorResults[name] = {
						totalImages: 0,
						avgFieldMatchRate: 0,
						fieldTypeScores: {
							Title: [],
							Company: [],
							"Start Date": [],
							"End Date": [],
							Description: [],
						},
					};
				}

				// Process with each processor
				for (const { name, processor } of processors) {
					console.log(`\nRunning processor: ${name}`);

					// Compare with ground truth
					const results = await compareToGroundTruth(processor, dataFolder);

					if (results.length === 0) {
						console.log(`No results for processor: ${name}`);
						continue;
					}

					// Record results
					processorResults[name].totalImages = results.length;
					processorResults[name].avgFieldMatchRate =
						results.reduce((sum, r) => sum + r.fieldMatchRate, 0) /
						results.length;

					// Record field type scores
					for (const result of results) {
						for (const [fieldName, score] of Object.entries(
							result.fieldTypeScores,
						)) {
							if (score > 0) {
								processorResults[name].fieldTypeScores[fieldName].push(score);
							}
						}
					}

					// Generate individual reports
					const extractedResults = await processDataFolder(
						processor,
						dataFolder,
						false,
					);

					for (const result of extractedResults) {
						const imageBasename = path.basename(
							result.imagePath,
							path.extname(result.imagePath),
						);
						const imageDir = path.dirname(result.imagePath);
						const gtPath = path.join(imageDir, `${imageBasename}.json`);

						if (fs.existsSync(gtPath)) {
							const groundTruth = JSON.parse(fs.readFileSync(gtPath, "utf8"));
							const report = generateDifferenceReport(
								result.extractedData,
								groundTruth,
							);

							const reportPath = path.join(
								outputFolder,
								`${imageBasename}_${name}_report.html`,
							);
							fs.writeFileSync(reportPath, report, "utf8");
							console.log(`Report saved to: ${reportPath}`);
						}
					}
				}

				// Generate summary report
				const summaryPath = path.join(outputFolder, "summary_report.html");
				const summaryReport = generateSummaryReport(processorResults);
				fs.writeFileSync(summaryPath, summaryReport, "utf8");
				console.log(`\nSummary report saved to: ${summaryPath}`);
			} catch (error) {
				console.error("Error generating reports:", error);
				process.exit(1);
			}
		});

	// Parse command line arguments
	program.parse(process.argv);

	// Show help if no command is provided
	if (!process.argv.slice(2).length) {
		program.outputHelp();
	}
}

/**
 * Default image processor implementation
 */
async function defaultImageProcessor(
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> {
	// This is a placeholder. Replace with your actual implementation.
	console.log(`Processing image with default processor: ${imagePath}`);

	// Return dummy data for demonstration
	return {
		workExperiences: [
			{
				title: "Software Engineer",
				company: "Example Corp",
				startDate: "2020-01",
				endDate: "2022-06",
				description: "Developed web applications using React and Node.js",
			},
		],
	};
}

/**
 * Alternative image processor implementation
 */
async function alternativeImageProcessor(
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> {
	// This is a placeholder for an alternative processor
	console.log(`Processing image with alternative processor: ${imagePath}`);

	// Return dummy data for demonstration
	return {
		workExperiences: [
			{
				title: "Software Developer",
				company: "Example Corporation",
				startDate: "2020-01",
				endDate: "2022-06",
				description: "Built web applications with modern JavaScript frameworks",
			},
		],
	};
}

/**
 * Generate a summary report comparing multiple processors
 */
function generateSummaryReport(
	processorResults: Record<
		string,
		{
			totalImages: number;
			avgFieldMatchRate: number;
			fieldTypeScores: Record<string, number[]>;
		}
	>,
): string {
	let report = "<html><head><style>";
	report += "body { font-family: Arial, sans-serif; margin: 20px; }";
	report += "h1, h2 { color: #333; }";
	report +=
		"table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }";
	report +=
		"th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }";
	report += "th { background-color: #f2f2f2; }";
	report += ".processor-name { font-weight: bold; text-align: left; }";
	report += ".best-score { background-color: #d4edda; font-weight: bold; }";
	report += "</style></head><body>";

	report += "<h1>Work Experience Extraction Summary Report</h1>";

	// Overall match rate comparison
	report += "<h2>Overall Field Match Rate</h2>";
	report += "<table>";
	report +=
		"<tr><th>Processor</th><th>Images Processed</th><th>Average Field Match Rate</th></tr>";

	// Find the best processor
	const processorNames = Object.keys(processorResults);
	const bestProcessor = processorNames.reduce((best, current) => {
		if (
			!best ||
			processorResults[current].avgFieldMatchRate >
				processorResults[best].avgFieldMatchRate
		) {
			return current;
		}
		return best;
	}, "");

	for (const processorName of processorNames) {
		const result = processorResults[processorName];
		const isBest = processorName === bestProcessor ? ' class="best-score"' : "";

		report += `<tr>`;
		report += `<td class="processor-name">${processorName}</td>`;
		report += `<td>${result.totalImages}</td>`;
		report += `<td${isBest}>${result.avgFieldMatchRate.toFixed(1)}%</td>`;
		report += `</tr>`;
	}

	report += "</table>";

	// Field type comparison
	report += "<h2>Field Type Match Rates</h2>";
	report += "<table>";
	report += "<tr><th>Field Type</th>";

	for (const processorName of processorNames) {
		report += `<th>${processorName}</th>`;
	}

	report += "</tr>";

	const fieldTypes = [
		"Title",
		"Company",
		"Start Date",
		"End Date",
		"Description",
	];

	for (const fieldType of fieldTypes) {
		report += `<tr><td class="processor-name">${fieldType}</td>`;

		// Find best processor for this field type
		let bestScoreForField = 0;
		let bestProcessorForField = "";

		for (const processorName of processorNames) {
			const scores = processorResults[processorName].fieldTypeScores[fieldType];
			const avgScore =
				scores.length > 0
					? scores.reduce((sum, score) => sum + score, 0) / scores.length
					: 0;

			if (avgScore > bestScoreForField) {
				bestScoreForField = avgScore;
				bestProcessorForField = processorName;
			}
		}

		// Add scores for each processor
		for (const processorName of processorNames) {
			const scores = processorResults[processorName].fieldTypeScores[fieldType];
			const avgScore =
				scores.length > 0
					? scores.reduce((sum, score) => sum + score, 0) / scores.length
					: 0;

			const isBest =
				processorName === bestProcessorForField ? ' class="best-score"' : "";
			report += `<td${isBest}>${avgScore.toFixed(1)}%</td>`;
		}

		report += "</tr>";
	}

	report += "</table>";

	// Recommendations
	report += "<h2>Recommendations</h2>";

	if (bestProcessor) {
		report += `<p>The <strong>${bestProcessor}</strong> processor achieved the best overall field match rate `;
		report += `at ${processorResults[bestProcessor].avgFieldMatchRate.toFixed(1)}%.</p>`;

		// Field-specific recommendations
		report += "<p>Field-specific recommendations:</p>";
		report += "<ul>";

		for (const fieldType of fieldTypes) {
			let bestFieldProcessor = "";
			let bestFieldScore = 0;

			for (const processorName of processorNames) {
				const scores =
					processorResults[processorName].fieldTypeScores[fieldType];
				const avgScore =
					scores.length > 0
						? scores.reduce((sum, score) => sum + score, 0) / scores.length
						: 0;

				if (avgScore > bestFieldScore) {
					bestFieldScore = avgScore;
					bestFieldProcessor = processorName;
				}
			}

			if (bestFieldProcessor) {
				report += `<li>For <strong>${fieldType}</strong> fields, the <strong>${bestFieldProcessor}</strong> `;
				report += `processor performed best with ${bestFieldScore.toFixed(1)}% accuracy.</li>`;
			}
		}

		report += "</ul>";
	} else {
		report += "<p>No recommendations available due to insufficient data.</p>";
	}

	report += "</body></html>";
	return report;
}

// Run the main function
main().catch((error) => {
	console.error("Error in main process:", error);
	process.exit(1);
});
