import { createWorker } from "tesseract.js";
import type { z } from "zod";

import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { compareToGroundTruth } from "../utils/comparisonTools";
import { OpenAIWrapper } from "../utils/openaiWrapper";

const tesseractOcr = async (
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	const worker = await createWorker("eng");

	try {
		const {
			data: { text },
		} = await worker.recognize(imagePath);

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
		console.error("Error during OCR processing:", error);
		throw error;
	} finally {
		await worker.terminate();
	}
};

export default tesseractOcr;

if (require.main === module) {
	compareToGroundTruth(tesseractOcr);
}
