import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { parseWorkExperienceSchema } from "../prompts/parse-work-experience";

/**
 * Process images in a data folder and extract work experience information
 * @param imageInputFn - Function to process an image and extract work experience data
 * @param dataFolder - Path to the folder containing images to process
 * @param saveOutput - If true, save extracted results as JSON files in the same folder
 * @returns Array of processed image paths and their extracted data
 */
export async function processDataFolder(
	imageInputFn: (
		imagePath: string,
	) => Promise<z.infer<typeof parseWorkExperienceSchema>>,
	dataFolder = "./assets/samples",
	saveOutput = false,
): Promise<
	Array<{
		imagePath: string;
		extractedData: z.infer<typeof parseWorkExperienceSchema>;
	}>
> {
	try {
		// Find all PNG images in the data folder
		const imageDir = path.resolve(dataFolder);
		const allFiles = fs.readdirSync(imageDir);
		const imagePaths = allFiles
			.filter((file) => file.toLowerCase().endsWith(".png"))
			.map((file) => path.join(imageDir, file));

		if (imagePaths.length === 0) {
			console.warn(`No PNG images found in ${imageDir}`);
			return [];
		}

		console.log(`Processing ${imagePaths.length} images from: ${imageDir}\n`);

		const results = [];

		for (const imagePath of imagePaths) {
			try {
				console.log(`Processing image: ${imagePath}`);

				// Process the image
				const extractedData = await imageInputFn(imagePath);

				// Save results if saveOutput is true
				if (saveOutput) {
					const imageBasename = path.basename(
						imagePath,
						path.extname(imagePath),
					);
					const outputFolder = path.dirname(imagePath);
					const outputPath = path.join(outputFolder, `${imageBasename}.json`);

					// Write extracted data to JSON file in the same folder
					fs.writeFileSync(
						outputPath,
						JSON.stringify(extractedData, null, 2),
						"utf8",
					);
					console.log(`Saved extracted data to: ${outputPath}`);
				}

				results.push({
					imagePath,
					extractedData,
				});
			} catch (error) {
				console.error(`Error processing ${imagePath}:`, error);
			}
		}

		console.log(
			`\nSuccessfully processed ${results.length} of ${imagePaths.length} images`,
		);
		return results;
	} catch (error) {
		console.error("Data folder processing error:", error);
		throw error;
	}
}

/**
 * Check if ground truth data exists for a given image
 * @param imagePath - Path to the image
 * @param groundTruthFolder - Folder containing ground truth JSON files
 * @returns Boolean indicating if ground truth exists
 */
export function hasGroundTruth(
	imagePath: string,
	groundTruthFolder: string,
): boolean {
	const imageBasename = path.basename(imagePath, path.extname(imagePath));
	const gtPath = path.join(groundTruthFolder, `${imageBasename}.json`);
	return fs.existsSync(gtPath);
}

/**
 * Load ground truth data for an image
 * @param imagePath - Path to the image
 * @param groundTruthFolder - Folder containing ground truth JSON files
 * @returns The ground truth data or null if not found
 */
export function loadGroundTruth(
	imagePath: string,
	groundTruthFolder: string,
): z.infer<typeof parseWorkExperienceSchema> | null {
	const imageBasename = path.basename(imagePath, path.extname(imagePath));
	const gtPath = path.join(groundTruthFolder, `${imageBasename}.json`);

	if (!fs.existsSync(gtPath)) {
		return null;
	}

	try {
		return JSON.parse(fs.readFileSync(gtPath, "utf8"));
	} catch (error) {
		console.error(`Error loading ground truth from ${gtPath}:`, error);
		return null;
	}
}
