import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { exec } from "child_process";
import sharp from "sharp"; // Changed from "import * as sharp"
import { Command } from "commander";

const execPromise = util.promisify(exec);

// Convert a single PDF file to a vertically combined PNG
async function convertPdfToPng(
	inputPath: string,
	outputPath: string,
	dpi: number = 300,
): Promise<void> {
	try {
		// Create a temporary directory for individual page images
		const tempDir = path.join(path.dirname(outputPath), "temp_pdf_pages");
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
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
				const numA = parseInt(a.replace("page-", "").replace(".png", ""));
				const numB = parseInt(b.replace("page-", "").replace(".png", ""));
				return numA - numB;
			})
			.map((file) => path.join(tempDir, file));

		if (pageFiles.length === 0) {
			throw new Error(`No pages were extracted from ${inputPath}`);
		}

		console.log(`Found ${pageFiles.length} page images`);

		// Get dimensions of each page
		const pageDimensions = await Promise.all(
			pageFiles.map(async (file) => {
				// Fixed: Use sharp directly as a function instead of calling it as a method
				const metadata = await sharp(file).metadata();
				return {
					width: metadata.width as number,
					height: metadata.height as number,
					path: file,
				};
			}),
		);

		// Find the maximum width
		const maxWidth = Math.max(...pageDimensions.map((dim) => dim.width));

		// Calculate total height
		const totalHeight = pageDimensions.reduce(
			(sum, dim) => sum + dim.height,
			0,
		);

		console.log(
			`Creating combined image with dimensions ${maxWidth}x${totalHeight}`,
		);

		// Create a new image with the combined dimensions
		// Fixed: Use sharp directly as a function
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

		for (const dim of pageDimensions) {
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
		pageFiles.forEach((file) => fs.unlinkSync(file));
		fs.rmdirSync(tempDir);

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
	dpi: number = 300,
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
		.description("Convert PDF files to PNG images")
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
	const dpi = parseInt(options.dpi);

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
export { convertPdfToPng, processPdfDirectory };
