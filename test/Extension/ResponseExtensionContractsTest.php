<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

use AssistantFoundation\Api\IAssistantResponseExtension;
use AssistantFoundation\Api\IAssistantResponseExtensionExamples;
use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\AccordionExtension;
use ChatbotExtensions\Extension\CalloutExtension;
use ChatbotExtensions\Extension\ChartExtension;
use ChatbotExtensions\Extension\CodeFormattingExtension;
use ChatbotExtensions\Extension\DataDownloadExtension;
use ChatbotExtensions\Extension\KpiCardsExtension;
use ChatbotExtensions\Extension\LeafletMapExtension;
use ChatbotExtensions\Extension\MathJaxExtension;
use ChatbotExtensions\Extension\MermaidExtension;
use ChatbotExtensions\Extension\ModularGridExtension;
use ChatbotExtensions\Extension\ProgressExtension;
use ChatbotExtensions\Extension\RedirectExtension;
use ChatbotExtensions\Extension\TimelineExtension;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ResponseExtensionContractsTest extends TestCase {

	#[DataProvider('extensionProvider')]
	public function testAllExtensionsExposeStableMetadata(
		string $className,
		string $id,
		string $assetName,
		string $exportName,
		int $priority
	): void {
		$extension = new $className($this->createStub(IAssetResolver::class));

		$this->assertInstanceOf(IAssistantResponseExtension::class, $extension);
		$this->assertInstanceOf(IAssistantResponseExtensionExamples::class, $extension);
		$this->assertSame(strtolower((new \ReflectionClass($className))->getShortName()), $extension::getName());
		$this->assertSame($id, $extension->id());
		$this->assertSame($priority, $extension->getPriority());
		$this->assertNotEmpty($extension->getLabel());
		$this->assertNotEmpty($extension->getDescription());
		$this->assertFalse($extension->isEnabledByDefault());
		$this->assertSame([], $extension->getClientPluginOptions([]));
		$this->assertNotEmpty($extension->getExamplePrompts());
		$this->assertNotEmpty($extension->getSystemPrompt(['use_markdown' => true]));
	}

	#[DataProvider('extensionProvider')]
	public function testEachExtensionProducesAContentHashedClientModule(
		string $className,
		string $id,
		string $assetName,
		string $exportName,
		int $priority
	): void {
		$resolver = $this->createStub(IAssetResolver::class);
		$resolver->method('resolve')->willReturnCallback(static fn(string $path): string => '/resolved/' . $path);
		$extension = new $className($resolver);
		$plugin = $extension->getClientPlugin(['use_markdown' => true, 'language' => 'en']);
		$this->assertNotNull($plugin);

		$asset = 'plugin/ChatbotExtensions/assets/chatbot/' . $assetName . '.js';
		$localFile = dirname(__DIR__, 2) . '/assets/chatbot/' . $assetName . '.js';
		$this->assertFileExists($localFile);
		$this->assertSame('/resolved/' . $asset . '?v=' . substr(hash_file('sha256', $localFile), 0, 12), $plugin->getModuleUrl());
		$this->assertSame($id, $plugin->getName());
		$this->assertSame($exportName, $plugin->getExportName());
		$this->assertSame([
			'name' => $id,
			'module_url' => $plugin->getModuleUrl(),
			'export_name' => $exportName,
			'options' => $plugin->getOptions()
		], $plugin->toArray());
	}

	public function testStructuredClientModulesShareOneJavaScriptImplementation(): void {
		$resolver = $this->createStub(IAssetResolver::class);
		$resolver->method('resolve')->willReturnCallback(static fn(string $path): string => '/' . $path);
		$urls = [];

		foreach ([AccordionExtension::class, CalloutExtension::class, DataDownloadExtension::class, KpiCardsExtension::class, ProgressExtension::class, TimelineExtension::class] as $className) {
			$plugin = (new $className($resolver))->getClientPlugin(['language' => 'de']);
			$urls[] = $plugin->getModuleUrl();
			$this->assertArrayHasKey('strings', $plugin->getOptions());
			$this->assertArrayHasKey('renderError', $plugin->getOptions()['strings']);
		}

		$this->assertCount(1, array_unique($urls));
	}

	public function testLegacyCodeFormattingClassIsNotRegisteredAsAssistantResponseExtension(): void {
		$this->assertFalse(is_subclass_of(CodeFormattingExtension::class, IAssistantResponseExtension::class));
		$this->assertSame([], (new \ReflectionClass(CodeFormattingExtension::class))->getMethods());
	}

	/** @return array<string,array{class-string,string,string,string,int}> */
	public static function extensionProvider(): array {
		return [
			'formulae' => [MathJaxExtension::class, 'mathjax', 'MathJaxPlugin', 'MathJaxPlugin', 100],
			'diagrams' => [MermaidExtension::class, 'mermaid', 'MermaidPlugin', 'MermaidPlugin', 105],
			'charts' => [ChartExtension::class, 'charts', 'ChartPlugin', 'ChartPlugin', 106],
			'tables' => [ModularGridExtension::class, 'tables', 'ModularGridPlugin', 'ModularGridPlugin', 107],
			'maps' => [LeafletMapExtension::class, 'maps', 'LeafletMapPlugin', 'LeafletMapPlugin', 108],
			'notices' => [CalloutExtension::class, 'callouts', 'StructuredContentPlugins', 'CalloutPlugin', 110],
			'kpis' => [KpiCardsExtension::class, 'kpi-cards', 'StructuredContentPlugins', 'KpiCardsPlugin', 120],
			'progress' => [ProgressExtension::class, 'progress', 'StructuredContentPlugins', 'ProgressPlugin', 130],
			'timeline' => [TimelineExtension::class, 'timeline', 'StructuredContentPlugins', 'TimelinePlugin', 140],
			'accordion' => [AccordionExtension::class, 'accordions', 'StructuredContentPlugins', 'AccordionPlugin', 150],
			'downloads' => [DataDownloadExtension::class, 'data-downloads', 'StructuredContentPlugins', 'DataDownloadPlugin', 160],
			'navigation' => [RedirectExtension::class, 'redirect', 'RedirectPlugin', 'RedirectPlugin', 170]
		];
	}
}
