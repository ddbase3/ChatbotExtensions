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

final class ProgressExtension extends AbstractStructuredContentExtension {

	public static function getName(): string {
		return 'progressextension';
	}

	public function id(): string {
		return 'progress';
	}

	public function getLabel(): string {
		return 'Progress indicators';
	}

	public function getDescription(): string {
		return 'Visualizes one or more bounded progress values without an external library.';
	}

	public function getPriority(): int {
		return 130;
	}

	public function getExamplePrompts(): array {
		return ['Show the completion of Analysis 80%, Implementation 55%, and Testing 25% as progress indicators.'];
	}

	protected function getStructuredSystemPrompt(array $context): string {
		return <<<'PROMPT'
An active progress-indicator renderer is available in the chat. Users describe the desired presentation in natural language and are not expected to know its technical syntax.
If the user asks for progress bars, progress indicators, completion bars, status bars, or any equivalent bounded progress visualization, you MUST use the renderer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete output must use the exact fenced block identifier `base3-progress`:
```base3-progress
{"items":[{"label":"Implementation","value":55,"max":100,"text":"55% complete"}]}
```
The opening fence, the exact identifier `base3-progress`, the JSON object, and the closing fence are all mandatory.
`items` must contain between 1 and 8 entries. `label`, numeric `value`, and numeric `max` are required. `max` must be greater than zero and `value` must be between zero and `max`. `text` is optional plain text.
Do not include HTML, Markdown, nested code fences, or additional properties inside the JSON.
When the user explicitly requests a progress visualization, do not replace it with ordinary percentages in prose.
PROMPT;
	}

	protected function getBlockIdentifier(): string {
		return 'base3-progress';
	}

	protected function getClientExportName(): string {
		return 'ProgressPlugin';
	}
}
