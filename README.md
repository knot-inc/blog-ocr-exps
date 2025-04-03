# Work Experience Extractor

A tool for extracting work experience data from resume images using different OCR processors and evaluating their accuracy.

## Overview

This project extracts work experience information from resume images using various OCR (Optical Character Recognition) processors and NLP techniques. It provides tools to evaluate accuracy by comparing extracted data with manually labeled ground truth.

## Features

- Multiple OCR processors including:
  - Direct image processing with GPT-4o
  - Tesseract OCR (with and without bounding boxes)
  - AWS Textract (with and without bounding boxes)
  - Mistral OCR
- Command-line interface for easy processing of data
- Evaluation tools to compare extraction accuracy against ground truth
- Visualization of results via an HTML dashboard

## Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables in a `.env` file:

```
OPENAI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
MISTRAL_API_KEY=
```

4. Build the project:

```bash
pnpm run build
```

## Usage

### Process images and save ground truth data

```bash
pnpm start -- save-gt -d ./path/to/data/folder
```

### Process data with multiple OCR processors

```bash
pnpm start -- save-reports -d ./path/to/data/folder -o ./output/folder
```

You can specify which processors to use:

```bash
pnpm start -- save-reports -d ./path/to/data/folder -o ./output/folder -p processImage,tesseractOcr
```

### Generate visualization config

```bash
pnpm start -- save-config
```

## Visualization

The project includes an HTML dashboard to visualize comparison results. After generating reports and config, open the `assets/index.html` file in a browser to see a detailed analysis of each processor's performance.

The visualization dashboard provides:

1. Overall performance summary across all processors and datasets
2. Category-specific summaries for each dataset (samples, freepiks)
3. Field-type performance breakdown (Title, Company, Start Date, End Date, Description)
4. Detailed item-by-item comparison with highlighted differences between extracted data and ground truth
5. Color-coded match rates for easy identification of strengths and weaknesses

## Field Matching

The system evaluates extraction accuracy by comparing the following fields:

- Title
- Company
- Start Date
- End Date
- Description

It calculates similarity scores using various metrics including character-level, word-level, and n-gram-based Jaccard similarity.

## Development

Basic commands:
```bash
pnpm run dev           # Run the main CLI with ts-node
pnpm run lint          # Run linter
pnpm run format        # Format code
pnpm run check         # Check and fix code issues
```

## Requirements

- Node.js 22+
- pnpm 10.7.1+
- TypeScript
- OpenAI API access
- AWS Textract access (for Textract processors)
- Mistral API access (for Mistral OCR processor)

## Technologies

- **Runtime**: Node.js 22
- **Package Manager**: pnpm 10.7.1
- **Core Libraries**:
  - `commander`: Command-line interface
  - `openai`: OpenAI API client
  - `@aws-sdk/client-textract`: AWS Textract client
  - `@mistralai/mistralai`: Mistral AI client
  - `tesseract.js`: OCR engine
  - `zod`: Schema validation
- **Development Tools**:
  - `typescript`: Type checking
  - `ts-node`: Running TypeScript directly
  - `@biomejs/biome`: Linting and formatting
