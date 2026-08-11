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

	protected function getStructuredSystemPrompt(array $context): string {
		return <<<'PROMPT'
An active callout renderer is available in the chat. Users describe the desired presentation in natural language and are not expected to know its technical syntax.
If the user asks for a warning box, notice, alert, information box, success box, error box, callout, or any equivalent presentation, you MUST use the renderer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete output must use the exact fenced block identifier `base3-callout`:
```base3-callout
{"type":"info","title":"Optional title","text":"Use **Markdown** for the content.\n\n- First point\n- Second point"}
```
The opening fence, the exact identifier `base3-callout`, the JSON object, and the closing fence are all mandatory.
Allowed types are `info`, `success`, `warning`, and `error`.
`title` must remain plain text. `text` is Markdown content and may use paragraphs, emphasis, links, inline code, headings, ordered lists, and unordered lists. Encode line breaks inside the JSON string with `\n`.
Do not include HTML or fenced `base3-*` extension blocks inside `text`. Do not add properties other than `type`, `title`, and `text`.
Use normal prose outside the block when useful. When the user explicitly requests this presentation, do not replace it with ordinary prose.
PROMPT;
	}

	protected function getBlockIdentifier(): string {
		return 'base3-callout';
	}

	protected function getClientExportName(): string {
		return 'CalloutPlugin';
	}
}
