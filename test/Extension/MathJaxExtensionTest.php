<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\MathJaxExtension;
use PHPUnit\Framework\TestCase;

final class MathJaxExtensionTest extends TestCase {

	public function testMarkdownModeRequiresNormalTeXDelimitersWithoutDoubleEscaping(): void {
		$extension = new MathJaxExtension($this->createStub(IAssetResolver::class));
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);

		$this->assertStringContainsString('Markdown renderer is followed by a MathJax-aware extension', $prompt);
		$this->assertStringContainsString('do not double delimiter backslashes', $prompt);
		$this->assertStringContainsString('\\( ... \\)', $prompt);
		$this->assertStringContainsString('\\[ ... \\]', $prompt);
		$this->assertStringContainsString('\\begin{aligned}', $prompt);
		$this->assertStringContainsString('\\begin{bmatrix}', $prompt);
		$this->assertStringContainsString('Do not use dollar-sign delimiters', $prompt);
	}

	public function testPlainTextModeDoesNotPresumeMarkdown(): void {
		$extension = new MathJaxExtension($this->createStub(IAssetResolver::class));
		$prompt = $extension->getSystemPrompt(['use_markdown' => false]);

		$this->assertStringContainsString('without Markdown', $prompt);
		$this->assertStringContainsString('MathJax output contract', $prompt);
		$this->assertSame(['ClientStack MathJax library'], $extension->getRequirements());
	}

	public function testClientPluginSetsMathJaxDependencyAndProtectionOnlyWhenMarkdownEnabled(): void {
		$resolver = $this->createStub(IAssetResolver::class);
		$resolver->method('resolve')->willReturnCallback(static fn(string $path): string => '/assets/' . $path);
		$extension = new MathJaxExtension($resolver);

		$with = $extension->getClientPlugin(['use_markdown' => true]);
		$without = $extension->getClientPlugin(['use_markdown' => false]);
		$this->assertTrue($with->getOptions()['protectMarkdown']);
		$this->assertFalse($without->getOptions()['protectMarkdown']);
		$this->assertSame('/assets/plugin/ClientStack/assets/mathjax/tex-mml-chtml.js', $with->getOptions()['scriptUrl']);
		$this->assertSame('MathJaxPlugin', $with->getExportName());
	}
}
