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


	/** @return array<string,string> */
	protected function getClientStrings(array $context): array {
		return [
			'renderError' => $this->getClientTranslation($context, 'client_render_error', 'Content could not be rendered.')
		];
	}

	protected function getClientTranslation(array $context, string $key, string $fallback): string {
		$language = strtolower(str_replace('_', '-', trim((string)($context['language'] ?? 'en'))));
		$language = explode('-', $language)[0] ?? 'en';
		if (!in_array($language, ['ar', 'bg', 'de', 'en', 'es', 'fr', 'hi', 'it', 'pl', 'pt', 'ru', 'zh'], true)) {
			$language = 'en';
		}

		$basePath = defined('DIR_PLUGIN') ? DIR_PLUGIN . 'ChatbotExtensions/lang/Administration/' : '';
		$files = $basePath === ''
			? []
			: array_values(array_unique([$basePath . $language . '.ini', $basePath . 'en.ini']));
		foreach ($files as $filename) {
			if (!is_file($filename) || !is_readable($filename)) {
				continue;
			}
			$data = parse_ini_file($filename, true);
			$section = is_array($data['chatbot_extensions_administration'] ?? null)
				? $data['chatbot_extensions_administration']
				: [];
			$value = $section[$key] ?? null;
			if (is_scalar($value) && trim((string)$value) !== '') {
				return trim((string)$value);
			}
		}

		return $fallback;
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
