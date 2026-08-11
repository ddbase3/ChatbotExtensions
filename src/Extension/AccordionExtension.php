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

final class AccordionExtension extends AbstractStructuredContentExtension {

	public static function getName(): string {
		return 'accordionextension';
	}

	public function id(): string {
		return 'accordions';
	}

	public function getLabel(): string {
		return 'Accordions and details';
	}

	public function getDescription(): string {
		return 'Groups longer explanations into accessible expandable sections.';
	}

	public function getPriority(): int {
		return 150;
	}

	public function getExamplePrompts(): array {
		return ['Explain installation, configuration, and troubleshooting in separate expandable sections.'];
	}

	protected function getStructuredSystemPrompt(array $context): string {
		return <<<'PROMPT'
An active accordion renderer is available in the chat. Users describe the desired presentation in natural language and are not expected to know its technical syntax.
If the user asks for accordions, expandable sections, collapsible details, grouped detail areas, or any equivalent presentation, you MUST use the renderer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete output must use the exact fenced block identifier `base3-accordion`:
```base3-accordion
{"items":[{"title":"Installation","markdown":"Use **PHP 8.2** or newer.\n\n- Copy the plugin files\n- Run setup\n- Clear the browser cache","open":true}]}
```
The opening fence, the exact identifier `base3-accordion`, the JSON object, and the closing fence are all mandatory.
`items` must contain between 1 and 10 entries. Every entry requires a plain-text `title` and a `markdown` string; `open` is an optional boolean.
Use Markdown inside `markdown` for paragraphs, emphasis, links, inline code, headings, ordered lists, and unordered lists. Encode line breaks inside the JSON string with `\n`.
Do not include HTML or fenced `base3-*` extension blocks inside `markdown`. Specialized renderer blocks must remain separate top-level blocks outside the accordion.
Do not add properties other than `title`, `markdown`, and `open`.
When the user explicitly requests expandable sections, do not replace them with ordinary headings or lists.
PROMPT;
	}

	protected function getBlockIdentifier(): string {
		return 'base3-accordion';
	}

	protected function getClientExportName(): string {
		return 'AccordionPlugin';
	}
}
