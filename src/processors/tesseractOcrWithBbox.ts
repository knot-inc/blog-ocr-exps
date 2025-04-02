import type { z } from "zod";
import { createWorker, type RecognizeResult } from "tesseract.js";

import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import { compareToGroundTruth } from "../utils/comparisonTool";
import { textBboxesToStr } from "../utils/textBboxesToStr";
import type { TextBbox, TextBboxesToStrMode } from "../types/bbox";

const extractLinesWithCoords = (data: RecognizeResult["data"]): TextBbox[] => {
	if (!data.blocks) return [];
	const blocks = data.blocks;
	const lines: TextBbox[] = [];
	for (const block of blocks) {
		if (!block.paragraphs) continue;
		for (const paragraph of block.paragraphs) {
			if (!paragraph.lines) continue;
			for (const line of paragraph.lines) {
				lines.push({
					bbox: {
						x0: line.bbox.x0,
						y0: line.bbox.y0,
						x1: line.bbox.x1,
						y1: line.bbox.y1,
					},
					text: line.text,
				});
			}
		}
	}
	return lines;
};

const extractWordsWithCoords = (data: RecognizeResult["data"]): TextBbox[] => {
	if (!data.blocks) return [];
	const blocks = data.blocks;
	const words: TextBbox[] = [];
	for (const block of blocks) {
		if (!block.paragraphs) continue;
		for (const paragraph of block.paragraphs) {
			if (!paragraph.lines) continue;
			for (const line of paragraph.lines) {
				if (!line.words) continue;
				for (const word of line.words) {
					words.push({
						bbox: {
							x0: word.bbox.x0,
							y0: word.bbox.y0,
							x1: word.bbox.x1,
							y1: word.bbox.y1,
						},
						text: word.text,
					});
				}
			}
		}
	}
	return words;
};

const tesseractOcrWithCoords = async (
	imagePath: string,
	options: { extract?: "words" | "lines"; mode: TextBboxesToStrMode } = {
		extract: "lines",
		mode: "json",
	},
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	const worker = await createWorker("eng");

	try {
		const { data } = await worker.recognize(imagePath, {}, { blocks: true });

		let textBboxes: TextBbox[] = [];
		if (options.extract === "words") {
			textBboxes = extractWordsWithCoords(data);
		} else {
			textBboxes = extractLinesWithCoords(data);
		}
		const text = textBboxesToStr(textBboxes, options.mode);

		console.log(`\n========== ${imagePath} ==========`);
		console.log("\n", text, "\n");

		const openAI = new OpenAIWrapper();
		return await openAI.completion({
			prompt: parseWorkExperiencePrompt,
			modelName: "gpt-4o",
			variables: {
				resume: text,
			},
		});
	} catch (error) {
		console.error("Error during OCR processing:", error);
		throw error;
	} finally {
		await worker.terminate();
	}
};

export default tesseractOcrWithCoords;

const parseCliArgs = (): {
	extract: "words" | "lines";
	mode: TextBboxesToStrMode;
} => {
	const args = process.argv.slice(2);
	let extract: "words" | "lines" = "lines";
	let mode: TextBboxesToStrMode = "ltwh";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--extract" || args[i] === "-e") {
			extract = args[i + 1] as "words" | "lines";
			i++;
		}
		if (args[i] === "--mode" || args[i] === "-m") {
			mode = args[i + 1] as TextBboxesToStrMode;
			i++;
		}
	}
	return { extract, mode };
};

if (require.main === module) {
	const options = parseCliArgs();

	// Run the comparison to ground truth, passing the selected mode
	compareToGroundTruth(async (path) => tesseractOcrWithCoords(path, options));
}
