<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

if (!defined('DIR_PLUGIN')) {
	define('DIR_PLUGIN', dirname(__DIR__, 3) . DIRECTORY_SEPARATOR);
}

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\LeafletMapExtension;
use PHPUnit\Framework\TestCase;

final class LeafletMapExtensionTest extends TestCase {

	public function testExtensionProvidesRestrictedPromptAndClientPlugin(): void {
		$extension = new LeafletMapExtension(new LeafletMapExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);
		$plugin = $extension->getClientPlugin(['use_markdown' => true]);

		$this->assertSame('maps', $extension->id());
		$this->assertStringContainsString('```base3-map', $prompt);
		$this->assertStringContainsString('`street`, `satellite`, or `topographic`', $prompt);
		$this->assertStringContainsString('automatically determines the center and map bounds', $prompt);
		$this->assertStringContainsString('Do not include center, zoom, bounds', $prompt);
		$this->assertStringContainsString('optional `description` is short Markdown content', $prompt);
		$this->assertStringContainsString('Markdown is allowed only inside `description`', $prompt);
		$this->assertNotNull($plugin);
		$this->assertSame('maps', $plugin->getName());
		$this->assertSame('LeafletMapPlugin', $plugin->getExportName());
		$this->assertSame(
			'/resolved/plugin/ClientStack/assets/leaflet/leaflet.js',
			$plugin->getOptions()['scriptUrl'] ?? null
		);
		$this->assertSame(
			'/resolved/plugin/ClientStack/assets/leaflet/leaflet.css',
			$plugin->getOptions()['styleUrl'] ?? null
		);
	}

	public function testPromptDisablesMapsWhenMarkdownIsUnavailable(): void {
		$extension = new LeafletMapExtension(new LeafletMapExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => false]);

		$this->assertStringContainsString('Markdown rendering is disabled', $prompt);
		$this->assertStringContainsString('Do not emit base3-map blocks', $prompt);
	}
}

final class LeafletMapExtensionAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
