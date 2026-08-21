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

final class MermaidExtension extends AbstractChatbotExtension {

	public static function getName(): string {
		return 'mermaidextension';
	}

	public function id(): string {
		return 'mermaid';
	}

	public function getLabel(): string {
		return 'Diagrams (Mermaid)';
	}

	public function getDescription(): string {
		return 'Lets the assistant generate Mermaid diagrams and renders completed or restored assistant messages.';
	}

	public function getPriority(): int {
		return 105;
	}

	public function getRequirements(): array {
		return [
			'ClientStack Markdown renderer',
			'ClientStack Mermaid library'
		];
	}

	public function getExamplePrompts(): array {
		return [
			'Create a Mermaid flowchart for a request that is reviewed, approved, implemented, and finally tested.',
			'Show the login process between user, client, authentication server, and resource server as a Mermaid sequence diagram.'
		];
	}

	public function getSystemPrompt(array $context): string {
		if (empty($context['use_markdown'])) {
			return 'Mermaid rendering is unavailable because Markdown rendering is disabled. Do not emit Mermaid code blocks.';
		}

		return <<<'PROMPT'
An active Mermaid renderer is available in the chat. Users describe the desired diagram in natural language and are not expected to know Mermaid syntax.
If the user asks for a diagram, flowchart, sequence diagram, state diagram, class diagram, entity relationship diagram, journey, Gantt chart, mind map, timeline, quadrant chart, Sankey diagram, XY chart, or another presentation supported by Mermaid, you MUST use the renderer when a diagram is an appropriate answer.
The complete diagram source must use the exact fenced block identifier `mermaid`:
```mermaid
flowchart TD
    A[Request] --> B{Approved?}
    B -->|Yes| C[Implement]
    B -->|No| D[Revise]
```
The opening fence, the exact identifier `mermaid`, valid Mermaid source, and the closing fence are mandatory.
Write raw Mermaid syntax inside the block. Do not wrap the source in JSON, HTML, quotes, or another nested code fence.
Preserve real line breaks between Mermaid statements. Do not collapse the diagram onto one line.
Use a Mermaid diagram type that matches the requested content. Keep node identifiers short, ASCII-only, and simple. Put human-readable text in labels instead of using it as a node identifier.
For flowchart labels containing spaces, punctuation, parentheses, colons, slashes, or other syntax-sensitive characters, prefer quoted labels such as `A["Review (required)"]`. Do not put Markdown formatting or nested code fences inside Mermaid labels.
Keep one Mermaid statement per line where the diagram type allows it. Prefer simple syntax over advanced Mermaid features when both express the same diagram.
Return one separate `mermaid` block per diagram. Normal explanatory prose may appear before or after the block when useful.
Before finishing, verify that every diagram is syntactically complete and contains no Markdown outside the outer fence.
PROMPT;
	}

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return new AssistantResponseClientPlugin(
			'mermaid',
			$this->resolveVersionedAsset('plugin/ChatbotExtensions/assets/chatbot/MermaidPlugin.js'),
			'MermaidPlugin',
			[
				'scriptUrl' => $this->assetResolver->resolve(
					'plugin/ClientStack/assets/mermaid/mermaid.min.js'
				),
				'strings' => array_merge($this->getClientStrings($context), [
					'renderError' => $this->getClientTranslation($context, 'client_mermaid_error', 'Diagram could not be rendered.'),
					'aria' => $this->getClientTranslation($context, 'client_mermaid_aria', 'Mermaid diagram'),
					'loading' => $this->getClientTranslation($context, 'client_mermaid_loading', 'Content is being created...')
				])
			]
		);
	}
}
