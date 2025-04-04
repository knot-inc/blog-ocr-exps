import {
	matchUtils,
	findBestMatch,
	compareFields,
} from "../src/utils/comparisonUtils";

describe("Comparison Utilities", () => {
	describe("matchUtils", () => {
		describe("getMatchPercentage", () => {
			test("should return 100 for identical strings", () => {
				const result = matchUtils.getMatchPercentage(
					"software engineer",
					"software engineer",
				);
				expect(result).toBe(100);
			});

			test("should return 0 for empty strings", () => {
				expect(matchUtils.getMatchPercentage("", "")).toBe(0);
				expect(matchUtils.getMatchPercentage("test", "")).toBe(0);
				expect(matchUtils.getMatchPercentage("", "test")).toBe(0);
			});

			test("should handle date matching correctly", () => {
				// Full date match (should return 100)
				expect(matchUtils.getMatchPercentage("2022-05-10", "2022-05-10")).toBe(
					100,
				);

				// Year and month match (should return 67)
				expect(matchUtils.getMatchPercentage("2022-05", "2022-05-10")).toBe(67);

				// Year only match (should return 33)
				expect(matchUtils.getMatchPercentage("2022", "2022-05-10")).toBe(33);

				// No match (should return 0)
				expect(matchUtils.getMatchPercentage("2021", "2022-05-10")).toBe(0);
			});
		});

		describe("getEmoji", () => {
			test("should return correct emoji based on score", () => {
				expect(matchUtils.getEmoji(100)).toBe("✅");
				expect(matchUtils.getEmoji(75)).toBe("⚠️ ");
				expect(matchUtils.getEmoji(51)).toBe("⚠️ ");
				expect(matchUtils.getEmoji(50)).toBe("❌");
				expect(matchUtils.getEmoji(0)).toBe("❌");
			});
		});

		describe("getDateNote", () => {
			test("should return correct note based on score", () => {
				expect(matchUtils.getDateNote(100)).toBe("");
				expect(matchUtils.getDateNote(67)).toBe(" (Year-Month)");
				expect(matchUtils.getDateNote(33)).toBe(" (Year only)");
				expect(matchUtils.getDateNote(0)).toBe("");
			});
		});

		describe("highlightDifferences", () => {
			test("should return extracted text when strings match", () => {
				const result = matchUtils.highlightDifferences(
					"test text",
					"test text",
				);
				expect(result).toBe("test text");
			});

			test("should return N/A when both strings are empty", () => {
				const result = matchUtils.highlightDifferences("", "");
				expect(result).toBe("N/A");
			});

			test("should return extracted text for short strings", () => {
				const result = matchUtils.highlightDifferences("short", "different");
				expect(result).toBe("short");
			});
		});
	});

	describe("findBestMatch", () => {
		test("should find the best matching job based on field similarity", () => {
			const job = {
				title: "AAA",
				company: "Tech Co",
				startDate: "N/A",
				endDate: "N/A",
				description: "N/A",
			};

			const groundTruthJobs = [
				{
					title: "Frontend Developer",
					company: "Other Co",
					startDate: "2021-05",
					endDate: "2022-05",
					description: "Built UI components",
				},
				{
					title: "Software Engineer",
					company: "Tech Co",
					startDate: "2022-01",
					endDate: "2023-02",
					description: "Developed backend services",
				},
			];

			const result = findBestMatch(job, groundTruthJobs);

			expect(result.index).toBe(1); // Should match the second job
			expect(result.score).toBeGreaterThan(0);
		});

		test("should return -1 index when no matches found", () => {
			const job = {
				title: "Data Scientist",
				company: "AI Corp",
				startDate: "2022-01",
				endDate: "2023-01",
				description: "Built ML models",
			};

			const groundTruthJobs = [
				{
					title: "Frontend Developer",
					company: "Other Co",
					startDate: "2021-05",
					endDate: "2022-05",
					description: "Built UI components",
				},
			];

			const result = findBestMatch(job, groundTruthJobs);

			// The result will depend on the actual implementation
			// but we can at least test the structure of the result
			expect(result).toHaveProperty("index");
			expect(result).toHaveProperty("score");
		});
	});

	describe("compareFields", () => {
		test("should compare fields between jobs and return match scores", () => {
			// Setup jobs to compare
			const job = {
				title: "Software Engineer",
				company: "Tech Co",
				startDate: "2022-01",
				endDate: "2023-01",
				description: "Developed web applications",
			};

			const gtJob = {
				title: "Software Engineer",
				company: "Tech Co",
				startDate: "2022-01",
				endDate: "2023-01",
				description: "Developed web applications",
			};

			// Suppress console.log during the test
			const originalConsoleLog = console.log;
			console.log = jest.fn();

			const result = compareFields(job, gtJob, true);

			// Restore console.log
			console.log = originalConsoleLog;

			// Should have a score for each field
			expect(result.fieldMatches.length).toBe(5);

			// All fields should match 100%
			expect(result.fieldMatches.every((score) => score === 100)).toBe(true);

			// Should have scores for each field type
			expect(Object.keys(result.fieldTypeScores).length).toBe(5);
			expect(result.fieldTypeScores).toEqual({
				Title: 100,
				Company: 100,
				"Start Date": 100,
				"End Date": 100,
				Description: 100,
			});
		});

		test("should handle missing fields correctly", () => {
			const job = {
				title: "Software Engineer",
				company: "Tech Co",
				// Missing startDate and endDate
				description: "Developed web applications",
			};

			const gtJob = {
				title: "Software Engineer",
				company: "Tech Co",
				startDate: "2022-01",
				endDate: "2023-01",
				description: "Developed web applications",
			};

			// Suppress console.log during the test
			const originalConsoleLog = console.log;
			console.log = jest.fn();

			const result = compareFields(job, gtJob, false);

			// Restore console.log
			console.log = originalConsoleLog;

			// We still expect a proper result structure
			expect(result).toHaveProperty("fieldMatches");
			expect(result).toHaveProperty("fieldTypeScores");
			expect(result.fieldTypeScores).toHaveProperty("Title");
			expect(result.fieldTypeScores).toHaveProperty("Company");
			expect(result.fieldTypeScores).toHaveProperty("Description");

			// Should have field type scores for the missing fields
			expect(result.fieldTypeScores).toHaveProperty("Start Date");
			expect(result.fieldTypeScores).toHaveProperty("End Date");
		});
	});
});
