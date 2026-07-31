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
		$prompt = $extension->getSystemPrompt([]);

		$this->assertStringContainsString('Users describe the desired', $prompt);
		$this->assertStringContainsString('you MUST use the renderer', $prompt);
		$this->assertStringContainsString('Never return the payload as bare JSON', $prompt);
		$this->assertStringContainsString('```' . $fence, $prompt);
		$this->assertStringContainsString('exact identifier `' . $fence . '`', $prompt);
	}

	public function testAccordionPromptDefinesMarkdownContentWithoutNestedExtensions(): void {
		$extension = new AccordionExtension(new StructuredContentPromptAssetResolver());
		$prompt = $extension->getSystemPrompt([]);

		$this->assertStringContainsString('"markdown"', $prompt);
		$this->assertStringContainsString('Use Markdown inside `markdown`', $prompt);
		$this->assertStringContainsString('Do not include HTML or fenced `base3-*` extension blocks', $prompt);
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
