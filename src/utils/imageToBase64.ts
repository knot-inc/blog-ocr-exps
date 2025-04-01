import * as fs from "fs";

/**
 * Converts an image file to a base64 encoded data URL
 * @param imagePath - Path to the image file
 * @param mimeType - Optional MIME type (defaults to 'image/jpeg')
 * @returns Promise with the base64 data URL
 */
export function imageToBase64(
	imagePath: string,
	mimeType: string = "image/jpeg",
): Promise<string> {
	return new Promise((resolve, reject) => {
		fs.readFile(imagePath, (err, data) => {
			if (err) {
				reject(err);
				return;
			}

			// Convert binary data to base64 string
			const base64String = data.toString("base64");

			// Create the complete data URL
			const dataUrl = `data:${mimeType};base64,${base64String}`;

			resolve(dataUrl);
		});
	});
}

/**
 * Synchronous version of imageToBase64
 * @param imagePath - Path to the image file
 * @param mimeType - Optional MIME type (defaults to 'image/jpeg')
 * @returns The base64 data URL
 */
export function imageToBase64Sync(
	imagePath: string,
	mimeType: string = "image/jpeg",
): string {
	// Read file synchronously
	const data = fs.readFileSync(imagePath);

	// Convert binary data to base64 string
	const base64String = data.toString("base64");

	// Create the complete data URL
	return `data:${mimeType};base64,${base64String}`;
}

// Example usage:
// Async version
// imageToBase64('path_to_your_image.jpg')
//   .then(dataUrl => console.log(dataUrl))
//   .catch(err => console.error(err));

// Sync version
// const dataUrl = imageToBase64Sync('path_to_your_image.jpg');
// console.log(dataUrl);
