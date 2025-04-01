import processImage from "./processors/imageInput";
import { compareToGroundTruth } from "./utils/resultComparator";

async function main() {
	console.log("Starting resume parsing comparison...");

	try {
		// Run comparison using our image processor function
		await compareToGroundTruth(processImage, "./assets/ground-truth.json");
	} catch (error) {
		console.error("Error:", error);
	}
}

main();
