import type { Prompt } from "../types/prompt";
import { z } from "zod";

export const parseWorkExperienceSchema = z.object({
	workExperiences: z.array(
		z.object({
			title: z.string().nullable(),
			company: z.string().nullable().describe("Company name only"),
			description: z.string().nullable(),
			startDate: z.string().nullable(),
			endDate: z.string().nullable(),
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
			content: `Extract work history from resume. Correct any OCR errors. **Maintain original texts**
Detect full text in Description
If there are skills or company descriptions in the content of **each work experience**, please extract them as well in the Description field. Do not include any other secction texts.
Dates should be in YYYY-MM-DD format; set startDate to the earliest possible date in the range and endDate to the latest possible date in the range (Jan 2021 → 2021-01-01 to 2021-01-31, 2001 - 2002 → 2001-01-01 to 2002-12-31).
If no work experiences are found, return an empty array for workExperiences.

// Example 1
{{title="Software Engineer", company="Acme, Inc.", Description="Developed software.", startDate="2020-01-01", endDate="Present"}}
// Example 2
{{title="Designer", company="", Description="Worked as a designer.", startDate="2020-01-01", endDate="2023-04-31"}}
// Example 3 (no work experiences found)
{{}}

OCR extracted resume ###
{resume}
###`,
		},
	],
	schema: parseWorkExperienceSchema,
};
