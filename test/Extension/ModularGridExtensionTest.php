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
use Base3\ChatbotExtensions\Extension\ModularGridExtension;
use PHPUnit\Framework\TestCase;

final class ModularGridExtensionTest extends TestCase {

	public function testExtensionProvidesRestrictedPromptAndClientPlugin(): void {
		$extension = new ModularGridExtension(new ModularGridExtensionAssetResolver());
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);
		$plugin = $extension->getClientPlugin(['use_markdown' => true]);

		$this->assertSame('tables', $extension->id());
		$this->assertStringContainsString('```base3-table', $prompt);
		$this->assertStringContainsString('between 1 and 20 objects', $prompt);
		$this->assertStringContainsString('^[A-Za-z][A-Za-z0-9_]{0,63}$', $prompt);
		$this->assertStringContainsString('the first character must be a letter A-Z or a-z', $prompt);
		$this->assertStringContainsString('`2026` -> `year_2026`', $prompt);
		$this->assertStringContainsString('Use the exact same declared keys as property names in every row', $prompt);
		$this->assertStringContainsString('must not exceed 120 characters', $prompt);
		$this->assertStringContainsString('must not exceed 2000 characters', $prompt);
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

require_once __DIR__ . '/ModularGridExtensionAssetResolver.php';
