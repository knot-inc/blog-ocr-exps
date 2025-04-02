import type { z } from "zod";
import { createWorker, type RecognizeResult } from "tesseract.js";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { compareToGroundTruth } from "../utils/resultComparator";

interface BBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

interface TextBbox {
	bbox: BBox;
	text: string;
}

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

type textBboxesToStringFormat = "json" | "csv" | "xml" | "ltwh";

const textBboxesToString = (
	textBboxes: TextBbox[],
	mode: textBboxesToStringFormat = "json",
): string => {
	if (textBboxes.length === 0) return "";

	switch (mode) {
		case "json":
			return JSON.stringify(textBboxes);

		case "csv": {
			// CSV format: x0,y0,x1,y1,text
			const headers = "x0,y0,x1,y1,text";
			const rows = textBboxes.map(
				(textBbox) =>
					`${textBbox.bbox.x0},${textBbox.bbox.y0},${textBbox.bbox.x1},${textBbox.bbox.y1},"${textBbox.text.replace(/"/g, '""')}"`,
			);
			return [headers, ...rows].join("\n");
		}

		case "xml": {
			// XML format
			const xmlLines = textBboxes.map(
				(textBbox) =>
					`<line x0="${textBbox.bbox.x0}" y0="${textBbox.bbox.y0}" x1="${textBbox.bbox.x1}" y1="${textBbox.bbox.y1}">${textBbox.text.replace("\n", " ")}</line>`,
			);
			return xmlLines.join("\n");
		}

		case "ltwh": {
			// Left, Top, Width, Height format
			const ltwhLines = textBboxes.map((textBbox) => {
				const width = textBbox.bbox.x1 - textBbox.bbox.x0;
				const height = textBbox.bbox.y1 - textBbox.bbox.y0;
				const text = textBbox.text.replace("\n", " ");
				return `${text}, ltwh ${textBbox.bbox.x0} ${textBbox.bbox.y0} ${width} ${height}`;
			});
			return ltwhLines.join("\n");
		}

		default:
			return JSON.stringify(textBboxes);
	}
};

// Parse command line arguments - only for mode
const parseCliArgs = (): {
	extract: "words" | "lines";
	mode: textBboxesToStringFormat;
} => {
	const args = process.argv.slice(2);
	let extract: "words" | "lines" = "lines";
	let mode: textBboxesToStringFormat = "json";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--extract" || args[i] === "-e") {
			extract = args[i + 1] as "words" | "lines";
			i++;
		}
		if (args[i] === "--mode" || args[i] === "-m") {
			mode = args[i + 1] as textBboxesToStringFormat;
			i++;
		}
	}
	return { extract, mode };
};

const tesseractOcrWithCoords = async (
	imagePath: string,
	options: { extract?: "words" | "lines"; mode: textBboxesToStringFormat } = {
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
		const text = textBboxesToString(textBboxes, options.mode);
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

if (require.main === module) {
	const options = parseCliArgs();

	// Run the comparison to ground truth, passing the selected mode
	compareToGroundTruth(
		async (path) => tesseractOcrWithCoords(path, options),
		"./assets/ground-truth.json",
	);
}
