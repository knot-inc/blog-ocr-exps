import dotenv from "dotenv";
import type { z } from "zod";
import { Mistral } from "@mistralai/mistralai";

import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import imageToBase64 from "../utils/imageToBase64";
import { compareToGroundTruth } from "../utils/resultComparator";

dotenv.config();

const mistralOcr = async (
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	const imageUrl = await imageToBase64(imagePath, "image/png");
	const mistralClient = new Mistral({
		apiKey: process.env.MISTRAL_API_KEY,
	});
	const ocrResponse = await mistralClient.ocr.process({
		model: "mistral-ocr-latest",
		document: {
			type: "image_url",
			imageUrl: imageUrl,
		},
	});
	const text = ocrResponse.pages.map((page) => page.markdown).join("\n\n");

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
};
export default mistralOcr;

if (require.main === module) {
	compareToGroundTruth(mistralOcr, "./assets/ground-truth.json");
}
