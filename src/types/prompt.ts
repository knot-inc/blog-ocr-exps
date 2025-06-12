import type { z } from "zod/v4";

export interface Prompt<
	TInput extends Record<string, unknown>,
	TSchema extends z.ZodType<unknown>,
> {
	name: string;
	messages: {
		role: "system" | "user" | "assistant";
		content: string;
	}[];
	schema: TSchema;
}
