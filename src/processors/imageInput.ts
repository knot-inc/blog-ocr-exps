import { OpenAIWrapper } from "../utils/openaiWrapper";
import { parseWorkExperiencePrompt } from "../prompts/parse-work-experience";
import { imageToBase64Sync } from "../utils/imageToBase64";

const processImage = async (imagePath: string) => {
	const openAI = new OpenAIWrapper();
	const imageUrl = imageToBase64Sync(imagePath, "image/png");

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
