import type { z } from "zod/v4";

import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import { OpenAIWrapper } from "../utils/openaiWrapper";
import imageToBase64 from "../utils/imageToBase64";
import { compareToGroundTruth } from "../utils/comparisonTools";

const processImage = async (
	imagePath: string,
	options?: {
		modelName?: string;
		detail?: "high" | "low" | "auto";
	},
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	const openAI = new OpenAIWrapper();
	const imageUrl = await imageToBase64(imagePath, "image/png");

	return await openAI.completion({
		prompt: parseWorkExperiencePrompt,
		modelName: options?.modelName || "gpt-4o",
		variables: {
			resume: "Please analyze the resume in the image and return as JSON",
		},
		imageUrls: [imageUrl],
		detail: options?.detail || "high",
	});
};
export default processImage;

const parseCliArgs = (): {
	modelName: string;
	detail: "high" | "low" | "auto";
} => {
	const args = process.argv.slice(2);
	let modelName = "gpt-4o";
	let detail: "high" | "low" | "auto" = "high";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--model" || args[i] === "-m") {
			modelName = args[i + 1];
			i++;
		}
		if (args[i] === "--detail" || args[i] === "-d") {
			detail = args[i + 1] as "high" | "low" | "auto";
			i++;
		}
	}
	return { modelName, detail };
};

if (require.main === module) {
	const { modelName, detail } = parseCliArgs();
	console.log(`Using model: ${modelName}, detail: ${detail}`);
	compareToGroundTruth((path) => processImage(path, { modelName, detail }));
}
