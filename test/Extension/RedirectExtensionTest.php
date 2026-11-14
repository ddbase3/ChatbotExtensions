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
use Base3\ChatbotExtensions\Extension\RedirectExtension;
use PHPUnit\Framework\TestCase;

final class RedirectExtensionTest extends TestCase {

	public function testExtensionProvidesRestrictedPromptAndClientPlugin(): void {
		$extension = new RedirectExtension(new RedirectExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);
		$plugin = $extension->getClientPlugin(['use_markdown' => true]);

		$this->assertSame('redirect', $extension->id());
		$this->assertStringContainsString('```base3-redirect', $prompt);
		$this->assertStringContainsString('"label":"Project dashboard"', $prompt);
		$this->assertStringContainsString('exactly two properties named `url` and `label`', $prompt);
		$this->assertStringContainsString('only when the user explicitly asks', $prompt);
		$this->assertStringContainsString('same origin', $prompt);
		$this->assertStringContainsString('only shows the link and never automatically navigates', $prompt);
		$this->assertStringContainsString('never generate executable JavaScript', $prompt);
		$this->assertNotNull($plugin);
		$this->assertSame('redirect', $plugin->getName());
		$this->assertSame('RedirectPlugin', $plugin->getExportName());
	}

	public function testPromptDisablesRedirectWhenMarkdownIsUnavailable(): void {
		$extension = new RedirectExtension(new RedirectExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => false]);

		$this->assertStringContainsString('Markdown rendering is disabled', $prompt);
		$this->assertStringContainsString('Do not emit base3-redirect blocks', $prompt);
	}
}

require_once __DIR__ . '/RedirectExtensionAssetResolver.php';
