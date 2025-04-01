import { Prompt } from "../types/prompt";
import { z } from "zod";

export const parseWorkExperienceSchema = z.object({
	workExperiences: z.array(
		z.object({
			title: z.string().optional(),
			company: z.string().optional().describe("Company name only"),
			description: z.string().optional(),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
		}),
	),
});

export const parseWorkExperiencePrompt: Prompt<
	{
		resume: string;
	},
	typeof parseWorkExperienceSchema
> = {
	name: "parse-work-experience",
	messages: [
		{
			role: "user",
			content: `
    Extract work history from OCR-extracted resume. Correct any OCR errors. Maintain original texts.
      ### Steps ###
      1. Mark the work history section.
      2. Read only the text from that section and extract. 
			3. Dates should be in YYYY-MM-DD format. If a month range is specified without exact dates, set startDate to the first day of the month and endDate to the last day of the month. (Jan 2021 -> 2021-01-01 to 2021-01-31)
    // Example 1 (current job started from January 2020)
    
    "title": "Software Engineer",
    "company": "Acme, Inc.",
    "Description": "Developed software.",
    "startDate": "2020-01-01",
    "endDate": "Present"
    
    // Example 2 (if the work history is freelancer or self-employed)
    
    "title": "Freelancer",
    "company": "",
    "Description": "Worked as a freelancer.",
    "startDate": "2020-01-01",
    "endDate": "2023-04-01"
    
   
    OCR-extracted resume: ###
    {resume}
    ###
    `,
		},
	],
	schema: parseWorkExperienceSchema,
};
