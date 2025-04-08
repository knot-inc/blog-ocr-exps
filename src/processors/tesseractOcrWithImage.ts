import type { z } from "zod";
import { createWorker } from "tesseract.js";

import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import { compareToGroundTruth } from "../utils/comparisonTools";
import imageToBase64 from "../utils/imageToBase64";

const tesseractOcrWithImage = async (
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	const worker = await createWorker("eng");

	try {
		const {
			data: { text },
		} = await worker.recognize(imagePath);

		console.log(`\n========== ${imagePath} ==========`);
		console.log("\n", text, "\n");

		const imageUrl = await imageToBase64(imagePath, "image/png");

		const openAI = new OpenAIWrapper();
		return await openAI.completion({
			prompt: parseWorkExperiencePrompt,
			modelName: "gpt-4o",
			variables: {
				resume: text,
			},
			imageUrls: [imageUrl],
		});
	} catch (error) {
		console.error("Error during OCR processing:", error);
		throw error;
	} finally {
		await worker.terminate();
	}
};

export default tesseractOcrWithImage;

if (require.main === module) {
	compareToGroundTruth(tesseractOcrWithImage);
}
