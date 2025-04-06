export interface BBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface TextBbox {
	bbox: BBox;
	text: string;
}

export type TextBboxesToStrMode = "json" | "csv" | "xml" | "ltwh" | "lt";
