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
use Base3\ChatbotExtensions\Extension\MermaidExtension;
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
		$this->assertStringContainsString('Keep node identifiers short, ASCII-only, and simple', $prompt);
		$this->assertStringContainsString('prefer quoted labels', $prompt);
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

require_once __DIR__ . '/MermaidExtensionAssetResolver.php';
