<?php declare(strict_types=1);

/***********************************************************************
 * This file is part of ChatbotExtensions for BASE3 Framework.
 *
 * ChatbotExtensions provides optional response renderers for BASE3.
 * It extends the modular Chatbot client with additional output formats.
 * The extensions reuse existing Chatbot and runtime service contracts.
 *
 * Developed by Daniel Dahme
 * Licensed under GPL-3.0
 * https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * https://base3.de
 * https://github.com/ddbase3/ChatbotExtensions
 **********************************************************************/

namespace Base3\ChatbotExtensions\Test\Extension;

use Base3\AssistantFoundation\Dto\AssistantResponseClientPlugin;
use Base3\ChatbotExtensions\Extension\AbstractChatbotExtension;

final class AbstractChatbotExtensionProbe extends AbstractChatbotExtension {

	public static function getName(): string {
		return 'abstractchatbotextensionprobe';
	}

	public function id(): string {
		return 'probe';
	}

	public function getLabel(): string {
		return 'Test probe';
	}

	public function getDescription(): string {
		return 'Exercises protected extension asset and translation behavior.';
	}

	public function getPriority(): int {
		return 1;
	}

	public function getExamplePrompts(): array {
		return [];
	}

	public function getSystemPrompt(array $context): string {
		return '';
	}

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return null;
	}

	public function assetUrl(string $logicalPath): string {
		return $this->resolveVersionedAsset($logicalPath);
	}

	public function translation(array $context, string $key, string $fallback): string {
		return $this->getClientTranslation($context, $key, $fallback);
	}

	public function clientStrings(array $context): array {
		return $this->getClientStrings($context);
	}
}
