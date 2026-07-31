<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

if (!defined('DIR_PLUGIN')) {
	define('DIR_PLUGIN', dirname(__DIR__, 3) . DIRECTORY_SEPARATOR);
}

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\MermaidExtension;
use PHPUnit\Framework\TestCase;

final class MermaidExtensionTest extends TestCase {

	public function testExtensionProvidesPromptAndClientPlugin(): void {
		$extension = new MermaidExtension(new MermaidExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);
		$plugin = $extension->getClientPlugin(['use_markdown' => true]);

		$this->assertSame('mermaid', $extension->id());
		$this->assertStringContainsString('```mermaid', $prompt);
		$this->assertStringContainsString('Write raw Mermaid syntax', $prompt);
		$this->assertStringContainsString('Do not wrap the source in JSON', $prompt);
		$this->assertNotNull($plugin);
		$this->assertSame('mermaid', $plugin->getName());
		$this->assertSame('MermaidPlugin', $plugin->getExportName());
		$this->assertSame(
			'/resolved/plugin/ClientStack/assets/mermaid/mermaid.min.js',
			$plugin->getOptions()['scriptUrl'] ?? null
		);
	}

	public function testPromptDisablesMermaidWhenMarkdownIsUnavailable(): void {
		$extension = new MermaidExtension(new MermaidExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => false]);

		$this->assertStringContainsString('Markdown rendering is disabled', $prompt);
		$this->assertStringContainsString('Do not emit Mermaid code blocks', $prompt);
	}
}

final class MermaidExtensionAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
