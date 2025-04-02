import type { z } from "zod";
import {
	TextractClient,
	DetectDocumentTextCommand,
} from "@aws-sdk/client-textract";
import fs from "node:fs";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { compareToGroundTruth } from "../utils/resultComparator";

const textractClient = new TextractClient({
	region: "us-west-2",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
	},
});

const textractOcr = async (
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	try {
		const fileBytes = fs.readFileSync(imagePath);

		const command = new DetectDocumentTextCommand({
			Document: {
				Bytes: fileBytes,
			},
		});

		const response = await textractClient.send(command);

		const extractedText = response.Blocks?.filter(
			(block) => block.BlockType === "LINE" && block.Text,
		)
			.map((block) => block.Text)
			.join("\n");

		if (!extractedText) {
			throw new Error("No text found in the document");
		}

		const openAI = new OpenAIWrapper();
		return await openAI.completion({
			prompt: parseWorkExperiencePrompt,
			modelName: "gpt-4o",
			variables: {
				resume: extractedText,
			},
		});
	} catch (error) {
		console.error("Error during Textract OCR processing:", error);
		throw error;
	}
};

export default textractOcr;

if (require.main === module) {
	compareToGroundTruth(textractOcr, "./assets/ground-truth.json");
}
