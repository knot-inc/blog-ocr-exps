import { OpenAIWrapper } from "./utils/openaiWrapper";
import { parseWorkExperiencePrompt } from "./prompts/parse-work-experience";
import { imageToBase64Sync } from "./utils/imageToBase64";

async function main() {
  try {
    const openAI = new OpenAIWrapper();
    const image_path = "./docs/images/side-by-side.png";
    const imageUrl = imageToBase64Sync(image_path, "image/png");
    const result = await openAI.completion({
      prompt: parseWorkExperiencePrompt,
      modelName: "gpt-4o",
      variables: {
        resume: "Please analyze the resume in the image"
      },
      imageUrls: [imageUrl]
    });
    console.log(result);
  } catch (error) {
    console.error("Error:", error);
  }
}
main();
    