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

final class CalloutExtension extends AbstractStructuredContentExtension {

	public static function getName(): string {
		return 'calloutextension';
	}

	public function id(): string {
		return 'callouts';
	}

	public function getLabel(): string {
		return 'Callouts and notices';
	}

	public function getDescription(): string {
		return 'Renders structured information, success, warning, and error notices.';
	}

	public function getPriority(): int {
		return 110;
	}

	public function getExamplePrompts(): array {
		return ['Summarize the key result and show the most important warning as a callout.'];
	}

	public function getSystemPrompt(array $context): string {
		return <<<'PROMPT'
An active callout renderer is available in the chat. Users describe the desired presentation in natural language and are not expected to know its technical syntax.
If the user asks for a warning box, notice, alert, information box, success box, error box, callout, or any equivalent presentation, you MUST use the renderer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete output must use the exact fenced block identifier `base3-callout`:
```base3-callout
{"type":"info","title":"Optional title","text":"Plain text content"}
```
The opening fence, the exact identifier `base3-callout`, the JSON object, and the closing fence are all mandatory.
Allowed types are `info`, `success`, `warning`, and `error`.
Keep `title` and `text` as plain text. Do not include HTML, Markdown, nested code fences, or additional properties inside the JSON.
Use normal prose outside the block when useful. When the user explicitly requests this presentation, do not replace it with ordinary prose.
PROMPT;
	}

	protected function getClientExportName(): string {
		return 'CalloutPlugin';
	}
}
