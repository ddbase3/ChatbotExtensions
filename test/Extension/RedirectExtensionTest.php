<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

if (!defined('DIR_PLUGIN')) {
	define('DIR_PLUGIN', dirname(__DIR__, 3) . DIRECTORY_SEPARATOR);
}

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\RedirectExtension;
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

final class RedirectExtensionAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
