import type { z } from "zod";

export interface Prompt<
	TInput extends Record<string, unknown>,
	TSchema extends z.ZodType<unknown, z.ZodTypeDef>,
> {
	name: string;
	messages: {
		role: "system" | "user" | "assistant";
		content: string;
	}[];
	schema: TSchema;
}
