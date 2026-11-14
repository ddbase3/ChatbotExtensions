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

use Base3\CoreFoundation\Api\IAssetResolver;
use Base3\ChatbotExtensions\Extension\ChartExtension;
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

require_once __DIR__ . '/ChartExtensionAssetResolver.php';
