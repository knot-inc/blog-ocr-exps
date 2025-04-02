import dotenv from "dotenv";
import type { z } from "zod";
import { Mistral } from "@mistralai/mistralai";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
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
	const result = ocrResponse.pages.map((page) => page.markdown).join("\n\n")
		
	const openAI = new OpenAIWrapper();
	return await openAI.completion({
		prompt: parseWorkExperiencePrompt,
		modelName: "gpt-4o",
		variables: {
			resume: result,
		},
	});
};
export default mistralOcr;

if (require.main === module) {
	compareToGroundTruth(mistralOcr, "./assets/ground-truth.json");
}
