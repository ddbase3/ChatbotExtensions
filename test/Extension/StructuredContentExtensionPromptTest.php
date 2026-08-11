<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\AccordionExtension;
use ChatbotExtensions\Extension\CalloutExtension;
use ChatbotExtensions\Extension\DataDownloadExtension;
use ChatbotExtensions\Extension\KpiCardsExtension;
use ChatbotExtensions\Extension\ProgressExtension;
use ChatbotExtensions\Extension\TimelineExtension;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class StructuredContentExtensionPromptTest extends TestCase {

	#[DataProvider('extensionProvider')]
	public function testPromptExplainsNaturalLanguageTriggerAndExactFence(
		object $extension,
		string $fence
	): void {
		$prompt = $extension->getSystemPrompt(['use_markdown' => true]);

		$this->assertStringContainsString('Users describe the desired', $prompt);
		$this->assertStringContainsString('you MUST use the renderer', $prompt);
		$this->assertStringContainsString('Never return the payload as bare JSON', $prompt);
		$this->assertStringContainsString('```' . $fence, $prompt);
		$this->assertStringContainsString('exact identifier `' . $fence . '`', $prompt);
		$this->assertContains('ClientStack Markdown renderer', $extension->getRequirements());
	}

	#[DataProvider('extensionProvider')]
	public function testPromptDisablesStructuredBlocksWhenMarkdownIsUnavailable(
		object $extension,
		string $fence
	): void {
		$prompt = $extension->getSystemPrompt(['use_markdown' => false]);

		$this->assertStringContainsString('Markdown rendering is disabled', $prompt);
		$this->assertStringContainsString('Do not emit ' . $fence . ' blocks', $prompt);
	}

	public function testContentExtensionsDefineMarkdownFieldsWithoutNestedExtensions(): void {
		$resolver = new StructuredContentPromptAssetResolver();
		$prompts = [
			'callout' => (new CalloutExtension($resolver))->getSystemPrompt(['use_markdown' => true]),
			'kpi' => (new KpiCardsExtension($resolver))->getSystemPrompt(['use_markdown' => true]),
			'timeline' => (new TimelineExtension($resolver))->getSystemPrompt(['use_markdown' => true]),
			'accordion' => (new AccordionExtension($resolver))->getSystemPrompt(['use_markdown' => true])
		];

		$this->assertStringContainsString('`text` is Markdown content', $prompts['callout']);
		$this->assertStringContainsString('`detail` is optional Markdown', $prompts['kpi']);
		$this->assertStringContainsString('`text` is optional Markdown', $prompts['timeline']);
		$this->assertStringContainsString('Use Markdown inside `markdown`', $prompts['accordion']);

		foreach ($prompts as $prompt) {
			$this->assertStringContainsString('fenced `base3-*` extension blocks', $prompt);
		}
	}

	public function testCompactAndDownloadPayloadsRemainPlainStructuredData(): void {
		$resolver = new StructuredContentPromptAssetResolver();
		$progressPrompt = (new ProgressExtension($resolver))->getSystemPrompt(['use_markdown' => true]);
		$downloadPrompt = (new DataDownloadExtension($resolver))->getSystemPrompt(['use_markdown' => true]);

		$this->assertStringContainsString('`text` is optional plain text', $progressPrompt);
		$this->assertStringContainsString('Do not include HTML, Markdown', $progressPrompt);
		$this->assertStringContainsString('Do not include remote URLs, HTML, JavaScript, Markdown', $downloadPrompt);
	}

	/** @return array<string,array{0:object,1:string}> */
	public static function extensionProvider(): array {
		$resolver = new StructuredContentPromptAssetResolver();

		return [
			'callout' => [new CalloutExtension($resolver), 'base3-callout'],
			'kpi cards' => [new KpiCardsExtension($resolver), 'base3-kpi'],
			'progress' => [new ProgressExtension($resolver), 'base3-progress'],
			'timeline' => [new TimelineExtension($resolver), 'base3-timeline'],
			'accordion' => [new AccordionExtension($resolver), 'base3-accordion'],
			'data download' => [new DataDownloadExtension($resolver), 'base3-download']
		];
	}
}

final class StructuredContentPromptAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
