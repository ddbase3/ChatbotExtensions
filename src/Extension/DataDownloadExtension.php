<?php declare(strict_types=1);

/***********************************************************************
 * This file is part of ChatbotExtensions for BASE3 Framework.
 *
 * ChatbotExtensions provides optional assistant response renderers for
 * the modular Chatbot client.
 *
 * Developed by Daniel Dahme
 * Licensed under GPL-3.0
 * https://www.gnu.org/licenses/gpl-3.0.en.html
 **********************************************************************/

namespace ChatbotExtensions\Extension;

final class DataDownloadExtension extends AbstractStructuredContentExtension {

	public static function getName(): string {
		return 'datadownloadextension';
	}

	public function id(): string {
		return 'data-downloads';
	}

	public function getLabel(): string {
		return 'CSV and JSON downloads';
	}

	public function getDescription(): string {
		return 'Creates a local download from data already contained in the assistant response.';
	}

	public function getPriority(): int {
		return 160;
	}

	public function getExamplePrompts(): array {
		return ['Create a downloadable CSV file with the columns name, status, and due_date from the following tasks.'];
	}

	protected function getStructuredSystemPrompt(array $context): string {
		return <<<'PROMPT'
An active local data-download renderer is available in the chat. Users describe the desired result in natural language and are not expected to know its technical syntax.
If the user asks for a downloadable CSV file, downloadable JSON file, export, or download button for generated data, you MUST use the renderer. Never return the payload as bare JSON and never place it in a generic `json` code block.
For CSV, the complete output must use the exact fenced block identifier `base3-download`:
```base3-download
{"filename":"tasks.csv","format":"csv","content":"name,status,due_date\nAnalysis,done,2026-08-01"}
```
For JSON, use the same exact fenced block identifier:
```base3-download
{"filename":"tasks.json","format":"json","content":[{"name":"Analysis","status":"done","due_date":"2026-08-01"}]}
```
The opening fence, the exact identifier `base3-download`, the JSON object, and the closing fence are all mandatory.
Allowed formats are `csv` and `json`. `filename`, `format`, and `content` are required. CSV content must be a complete UTF-8 text document. JSON content may be an object, array, string, number, boolean, or null.
The browser creates the file locally from this payload. Do not include remote URLs, HTML, JavaScript, Markdown, nested code fences, or additional properties.
When the user explicitly requests a downloadable file, do not replace it with a normal code block or plain-text data.
PROMPT;
	}

	protected function getBlockIdentifier(): string {
		return 'base3-download';
	}

	protected function getClientExportName(): string {
		return 'DataDownloadPlugin';
	}
}
