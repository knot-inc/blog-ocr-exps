import { z } from "zod";

export interface Prompt<
	TInput extends Record<string, any>,
	TSchema extends z.ZodType<any, any>,
> {
	name: string;
	messages: {
		role: "system" | "user" | "assistant";
		content: string;
	}[];
	schema: TSchema;
}
