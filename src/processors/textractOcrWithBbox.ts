import fs from "node:fs";
import {
	DetectDocumentTextCommand,
	TextractClient,
} from "@aws-sdk/client-textract";
import dotenv from "dotenv";
import type { z } from "zod";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import type { TextBbox, TextBboxesToStrMode } from "../types/bbox";
import { compareToGroundTruth } from "../utils/comparisonTools";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import { textBboxesToStr } from "../utils/textBboxesToStr";

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

const textractOcrWithBbox = async (
	imagePath: string,
	options: { mode: TextBboxesToStrMode } = {
		mode: "ltwh",
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
		const text = textBboxesToStr(textBboxes, options.mode);

		console.log(`\n========== ${imagePath} ==========`);
		console.log("\n", text, "\n");

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

export default textractOcrWithBbox;

const parseCliArgs = (): {
	mode: TextBboxesToStrMode;
} => {
	const args = process.argv.slice(2);
	let mode: TextBboxesToStrMode = "lt";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--mode" || args[i] === "-m") {
			mode = args[i + 1] as TextBboxesToStrMode;
			i++;
		}
	}
	return { mode };
};

if (require.main === module) {
	const options = parseCliArgs();

	// Run the comparison to ground truth, passing the selected mode
	compareToGroundTruth(async (path) => textractOcrWithBbox(path, options));
}
