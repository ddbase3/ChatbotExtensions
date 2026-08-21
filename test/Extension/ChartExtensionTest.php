<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

if (!defined('DIR_PLUGIN')) {
	define('DIR_PLUGIN', dirname(__DIR__, 3) . DIRECTORY_SEPARATOR);
}

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\ChartExtension;
use PHPUnit\Framework\TestCase;

final class ChartExtensionTest extends TestCase {

	public function testExtensionProvidesRestrictedPromptAndClientPlugin(): void {
		$extension = new ChartExtension(new ChartExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);
		$plugin = $extension->getClientPlugin(['use_markdown' => true]);

		$this->assertSame('charts', $extension->id());
		$this->assertStringContainsString('```base3-chart', $prompt);
		$this->assertStringContainsString('Allowed chart types are `bar`, `line`, `pie`, and `doughnut`', $prompt);
		$this->assertStringContainsString('Do not include colors', $prompt);
		$this->assertStringContainsString('Keep `labels` and `datasets` at the top level', $prompt);
		$this->assertStringContainsString('native Chart.js `data`/`options` configuration objects', $prompt);
		$this->assertStringContainsString('all dataset lengths match the label count', $prompt);
		$this->assertNotNull($plugin);
		$this->assertSame('charts', $plugin->getName());
		$this->assertSame('ChartPlugin', $plugin->getExportName());
		$this->assertSame(
			'/resolved/plugin/ClientStack/assets/chart/chart.js',
			$plugin->getOptions()['scriptUrl'] ?? null
		);
	}

	public function testPromptDisablesChartsWhenMarkdownIsUnavailable(): void {
		$extension = new ChartExtension(new ChartExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => false]);

		$this->assertStringContainsString('Markdown rendering is disabled', $prompt);
		$this->assertStringContainsString('Do not emit base3-chart blocks', $prompt);
	}
}

final class ChartExtensionAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
