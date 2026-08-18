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

final class ModularGridExtension extends AbstractChatbotExtension {

	public static function getName(): string {
		return 'modulargridextension';
	}

	public function id(): string {
		return 'tables';
	}

	public function getLabel(): string {
		return 'Data tables (ModularGrid)';
	}

	public function getDescription(): string {
		return 'Renders safe searchable and pageable data tables from compact structured assistant output.';
	}

	public function getPriority(): int {
		return 107;
	}

	public function getRequirements(): array {
		return [
			'ClientStack Markdown renderer',
			'ClientStack ModularGrid library'
		];
	}

	public function getExamplePrompts(): array {
		return [
			'Present the project tasks with owner, status, priority, and due date as a searchable data table.',
			'Compare the following products by price, availability, rating, and delivery time in a sortable table.'
		];
	}

	public function getSystemPrompt(array $context): string {
		if (empty($context['use_markdown'])) {
			return 'Data-table rendering is unavailable because Markdown rendering is disabled. Do not emit base3-table blocks.';
		}

		return <<<'PROMPT'
An active ModularGrid data-table renderer is available in the chat. Users describe the desired table in natural language and are not expected to know its technical syntax.
If the user asks for a structured data table, sortable comparison table, searchable record list, result table, inventory, schedule, task list, or another row-and-column presentation, you MUST use the renderer when an interactive table is an appropriate answer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete table must use the exact fenced block identifier `base3-table`:
```base3-table
{"title":"Project tasks","columns":[{"key":"task","label":"Task"},{"key":"owner","label":"Owner"},{"key":"status","label":"Status"},{"key":"due_date","label":"Due date"}],"rows":[{"task":"Analysis","owner":"Anna","status":"Done","due_date":"2026-08-04"},{"task":"Implementation","owner":"Ben","status":"In progress","due_date":"2026-08-12"}],"search":true,"paging":true,"page_size":10}
```
The opening fence, the exact identifier `base3-table`, one JSON object, and the closing fence are mandatory.
Required properties are `columns` and `rows`. Optional properties are `title`, `search`, `paging`, and `page_size`.
`columns` must contain between 1 and 20 objects. Every column requires a unique technical `key` using letters, digits, and underscores, and a short plain-text `label`. The optional `sortable` property must be boolean.
`rows` must contain between 1 and 200 objects. Row properties must use only declared column keys. Missing cells are allowed and render empty. Cell values may only be plain text, finite numbers, booleans, or null.
`search` and `paging` are booleans. `page_size` may only be 5, 10, 20, or 50.
Do not include HTML, Markdown, JavaScript, callbacks, render functions, URLs, actions, plugins, Ajax configuration, nested objects, nested arrays, colors, CSS, or properties other than those documented above and `key`, `label`, plus `sortable` inside columns.
Use normal explanatory prose outside the block when useful. When the user explicitly requests an interactive table, do not replace it with an ordinary Markdown table.
Before finishing, verify that the JSON is valid, all column keys are unique, every row uses only declared keys, and every cell is a supported scalar value.
PROMPT;
	}

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return new AssistantResponseClientPlugin(
			'tables',
			$this->resolveVersionedAsset('plugin/ChatbotExtensions/assets/chatbot/ModularGridPlugin.js'),
			'ModularGridPlugin',
			[
				'moduleUrl' => $this->assetResolver->resolve(
					'plugin/ClientStack/assets/modulargrid/index.js'
				),
				'styleUrl' => $this->assetResolver->resolve(
					'plugin/ClientStack/assets/modulargrid/styles/modulargrid.css'
				),
				'strings' => array_merge($this->getClientStrings($context), [
					'renderError' => $this->getClientTranslation($context, 'client_grid_error', 'Table could not be rendered.'),
					'aria' => $this->getClientTranslation($context, 'client_grid_aria', 'Data table'),
					'search' => $this->getClientTranslation($context, 'client_grid_search', 'Search'),
					'searchPlaceholder' => $this->getClientTranslation($context, 'client_grid_search_placeholder', 'Search table'),
					'rowsPerPage' => $this->getClientTranslation($context, 'client_grid_rows_per_page', 'Rows per page'),
					'clear' => $this->getClientTranslation($context, 'client_grid_clear', 'Clear'),
					'previous' => $this->getClientTranslation($context, 'client_grid_previous', 'Prev'),
					'next' => $this->getClientTranslation($context, 'client_grid_next', 'Next'),
					'pageStatus' => $this->getClientTranslation($context, 'client_grid_page_status', 'Page {page} of {totalPages}'),
					'noRecords' => $this->getClientTranslation($context, 'client_grid_no_records', 'No records'),
					'recordsRange' => $this->getClientTranslation($context, 'client_grid_records_range', 'Records {from} to {to} of {total}'),
					'recordsRangeFiltered' => $this->getClientTranslation($context, 'client_grid_records_range_filtered', 'Records {from} to {to} of {filteredTotal} (filtered from {total})')
				])
			]
		);
	}
}
