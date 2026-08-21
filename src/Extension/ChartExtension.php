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

use AssistantFoundation\Dto\AssistantResponseClientPlugin;

final class ChartExtension extends AbstractChatbotExtension {

	public static function getName(): string {
		return 'chartextension';
	}

	public function id(): string {
		return 'charts';
	}

	public function getLabel(): string {
		return 'Charts (Chart.js)';
	}

	public function getDescription(): string {
		return 'Renders safe bar, line, pie, and doughnut charts from compact structured assistant output.';
	}

	public function getPriority(): int {
		return 106;
	}

	public function getRequirements(): array {
		return [
			'ClientStack Markdown renderer',
			'ClientStack Chart.js library'
		];
	}

	public function getExamplePrompts(): array {
		return [
			'Visualize the quarterly revenue values 120000, 145000, 138000, and 171000 as a bar chart.',
			'Compare the monthly support requests for Product A and Product B as a line chart.'
		];
	}

	public function getSystemPrompt(array $context): string {
		if (empty($context['use_markdown'])) {
			return 'Chart rendering is unavailable because Markdown rendering is disabled. Do not emit base3-chart blocks.';
		}

		return <<<'PROMPT'
An active Chart.js renderer is available in the chat. Users describe the desired visualization in natural language and are not expected to know its technical syntax.
If the user asks for a bar chart, line chart, pie chart, doughnut chart, categorical comparison, trend chart, distribution chart, or an equivalent quantitative visualization supported by this renderer, you MUST use the renderer when a chart is an appropriate answer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete chart must use the exact fenced block identifier `base3-chart`:
```base3-chart
{"type":"bar","title":"Quarterly revenue","labels":["Q1","Q2","Q3","Q4"],"datasets":[{"label":"Revenue","data":[120000,145000,138000,171000]}],"x_label":"Quarter","y_label":"Revenue","begin_at_zero":true,"stacked":false}
```
The opening fence, the exact identifier `base3-chart`, one JSON object, and the closing fence are mandatory.
Allowed chart types are `bar`, `line`, `pie`, and `doughnut`.
Required properties are `type`, `labels`, and `datasets`. `title`, `x_label`, `y_label`, `begin_at_zero`, and `stacked` are optional. Keep `labels` and `datasets` at the top level of the JSON object.
`labels` must contain between 1 and 100 short plain-text labels. `datasets` must contain between 1 and 6 entries. Every dataset requires a short plain-text `label` and a numeric `data` array with exactly one finite number per label.
Pie and doughnut charts must use exactly one dataset. `stacked` is only meaningful for bar charts.
Do not include colors, HTML, Markdown, JavaScript, callbacks, plugins, URLs, nested code fences, or native Chart.js `data`/`options` configuration objects. Do not add properties other than those documented above and `label` plus `data` inside datasets.
Use normal explanatory prose outside the block when useful. When the user explicitly requests a supported chart, do not replace it with an ordinary Markdown table or a textual list of values.
Before finishing, verify that the JSON is valid, all dataset lengths match the label count, and all data values are finite numbers.
PROMPT;
	}

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return new AssistantResponseClientPlugin(
			'charts',
			$this->resolveVersionedAsset('plugin/ChatbotExtensions/assets/chatbot/ChartPlugin.js'),
			'ChartPlugin',
			[
				'scriptUrl' => $this->assetResolver->resolve(
					'plugin/ClientStack/assets/chart/chart.js'
				),
				'strings' => array_merge($this->getClientStrings($context), [
					'renderError' => $this->getClientTranslation($context, 'client_chart_error', 'Chart could not be rendered.'),
					'ariaTemplate' => $this->getClientTranslation($context, 'client_chart_aria', '{type} chart')
				])
			]
		);
	}
}
