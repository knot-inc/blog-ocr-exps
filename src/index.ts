import processImage from "./processors/imageInput";
import { compareToGroundTruth } from "./utils/resultComparator";

async function main() {
	await compareToGroundTruth(processImage, "./assets/ground-truth.json");
}

main();
