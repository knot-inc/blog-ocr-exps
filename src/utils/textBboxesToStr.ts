import type { TextBbox, TextBboxesToStrMode } from "../types/bbox";

export const textBboxesToStr = (
	textBboxes: TextBbox[],
	mode: TextBboxesToStrMode = "json",
): string => {
	if (textBboxes.length === 0) return "";

	switch (mode) {
		case "json":
			return JSON.stringify(textBboxes);

		case "csv": {
			// CSV format: x0,y0,x1,y1,text
			const headers = "x0,y0,x1,y1,text";
			const rows = textBboxes.map(
				(textBbox) =>
					`${textBbox.bbox.x0},${textBbox.bbox.y0},${textBbox.bbox.x1},${textBbox.bbox.y1},"${textBbox.text.replace(/"/g, '""')}"`,
			);
			return [headers, ...rows].join("\n");
		}

		case "xml": {
			// XML format
			const xmlLines = textBboxes.map(
				(textBbox) =>
					`<line x0="${textBbox.bbox.x0}" y0="${textBbox.bbox.y0}" x1="${textBbox.bbox.x1}" y1="${textBbox.bbox.y1}">${textBbox.text.replace("\n", " ")}</line>`,
			);
			return xmlLines.join("\n");
		}

		case "ltwh": {
			// Left, Top, Width, Height format
			const ltwhLines = textBboxes.map((textBbox) => {
				const width = textBbox.bbox.x1 - textBbox.bbox.x0;
				const height = textBbox.bbox.y1 - textBbox.bbox.y0;
				const text = textBbox.text.replace("\n", " ");
				return `${text}, ltwh ${textBbox.bbox.x0} ${textBbox.bbox.y0} ${width} ${height}`;
			});
			return ltwhLines.join("\n");
		}

		case "lt": {
			const ltwhLines = textBboxes.map((textBbox) => {
				return `${textBbox.text.replace("\n", " ")}, left${textBbox.bbox.x0}top${textBbox.bbox.y0}`;
			});
			return ltwhLines.join("\n");
		}

		default:
			return JSON.stringify(textBboxes);
	}
};
