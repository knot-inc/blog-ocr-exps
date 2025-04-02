import processImage from "./processors/imageInput";
import { compareToGroundTruth } from "./utils/resultComparator";

async function main() {
	await compareToGroundTruth(processImage);
}

main();
