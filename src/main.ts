import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import type { z } from "zod";
import type { parseWorkExperienceSchema } from "./prompts/parse-work-experience";
import { processDataFolder } from "./utils/dataProcessor";
import {
	compareToGroundTruth,
	generateDifferenceReport,
} from "./utils/comparisonTools";
import * as processors from "./processors";

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
		.command("save-gt")
		.description("Save ground truth data from manually labeled examples")
		.requiredOption(
			"-d, --data-folder <path>",
			"Folder containing images and ground truth data (will save JSON in same folder)",
		)
		.option(
			"-p, --processor <name>",
			"Processor to use for extraction (default: processImage)",
			"processImage",
		)
		.action(async (options) => {
			try {
				const { dataFolder, processor } = options;
				console.log(
					`Processing and saving ground truth data in ${dataFolder} using ${processor}...`,
				);

				// Use the specified processor or default to processImage
				const selectedProcessor =
					processors[processor as keyof typeof processors] ||
					processors.processImage;
				console.log(
					`Using processor: ${selectedProcessor.name || "processImage"}`,
				);

				// Process and save ground truth data in the same folder
				await processDataFolder(selectedProcessor, dataFolder, true);

				console.log(`Ground truth data saved successfully in ${dataFolder}`);
			} catch (error) {
				console.error("Error saving ground truth data:", error);
				process.exit(1);
			}
		});

	// Command to save reports with multiple processors
	program
		.command("save-reports")
		.description("Process images with various OCR processors and save results")
		.requiredOption("-i, --input <path>", "Input folder containing images")
		.requiredOption(
			"-o, --output <path>",
			"Output folder to save processed results",
		)
		.option(
			"-p, --processors <list>",
			"Comma-separated list of processors to use",
			"all",
		)
		.action(async (options) => {
			try {
				const { input, output, processors: processorsList } = options;
				console.log(
					`Processing images from ${input} using specified processors...`,
				);

				// Create output directory if it doesn't exist
				if (!fs.existsSync(output)) {
					fs.mkdirSync(output, { recursive: true });
				}

				// Determine which processors to use
				let selectedProcessors: Array<keyof typeof processors> = [];
				if (processorsList === "all") {
					selectedProcessors = Object.keys(processors) as Array<
						keyof typeof processors
					>;
				} else {
					selectedProcessors = processorsList.split(",") as Array<
						keyof typeof processors
					>;
				}

				// Process data with each selected processor
				for (const processorName of selectedProcessors) {
					if (!(processorName in processors)) {
						console.warn(`Processor "${processorName}" not found, skipping`);
						continue;
					}

					console.log(`Running processor: ${processorName}`);
					const processor = processors[processorName];
					const results = await processDataFolder(input, false, processor);

					fs.writeFileSync(
						path.join(output, `${processorName}-results.json`),
						JSON.stringify(results, null, 2),
					);
				}

				console.log(`All processing complete. Results saved to ${output}`);
			} catch (error) {
				console.error("Error processing data:", error);
				process.exit(1);
			}
		});

	// Command to compare results with ground truth
	program
		.command("compare")
		.description("Compare processor results with ground truth data")
		.requiredOption(
			"-g, --ground-truth <path>",
			"Path to ground truth JSON file",
		)
		.requiredOption(
			"-r, --results <path>",
			"Path to results JSON file or directory",
		)
		.requiredOption(
			"-o, --output <path>",
			"Output folder to save comparison reports",
		)
		.action(async (options) => {
			try {
				const { groundTruth, results, output } = options;
				console.log(
					`Comparing results from ${results} with ground truth ${groundTruth}...`,
				);

				// Create output directory if it doesn't exist
				if (!fs.existsSync(output)) {
					fs.mkdirSync(output, { recursive: true });
				}

				// Load ground truth data
				const gtData = JSON.parse(
					fs.readFileSync(groundTruth, "utf-8"),
				) as z.infer<typeof parseWorkExperienceSchema>[];

				// Handle single file or directory of result files
				if (fs.statSync(results).isDirectory()) {
					const resultFiles = fs
						.readdirSync(results)
						.filter((file) => file.endsWith(".json"));

					for (const file of resultFiles) {
						const resultPath = path.join(results, file);
						const processorName = file.replace("-results.json", "");

						const resultData = JSON.parse(
							fs.readFileSync(resultPath, "utf-8"),
						) as z.infer<typeof parseWorkExperienceSchema>[];
						const comparison = compareToGroundTruth(gtData, resultData);
						const report = generateDifferenceReport(comparison);

						fs.writeFileSync(
							path.join(output, `${processorName}-comparison.json`),
							JSON.stringify(comparison, null, 2),
						);

						fs.writeFileSync(
							path.join(output, `${processorName}-report.md`),
							report,
						);

						console.log(`Comparison for ${processorName} saved successfully`);
					}
				} else {
					const processorName = path
						.basename(results, ".json")
						.replace("-results", "");
					const resultData = JSON.parse(
						fs.readFileSync(results, "utf-8"),
					) as z.infer<typeof parseWorkExperienceSchema>[];

					const comparison = compareToGroundTruth(gtData, resultData);
					const report = generateDifferenceReport(comparison);

					fs.writeFileSync(
						path.join(output, `${processorName}-comparison.json`),
						JSON.stringify(comparison, null, 2),
					);

					fs.writeFileSync(
						path.join(output, `${processorName}-report.md`),
						report,
					);

					console.log(`Comparison for ${processorName} saved successfully`);
				}

				console.log(`All comparisons complete. Reports saved to ${output}`);
			} catch (error) {
				console.error("Error comparing results:", error);
				process.exit(1);
			}
		});

	// Parse command line arguments
	await program.parseAsync(process.argv);
}

// Execute the main function
main().catch((error) => {
	console.error("Unhandled error:", error);
});
