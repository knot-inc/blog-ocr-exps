import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";
import { exec } from "node:child_process";
import sharp from "sharp"; // Changed from "import * as sharp"
import { Command } from "commander";

const execPromise = util.promisify(exec);

// Detect and trim the empty margins from an image
async function trimImageMargins(
	imagePath: string,
	outputPath: string,
	threshold = 250, // Threshold for determining what is "white" (0-255)
): Promise<{ width: number; height: number }> {
	try {
		// Read the image
		const image = sharp(imagePath);
		const metadata = await image.metadata();
		const { width, height } = metadata;

		if (!width || !height) {
			throw new Error(`Invalid image dimensions: ${width}x${height}`);
		}

		// Extract raw pixel data
		const { data } = await image.raw().toBuffer({ resolveWithObject: true });

		// Define the bounds
		let top = height;
		let bottom = 0;
		let left = width;
		let right = 0;

		// Scan for content boundaries
		const channels = metadata.channels || 3;

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * channels;

				// Check if the pixel is not white
				// For RGB/RGBA, we check if any channel is significantly non-white
				let isContentPixel = false;

				for (let c = 0; c < Math.min(channels, 3); c++) {
					// Check only R,G,B channels
					if (data[idx + c] < threshold) {
						isContentPixel = true;
						break;
					}
				}

				if (isContentPixel) {
					top = Math.min(top, y);
					bottom = Math.max(bottom, y);
					left = Math.min(left, x);
					right = Math.max(right, x);
				}
			}
		}

		// Add a small padding (10px) around the content
		const padding = 10;
		top = Math.max(0, top - padding);
		bottom = Math.min(height - 1, bottom + padding);
		left = Math.max(0, left - padding);
		right = Math.min(width - 1, right + padding);

		// Check if we actually found content
		if (top >= bottom || left >= right) {
			console.log(`No content found in ${imagePath}, using full image`);
			// Copy the original image
			await sharp(imagePath).toFile(outputPath);
			return { width, height };
		}

		// Calculate the new dimensions
		const newWidth = right - left + 1;
		const newHeight = bottom - top + 1;

		console.log(
			`Trimming image from ${width}x${height} to ${newWidth}x${newHeight}`,
		);

		// Extract and save the content area
		await sharp(imagePath)
			.extract({ left, top, width: newWidth, height: newHeight })
			.toFile(outputPath);

		return { width: newWidth, height: newHeight };
	} catch (error) {
		console.error(`Error trimming margins from ${imagePath}:`, error);
		// If trimming fails, copy the original image
		await sharp(imagePath).toFile(outputPath);
		const metadata = await sharp(imagePath).metadata();
		return { width: metadata.width || 0, height: metadata.height || 0 };
	}
}

// Convert a single PDF file to a vertically combined PNG
async function convertPdfToPng(
	inputPath: string,
	outputPath: string,
	dpi = 300,
): Promise<void> {
	try {
		// Create a temporary directory for individual page images
		const tempDir = path.join(path.dirname(outputPath), "temp_pdf_pages");
		const trimmedDir = path.join(path.dirname(outputPath), "trimmed_pdf_pages");

		// Create temp directories
		for (const dir of [tempDir, trimmedDir]) {
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
		}

		// Use pdftoppm to convert PDF pages to individual PNG files
		const tempFilePrefix = path.join(tempDir, "page");

		console.log(`Converting PDF to PNG: ${path.basename(inputPath)}`);
		await execPromise(
			`pdftoppm -png -r ${dpi} "${inputPath}" "${tempFilePrefix}"`,
		);

		// Get all generated PNG files and sort them
		const pageFiles = fs
			.readdirSync(tempDir)
			.filter((file) => file.endsWith(".png"))
			.sort((a, b) => {
				const numA = Number.parseInt(
					a.replace("page-", "").replace(".png", ""),
				);
				const numB = Number.parseInt(
					b.replace("page-", "").replace(".png", ""),
				);
				return numA - numB;
			})
			.map((file) => path.join(tempDir, file));

		if (pageFiles.length === 0) {
			throw new Error(`No pages were extracted from ${inputPath}`);
		}

		console.log(`Found ${pageFiles.length} page images`);

		// Trim margins from each page and save to the trimmed directory
		const trimmedPages = await Promise.all(
			pageFiles.map(async (file, index) => {
				const trimmedPath = path.join(
					trimmedDir,
					`trimmed-${path.basename(file)}`,
				);
				const dimensions = await trimImageMargins(file, trimmedPath);
				return {
					...dimensions,
					path: trimmedPath,
				};
			}),
		);

		// Find the maximum width among trimmed pages
		const maxWidth = Math.max(...trimmedPages.map((dim) => dim.width));

		// Calculate total height
		const totalHeight = trimmedPages.reduce((sum, dim) => sum + dim.height, 0);

		console.log(
			`Creating combined image with dimensions ${maxWidth}x${totalHeight}`,
		);

		// Create a new image with the combined dimensions
		const composite = sharp({
			create: {
				width: maxWidth,
				height: totalHeight,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 1 },
			},
		});

		// Prepare composite operations
		const compositeOperations = [];
		let currentY = 0;

		for (const dim of trimmedPages) {
			compositeOperations.push({
				input: dim.path,
				top: currentY,
				left: Math.floor((maxWidth - dim.width) / 2), // Center horizontally
			});
			currentY += dim.height;
		}

		// Create output directory if it doesn't exist
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Apply composite operations
		await composite.composite(compositeOperations).png().toFile(outputPath);

		console.log(`Combined image saved to ${outputPath}`);

		// Clean up temporary files
		for (const dir of [tempDir, trimmedDir]) {
			if (fs.existsSync(dir)) {
				const pngFiles = fs
					.readdirSync(dir)
					.filter((file) => file.endsWith(".png"));
				for (const file of pngFiles) {
					fs.unlinkSync(path.join(dir, file));
				}
				fs.rmdirSync(dir);
			}
		}

		console.log("Temporary files cleaned up");
	} catch (error) {
		console.error(`Error converting ${inputPath} to PNG:`, error);
		throw error;
	}
}

// Process all PDF files in a directory
async function processPdfDirectory(
	inputDir: string,
	outputDir: string,
	dpi = 300,
): Promise<void> {
	// Check if input directory exists
	if (!fs.existsSync(inputDir)) {
		throw new Error(`Input directory does not exist: ${inputDir}`);
	}

	// Create output directory if it doesn't exist
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Get all PDF files in the input directory
	const pdfFiles = fs
		.readdirSync(inputDir)
		.filter((file) => file.toLowerCase().endsWith(".pdf"))
		.map((file) => path.join(inputDir, file));

	if (pdfFiles.length === 0) {
		console.warn(`No PDF files found in ${inputDir}`);
		return;
	}

	console.log(`Found ${pdfFiles.length} PDF files to process`);

	// Process each PDF file
	for (const pdfFile of pdfFiles) {
		const baseName = path.basename(pdfFile, ".pdf");
		const outputPath = path.join(outputDir, `${baseName}.png`);

		try {
			await convertPdfToPng(pdfFile, outputPath, dpi);
			console.log(`Successfully processed: ${baseName}`);
		} catch (error) {
			console.error(`Failed to process ${baseName}:`, error);
			// Continue with next file
		}
	}

	console.log("All PDF files processed");
}

// Command line interface
async function main() {
	const program = new Command();

	program
		.name("pdf-to-png")
		.description("Convert PDF files to PNG images with margin trimming")
		.version("1.0.0")
		.requiredOption(
			"-i, --input <directory>",
			"Input directory containing PDF files",
		)
		.requiredOption(
			"-o, --output <directory>",
			"Output directory for PNG images",
		)
		.option(
			"-d, --dpi <number>",
			"DPI resolution for conversion (default: 300)",
			"300",
		)
		.option(
			"-t, --threshold <number>",
			"Threshold for trimming (0-255, default: 250)",
			"250",
		)
		.parse(process.argv);

	const options = program.opts();

	const inputDir = path.resolve(options.input);
	const outputDir = path.resolve(options.output);
	const dpi = Number.parseInt(options.dpi);
	const threshold = Number.parseInt(options.threshold);

	await processPdfDirectory(inputDir, outputDir, dpi).catch((err) => {
		console.error("Error processing PDFs:", err);
		process.exit(1);
	});
}

// If this file is run directly
if (require.main === module) {
	main().catch((err) => {
		console.error("Fatal error:", err);
		process.exit(1);
	});
}

// Export functions for use in other modules
export { convertPdfToPng, processPdfDirectory, trimImageMargins };
