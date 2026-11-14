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
use Base3\ChatbotExtensions\Extension\LeafletMapExtension;
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

require_once __DIR__ . '/LeafletMapExtensionAssetResolver.php';
