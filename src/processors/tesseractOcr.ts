import type { z } from "zod";
import { createWorker } from "tesseract.js";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { compareToGroundTruth } from "../utils/resultComparator";

const tesseractOcr = async (
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	const worker = await createWorker("eng");

	try {
		const {
			data: { text },
		} = await worker.recognize(imagePath);

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

export default tesseractOcr;

if (require.main === module) {
	compareToGroundTruth(tesseractOcr, "./assets/ground-truth.json");
}
