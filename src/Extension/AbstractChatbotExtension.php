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

use AssistantFoundation\Api\IAssistantResponseExtension;
use AssistantFoundation\Api\IAssistantResponseExtensionExamples;
use Base3\Api\IAssetResolver;
use RuntimeException;

abstract class AbstractChatbotExtension implements IAssistantResponseExtension, IAssistantResponseExtensionExamples {

	public function __construct(protected readonly IAssetResolver $assetResolver) {}

	public function isEnabledByDefault(): bool {
		return false;
	}

	public function getRequirements(): array {
		return [];
	}

	public function getClientPluginOptions(array $context): array {
		return [];
	}

	protected function resolveVersionedAsset(string $logicalPath): string {
		$url = $this->assetResolver->resolve($logicalPath);
		$prefix = 'plugin/ChatbotExtensions/';
		if (!str_starts_with($logicalPath, $prefix)) {
			return $url;
		}

		$file = DIR_PLUGIN . 'ChatbotExtensions/' . substr($logicalPath, strlen($prefix));
		if (!is_file($file)) {
			throw new RuntimeException('Chatbot extension asset is missing: ' . $file);
		}

		$hash = hash_file('sha256', $file);
		if (!is_string($hash) || $hash === '') {
			throw new RuntimeException('Chatbot extension asset could not be hashed: ' . $file);
		}

		return $url . (str_contains($url, '?') ? '&' : '?') . 'v=' . substr($hash, 0, 12);
	}
}
