import type { z } from "zod";
import dotenv from "dotenv";
import {
	TextractClient,
	DetectDocumentTextCommand,
} from "@aws-sdk/client-textract";
import fs from "node:fs";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import { compareToGroundTruth } from "../utils/resultComparator";
import { textBboxesToStr } from "../utils/textBboxesToStr";
import type { TextBbox, TextBboxesToStrMode } from "../types/bbox";

// export interface BBox {
// 	x0: number;
// 	y0: number;
// 	x1: number;
// 	y1: number;
// }

// export interface TextBbox {
// 	bbox: BBox;
// 	text: string;
// }

dotenv.config();

const textractClient = new TextractClient({
	region: "us-west-2",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
	},
});

const textractOcrWithBbox = async (
	imagePath: string,
	options: { mode: TextBboxesToStrMode } = {
		mode: "json",
	},
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	try {
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
		const lines: TextBbox[] = [];
		for (const line of extractedLines) {
			if (!line.Geometry?.Polygon) continue;
			lines.push({
				bbox: {
					x0: line.Geometry.Polygon[0].X || 0,
					y0: line.Geometry.Polygon[0].Y || 0,
					x1: line.Geometry.Polygon[2].X || 0,
					y1: line.Geometry.Polygon[2].Y || 0,
				},
				text: line.Text || "",
			});
		}
		const text = textBboxesToStr(lines, options.mode);
		console.log("\n", text, "\n");

		// const openAI = new OpenAIWrapper();
		// return await openAI.completion({
		// 	prompt: parseWorkExperiencePrompt,
		// 	modelName: "gpt-4o",
		// 	variables: {
		// 		resume: extractedText,
		// 	},
		// });
	} catch (error) {
		console.error("Error during Textract OCR processing:", error);
		throw error;
	}
};

export default textractOcrWithBbox;

if (require.main === module) {
	textractOcrWithBbox("./assets/images/standard.png");
	// compareToGroundTruth(textractOcrWithBbox, "./assets/ground-truth.json");
}
