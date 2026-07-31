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

final class TimelineExtension extends AbstractStructuredContentExtension {

	public static function getName(): string {
		return 'timelineextension';
	}

	public function id(): string {
		return 'timeline';
	}

	public function getLabel(): string {
		return 'Timeline';
	}

	public function getDescription(): string {
		return 'Renders chronological milestones, project phases, and process steps.';
	}

	public function getPriority(): int {
		return 140;
	}

	public function getExamplePrompts(): array {
		return ['Turn the project phases discovery, prototype, pilot, and rollout into a concise timeline.'];
	}

	public function getSystemPrompt(array $context): string {
		return <<<'PROMPT'
An active timeline renderer is available in the chat. Users describe the desired presentation in natural language and are not expected to know its technical syntax.
If the user asks for a timeline, chronology, roadmap, milestone sequence, project phases, or any equivalent chronological presentation, you MUST use the renderer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete output must use the exact fenced block identifier `base3-timeline`:
```base3-timeline
{"items":[{"date":"Q1 2026","title":"Prototype","text":"Build and validate the first working version.","status":"completed"}]}
```
The opening fence, the exact identifier `base3-timeline`, the JSON object, and the closing fence are all mandatory.
`items` must contain between 1 and 12 entries. `title` is required. `date`, `text`, and `status` are optional plain text. Allowed status values are `completed`, `current`, `planned`, and `neutral`.
Preserve the intended order in the JSON array. Do not include HTML, Markdown, nested code fences, or additional properties.
When the user explicitly requests a timeline or roadmap, do not replace it with an ordinary list.
PROMPT;
	}

	protected function getClientExportName(): string {
		return 'TimelinePlugin';
	}
}
