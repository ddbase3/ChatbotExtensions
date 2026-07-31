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

final class KpiCardsExtension extends AbstractStructuredContentExtension {

	public static function getName(): string {
		return 'kpicardsextension';
	}

	public function id(): string {
		return 'kpi-cards';
	}

	public function getLabel(): string {
		return 'KPI cards';
	}

	public function getDescription(): string {
		return 'Displays compact cards for key figures, changes, and short explanations.';
	}

	public function getPriority(): int {
		return 120;
	}

	public function getExamplePrompts(): array {
		return ['Present these reporting figures as KPI cards: 1,240 users, 68% completion, and 4.7/5 satisfaction.'];
	}

	public function getSystemPrompt(array $context): string {
		return <<<'PROMPT'
An active KPI-card renderer is available in the chat. Users describe the desired presentation in natural language and are not expected to know its technical syntax.
If the user asks for KPI cards, metric cards, key-figure tiles, dashboard figures, or any equivalent card presentation, you MUST use the renderer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete output must use the exact fenced block identifier `base3-kpi`:
```base3-kpi
{"items":[{"label":"Active users","value":"1,240","change":"+8%","detail":"Compared with last month"}]}
```
The opening fence, the exact identifier `base3-kpi`, the JSON object, and the closing fence are all mandatory.
`items` must contain between 1 and 6 entries. Every entry requires `label` and `value`; `change` and `detail` are optional plain text.
Do not include HTML, Markdown, nested code fences, or additional properties inside the JSON.
When the user explicitly requests cards or tiles, do not replace them with a Markdown table or ordinary list.
PROMPT;
	}

	protected function getClientExportName(): string {
		return 'KpiCardsPlugin';
	}
}
