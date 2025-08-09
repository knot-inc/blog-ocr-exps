import dotenv from "dotenv";
import type { z } from "zod";
import type { Prompt } from "../types/prompt";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions/completions";

dotenv.config();

export class OpenAIWrapper {
	private client: OpenAI;

	constructor(apiKey?: string) {
		const key = apiKey || process.env.OPENAI_API_KEY || "";
		if (!key) console.warn("OpenAI API key not provided");
		this.client = new OpenAI({ apiKey: key });
	}

	async completion<
		TParams extends Record<string, unknown>,
		TSchema extends z.ZodType,
	>({
		prompt,
		variables,
		imageUrls = [],
		detail = "high",
		...openaiArgs
	}: {
		prompt: Prompt<TParams, TSchema>;
		variables: TParams;
		imageUrls?: string[];
		detail?: "low" | "high" | "auto";
	} & Partial<
		Omit<
			ChatCompletionCreateParamsNonStreaming,
			"messages" | "response_format" | "stream"
		>
	>): Promise<z.infer<TSchema>> {
		try {
			if (!this.client.apiKey) throw new Error("OpenAI API key not found");

			// Process messages with variables
			const messages = prompt.messages.map((message) => {
				if (typeof message.content === "string") {
					let content = message.content;
					for (const [key, value] of Object.entries(variables)) {
						content = content.replace(`{${key}}`, String(value));
					}

					// Handle images in the last user message
					if (
						message.role === "user" &&
						imageUrls.length > 0 &&
						prompt.messages[prompt.messages.length - 1].role === message.role
					) {
						return {
							role: message.role,
							content: [
								{ type: "text" as const, text: content },
								...imageUrls.map((url) => ({
									type: "image_url" as const,
									image_url: { url, detail: detail },
								})),
							],
						};
					}
					return { ...message, content };
				}
				return message;
			});

			// Set default OpenAI arguments
			const defaultOpenAIArgs: Partial<ChatCompletionCreateParamsNonStreaming> =
				{
					model: "gpt-4.1-nano",
					temperature: 0.02,
					seed: 42,
				};

			const options = {
				...defaultOpenAIArgs,
				...openaiArgs,
				model: openaiArgs.model ?? defaultOpenAIArgs.model ?? "gpt-4.1-nano",
				response_format: zodResponseFormat(prompt.schema, "response"),
				messages,
			};
			console.log("openaiArgs:", JSON.stringify(options, null, 2));

			// Use the OpenAI SDK to make the request with structured outputs
			const response = await this.client.chat.completions.parse({
				...defaultOpenAIArgs,
				...openaiArgs,
				model: openaiArgs.model ?? defaultOpenAIArgs.model ?? "gpt-4.1-nano",
				response_format: zodResponseFormat(prompt.schema, "response"),
				messages,
			});

			console.log("usage:", JSON.stringify(response.usage, null, 2));

			// Handle refusals
			if (response.choices[0].message.refusal) {
				throw new Error(
					`Model refused: ${response.choices[0].message.refusal}`,
				);
			}

			// Return the parsed response
			return response.choices[0].message.parsed as z.infer<TSchema>;
		} catch (error) {
			console.error("Request failed:", error);
			throw error;
		}
	}
}
