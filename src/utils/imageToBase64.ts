import * as fs from "node:fs";

/**
 * Converts an image file to a base64 encoded data URL
 * @param imagePath - Path to the image file
 * @param mimeType - Optional MIME type (defaults to 'image/png')
 * @returns Base64 encoded data URL
 */
const imageToBase64 = async (
	imagePath: string,
	mimeType = "image/png",
): Promise<string> => {
	const data = await fs.promises.readFile(imagePath);
	const base64String = data.toString("base64");
	return `data:${mimeType};base64,${base64String}`;
};
export default imageToBase64;
