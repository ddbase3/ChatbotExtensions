<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

if (!defined('DIR_PLUGIN')) {
	define('DIR_PLUGIN', dirname(__DIR__, 3) . DIRECTORY_SEPARATOR);
}

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\ModularGridExtension;
use PHPUnit\Framework\TestCase;

final class ModularGridExtensionTest extends TestCase {

	public function testExtensionProvidesRestrictedPromptAndClientPlugin(): void {
		$extension = new ModularGridExtension(new ModularGridExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);
		$plugin = $extension->getClientPlugin(['use_markdown' => true]);

		$this->assertSame('tables', $extension->id());
		$this->assertStringContainsString('```base3-table', $prompt);
		$this->assertStringContainsString('between 1 and 20 objects', $prompt);
		$this->assertStringContainsString('plain text, finite numbers, booleans, or null', $prompt);
		$this->assertStringContainsString('Do not include HTML', $prompt);
		$this->assertNotNull($plugin);
		$this->assertSame('tables', $plugin->getName());
		$this->assertSame('ModularGridPlugin', $plugin->getExportName());
		$this->assertSame(
			'/resolved/plugin/ClientStack/assets/modulargrid/index.js',
			$plugin->getOptions()['moduleUrl'] ?? null
		);
		$this->assertSame(
			'/resolved/plugin/ClientStack/assets/modulargrid/styles/modulargrid.css',
			$plugin->getOptions()['styleUrl'] ?? null
		);
	}

	public function testPromptDisablesTablesWhenMarkdownIsUnavailable(): void {
		$extension = new ModularGridExtension(new ModularGridExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => false]);

		$this->assertStringContainsString('Markdown rendering is disabled', $prompt);
		$this->assertStringContainsString('Do not emit base3-table blocks', $prompt);
	}
}

final class ModularGridExtensionAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
