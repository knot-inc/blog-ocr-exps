import type { z } from "zod";
import dotenv from "dotenv";
import {
	TextractClient,
	DetectDocumentTextCommand,
} from "@aws-sdk/client-textract";
import fs from "node:fs";
import path from "node:path";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import { compareToGroundTruth } from "../utils/comparisonTools";
import { textBboxesToStr } from "../utils/textBboxesToStr";
import type { TextBbox, TextBboxesToStrMode } from "../types/bbox";

dotenv.config();

const textractClient = new TextractClient({
	region: "us-west-2",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
	},
});

const normPoly = (item: number): number => {
	return Math.round(item * 1000);
};

const processedTextractOcrWithBbox = async (
	imagePath: string,
	options: {
		mode: TextBboxesToStrMode;
		saveText?: boolean;
		dataFolder?: string;
	} = {
		mode: "ltwh",
		// saveText: true,
		// dataFolder: "data/resumes-tesseractOcrWithImage",
	},
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	try {
		// Check if .txt file already exists
		const imageBasename = path.basename(imagePath, path.extname(imagePath));
		const txtFilePath = options.dataFolder
			? path.join(options.dataFolder, `${imageBasename}.txt`)
			: path.join(path.dirname(imagePath), `${imageBasename}.txt`);

		let text: string;

		if (fs.existsSync(txtFilePath)) {
			// Use existing .txt file
			console.log(`Using existing text file: ${txtFilePath}`);
			text = fs.readFileSync(txtFilePath, "utf8");
		} else {
			// Process with Textract
			console.log(`Processing image with Textract: ${imagePath}`);
			const fileBytes = fs.readFileSync(imagePath);

			const command = new DetectDocumentTextCommand({
				Document: {
					Bytes: fileBytes,
				},
			});

			const response = await textractClient.send(command);
			const extractedLines = response.Blocks?.filter(
				(block) => block.BlockType === "LINE" && block.Text,
			);
			if (!extractedLines) {
				throw new Error("No text found in the document");
			}
			const textBboxes: TextBbox[] = [];
			for (const line of extractedLines) {
				if (!line.Geometry?.Polygon) continue;
				textBboxes.push({
					bbox: {
						x0: normPoly(line.Geometry.Polygon[0].X || 0),
						y0: normPoly(line.Geometry.Polygon[0].Y || 0),
						x1: normPoly(line.Geometry.Polygon[2].X || 0),
						y1: normPoly(line.Geometry.Polygon[2].Y || 0),
					},
					text: line.Text || "",
				});
			}
			text = textBboxesToStr(textBboxes, options.mode);

			// Save text to .txt file if requested
			if (options.saveText && options.dataFolder) {
				const txtOutputPath = path.join(
					options.dataFolder,
					`${imageBasename}.txt`,
				);

				try {
					fs.writeFileSync(txtOutputPath, text, "utf8");
					console.log(`Saved text output to: ${txtOutputPath}`);
				} catch (error) {
					console.error(`Error saving text file ${txtOutputPath}:`, error);
				}
			}
		}

		// console.log(`\n========== ${imagePath} ==========`);
		// console.log("\n", text, "\n");

		const openAI = new OpenAIWrapper();
		return await openAI.completion({
			prompt: parseWorkExperiencePrompt,
			variables: {
				resume: text,
			},
		});
	} catch (error) {
		console.error("Error during Textract OCR processing:", error);
		throw error;
	}
};

export default processedTextractOcrWithBbox;

const parseCliArgs = (): {
	mode: TextBboxesToStrMode;
	dataFolder?: string;
	saveText: boolean;
} => {
	const args = process.argv.slice(2);
	let mode: TextBboxesToStrMode = "lt";
	let dataFolder: string | undefined;
	let saveText = true;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--mode" || args[i] === "-m") {
			mode = args[i + 1] as TextBboxesToStrMode;
			i++;
		} else if (args[i] === "--data-folder" || args[i] === "-d") {
			dataFolder = args[i + 1];
			saveText = true; // Enable text saving when data folder is specified
			i++;
		} else if (args[i] === "--save-text") {
			saveText = true;
		}
	}
	return { mode, dataFolder, saveText };
};

if (require.main === module) {
	const options = parseCliArgs();

	// Run the comparison to ground truth, passing the selected mode and save options
	compareToGroundTruth(
		async (imagePath) =>
			processedTextractOcrWithBbox(imagePath, {
				mode: options.mode,
				saveText: options.saveText,
				dataFolder: options.dataFolder,
			}),
		options.dataFolder,
	);
}
