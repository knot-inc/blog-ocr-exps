import { OpenAIWrapper } from "../utils/openaiWrapper";
import {
	parseWorkExperiencePrompt,
	type parseWorkExperienceSchema,
} from "../prompts/parse-work-experience";
import imageToBase64 from "../utils/imageToBase64";
import type { z } from "zod";

const processImage = async (
	imagePath: string,
): Promise<z.infer<typeof parseWorkExperienceSchema>> => {
	const openAI = new OpenAIWrapper();
	const imageUrl = await imageToBase64(imagePath, "image/png");

	return await openAI.completion({
		prompt: parseWorkExperiencePrompt,
		modelName: "gpt-4o",
		variables: {
			resume: "Please analyze the resume in the image and return as JSON",
		},
		imageUrls: [imageUrl],
		detail: "high",
	});
};
export default processImage;
