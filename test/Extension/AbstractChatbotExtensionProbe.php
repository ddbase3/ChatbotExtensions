<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

use AssistantFoundation\Dto\AssistantResponseClientPlugin;
use ChatbotExtensions\Extension\AbstractChatbotExtension;

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
