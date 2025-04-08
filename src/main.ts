import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { processDataFolder } from "./utils/dataProcessor";
import { compareToGroundTruth } from "./utils/comparisonTools";
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
		.requiredOption(
			"-d, --data-folder <path>",
			"Folder containing images and ground truth data (will save JSON in same folder)",
		)
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
				const { dataFolder, output, processors: processorsList } = options;
				console.log(
					`Processing images from ${dataFolder} using specified processors...`,
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
					console.log(
						"==================== Processing with:",
						processorName,
						"====================",
					);

					const processor = processors[processorName];
					const results = await compareToGroundTruth(processor, dataFolder);

					// Save JSON results
					fs.writeFileSync(
						path.join(output, `${processorName}.json`),
						JSON.stringify(results, null, 2),
					);
				}

				console.log(`All processing complete. Results saved to ${output}`);
			} catch (error) {
				console.error("Error processing data:", error);
				process.exit(1);
			}
		});

	// Command to generate a config
	program
		.command("save-config")
		.description("Save config JSON for visualization")
		.action(async () => {
			// Find all assets/reports/*/*.json files
			const reportsDir = path.join("assets", "reports");
			const folders = fs
				.readdirSync(reportsDir)
				.filter((item) =>
					fs.statSync(path.join(reportsDir, item)).isDirectory(),
				);

			// Create config object
			const config: Record<string, string[]> = {};

			// Populate config with folder names and JSON files
			for (const folder of folders) {
				const folderPath = path.join(reportsDir, folder);
				const jsonFiles = fs
					.readdirSync(folderPath)
					.filter((file) => file.endsWith(".json"))
					.map((file) => file);

				config[folder] = jsonFiles;
			}

			// Save config JSON
			fs.writeFileSync(
				path.join("assets", "config.json"),
				JSON.stringify(config, null, 2),
			);

			console.log("Config file generated successfully at assets/config.json");
		});

	// Parse command line arguments
	program.parse(process.argv);
}

// Run the main function
main().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
