import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";
import { exec } from "node:child_process";
import sharp from "sharp";
import { Command } from "commander";

const execPromise = util.promisify(exec);

// Detect margins from an image
async function detectImageMargins(
	imagePath: string,
	threshold = 250, // Threshold for determining what is "white" (0-255)
): Promise<{ top: number; bottom: number; left: number; right: number }> {
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
		const channels = metadata.channels || 3;

		// Find top margin
		let topMargin = 0;
		topScan: for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * channels;
				for (let c = 0; c < Math.min(channels, 3); c++) {
					if (data[idx + c] < threshold) {
						topMargin = y;
						break topScan;
					}
				}
			}
		}

		// Find bottom margin
		let bottomMargin = 0;
		bottomScan: for (let y = height - 1; y >= 0; y--) {
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * channels;
				for (let c = 0; c < Math.min(channels, 3); c++) {
					if (data[idx + c] < threshold) {
						bottomMargin = height - 1 - y;
						break bottomScan;
					}
				}
			}
		}

		// Find left margin
		let leftMargin = 0;
		leftScan: for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				const idx = (y * width + x) * channels;
				for (let c = 0; c < Math.min(channels, 3); c++) {
					if (data[idx + c] < threshold) {
						leftMargin = x;
						break leftScan;
					}
				}
			}
		}

		// Find right margin
		let rightMargin = 0;
		rightScan: for (let x = width - 1; x >= 0; x--) {
			for (let y = 0; y < height; y++) {
				const idx = (y * width + x) * channels;
				for (let c = 0; c < Math.min(channels, 3); c++) {
					if (data[idx + c] < threshold) {
						rightMargin = width - 1 - x;
						break rightScan;
					}
				}
			}
		}

		return {
			top: topMargin,
			bottom: bottomMargin,
			left: leftMargin,
			right: rightMargin,
		};
	} catch (error) {
		console.error(`Error detecting margins from ${imagePath}:`, error);
		return { top: 0, bottom: 0, left: 0, right: 0 };
	}
}

// Trim the image using the provided margins
async function trimImage(
	imagePath: string,
	outputPath: string,
	margins: { top: number; bottom: number; left: number; right: number },
	padding = 5, // Safety padding
): Promise<{ width: number; height: number }> {
	try {
		// Read the image
		const image = sharp(imagePath);
		const metadata = await image.metadata();
		const { width, height } = metadata;

		if (!width || !height) {
			throw new Error(`Invalid image dimensions: ${width}x${height}`);
		}

		// Apply safety padding
		const safeTopMargin = Math.max(0, margins.top - padding);
		const safeBottomMargin = Math.max(0, margins.bottom - padding);
		const safeLeftMargin = Math.max(0, margins.left - padding);
		const safeRightMargin = Math.max(0, margins.right - padding);

		// Calculate new dimensions and coordinates
		const newWidth = width - safeLeftMargin - safeRightMargin;
		const newHeight = height - safeTopMargin - safeBottomMargin;
		const cropTop = safeTopMargin;
		const cropLeft = safeLeftMargin;

		// Check if we're actually cropping anything
		if (
			newWidth >= width &&
			newHeight >= height &&
			cropTop === 0 &&
			cropLeft === 0
		) {
			console.log(`No meaningful cropping for ${imagePath}, using full image`);
			await sharp(imagePath).toFile(outputPath);
			return { width, height };
		}

		// Check if we have valid dimensions
		if (newWidth <= 0 || newHeight <= 0) {
			console.warn(
				`Invalid crop dimensions for ${imagePath}, using full image`,
			);
			await sharp(imagePath).toFile(outputPath);
			return { width, height };
		}

		console.log(
			`Trimming image from ${width}x${height} to ${newWidth}x${newHeight}`,
		);

		// Extract and save the content area
		await sharp(imagePath)
			.extract({
				left: cropLeft,
				top: cropTop,
				width: newWidth,
				height: newHeight,
			})
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

		// Common padding for all directions
		const padding = 5;

		// First, detect margins for all pages
		const allMargins = await Promise.all(
			pageFiles.map(async (file) => {
				return await detectImageMargins(file);
			}),
		);

		// Find common left and right margins (minimum of all pages to ensure no content is cut off)
		const commonLeftMargin = Math.min(
			...allMargins.map((margin) => margin.left),
		);
		const commonRightMargin = Math.min(
			...allMargins.map((margin) => margin.right),
		);

		console.log(
			`Common margins: left=${commonLeftMargin}, right=${commonRightMargin}`,
		);

		// Trim each page with individual top/bottom margins but common left/right margins
		const trimmedPages = await Promise.all(
			pageFiles.map(async (file, index) => {
				const trimmedPath = path.join(
					trimmedDir,
					`trimmed-${path.basename(file)}`,
				);

				// Use page-specific top/bottom margins but common left/right margins
				const margins = {
					top: allMargins[index].top,
					bottom: allMargins[index].bottom,
					left: commonLeftMargin,
					right: commonRightMargin,
				};

				console.log(
					`Page ${index + 1} margins: top=${margins.top}, bottom=${margins.bottom}, left=${margins.left}, right=${margins.right}`,
				);

				const dimensions = await trimImage(file, trimmedPath, margins, padding);
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
		.description(
			"Convert PDF files to PNG images with consistent horizontal margin trimming",
		)
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
		.parse(process.argv);

	const options = program.opts();

	const inputDir = path.resolve(options.input);
	const outputDir = path.resolve(options.output);
	const dpi = Number.parseInt(options.dpi);

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
export { convertPdfToPng, processPdfDirectory, detectImageMargins, trimImage };
