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

final class RedirectExtension extends AbstractChatbotExtension {

	public static function getName(): string {
		return 'redirectextension';
	}

	public function id(): string {
		return 'redirect';
	}

	public function getLabel(): string {
		return 'Portal navigation';
	}

	public function getDescription(): string {
		return 'Navigates the current browser tab to a same-origin platform URL explicitly requested by the user and keeps a reusable labeled link in the conversation.';
	}

	public function getPriority(): int {
		return 170;
	}

	public function getRequirements(): array {
		return ['ClientStack Markdown renderer'];
	}

	public function getExamplePrompts(): array {
		return ['Take me to the project dashboard at /projects/dashboard.'];
	}

	public function getSystemPrompt(array $context): string {
		if (empty($context['use_markdown'])) {
			return 'Portal navigation is unavailable because Markdown rendering is disabled. Do not emit base3-redirect blocks.';
		}

		return <<<'PROMPT'
An active portal-navigation extension is available in the chat. Users ask for navigation in natural language and are not expected to know its technical syntax.
Use this extension only when the user explicitly asks to open, visit, go to, navigate to, or otherwise switch the current portal page and you know the correct internal platform URL. Never navigate proactively merely because a related page exists.
The complete navigation command must use the exact fenced block identifier `base3-redirect`:
```base3-redirect
{"url":"/projects/dashboard","label":"Project dashboard"}
```
The opening fence, the exact identifier `base3-redirect`, one JSON object, and the closing fence are mandatory.
The JSON object must contain exactly two properties named `url` and `label`. `url` must be a non-empty relative URL or an absolute URL on the same origin as the current portal page. `label` must be a short, meaningful plain-text name for the destination that remains useful when the conversation is shown again later.
The browser renders the command as a normal clickable link. For a freshly completed assistant response, it additionally performs the requested navigation once. When an existing conversation is restored or displayed again, it only shows the link and never automatically navigates.
Do not use external origins, protocol-relative external URLs, `javascript:`, `data:`, `mailto:`, HTML, Markdown links, JavaScript, callbacks, nested code fences, or additional properties.
The browser performs the redirect with fixed extension code; never generate executable JavaScript for navigation.
Do not emit a redirect block when the user only asks where a page is, asks for a link without requesting navigation, or when the correct internal URL is uncertain.
PROMPT;
	}

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return new AssistantResponseClientPlugin(
			'redirect',
			$this->resolveVersionedAsset('plugin/ChatbotExtensions/assets/chatbot/RedirectPlugin.js'),
			'RedirectPlugin'
		);
	}
}
