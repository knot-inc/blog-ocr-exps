import type { z } from "zod";

export interface Prompt<
	_TInput extends Record<string, unknown>,
	TSchema extends z.ZodType,
> {
	name: string;
	messages: {
		role: "system" | "user" | "assistant";
		content: string;
	}[];
	schema: TSchema;
}
