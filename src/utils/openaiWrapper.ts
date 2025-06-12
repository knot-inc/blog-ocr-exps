import dotenv from "dotenv";
import type { z } from "zod/v4";
import type { Prompt } from "../types/prompt";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

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
		modelName = "gpt-4.1",
		temperature = 0.0,
		variables,
		imageUrls = [],
		detail = "high",
	}: {
		prompt: Prompt<TParams, TSchema>;
		modelName?: string;
		temperature?: number;
		variables: TParams;
		imageUrls?: string[];
		detail?: "low" | "high" | "auto";
	}): Promise<z.infer<TSchema>> {
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

			// Use the OpenAI SDK to make the request with structured outputs
			const response = await this.client.beta.chat.completions.parse({
				model: modelName,
				messages,
				temperature,
				response_format: zodResponseFormat(prompt.schema, "response"),
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

	async completionWithPrediction<
		TParams extends Record<string, unknown>,
		TSchema extends z.ZodType,
	>({
		prompt,
		modelName = "gpt-4o",
		temperature = 0.0,
		variables,
	}: {
		prompt: Prompt<TParams, TSchema>;
		modelName?: string;
		temperature?: number;
		variables: TParams;
	}): Promise<string> {
		try {
			if (!this.client.apiKey) throw new Error("OpenAI API key not found");

			const prediction = this.schemaToString(prompt.schema.parse(variables));
			console.log("Using prediction:", JSON.stringify(prediction, null, 2));
			const response = await this.client.chat.completions.create({
				model: modelName,
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
				temperature,
				prediction: {
					type: "content",
					content: prediction,
				},
			});

			console.log("usage:", JSON.stringify(response.usage, null, 2));
			console.log(
				"accepted prediction tokens:",
				response.usage?.completion_tokens_details?.accepted_prediction_tokens,
			);
			console.log(
				"rejected prediction tokens:",
				response.usage?.completion_tokens_details?.rejected_prediction_tokens,
			);

			const fullContent = response.choices[0].message.content || "";
			const parsed = this.stringToSchema(fullContent, prompt.schema);

			return parsed;
		} catch (error) {
			console.error("Request failed:", error);
			throw error;
		}
	}

	private stringToSchema<T>(input: string, schema: z.ZodType<T>): T {
		try {
			const parsed = JSON.parse(input);
			return schema.parse(parsed);
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(`Schema validation failed: ${error.message}`);
			}
			throw new Error(`Invalid JSON: ${error}`);
		}
	}

	private schemaToString<T>(data: T): string {
		return JSON.stringify(data, null, 2);
	}
}
