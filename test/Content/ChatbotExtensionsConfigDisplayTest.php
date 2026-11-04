<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Content;

use Base3\Api\IAssetResolver;
use Base3\Api\IClassMap;
use Base3\Api\IMvcView;
use Base3\Api\IRequest;
use Base3\Authorization\Api\IAuthorizationService;
use Base3\Authorization\Dto\AuthorizationDecision;
use Base3\Authorization\Dto\AuthorizationRequest;
use Base3\LinkTarget\Api\ILinkTargetService;
use Base3\Settings\Api\ISettingsStore;
use Chatbot\Service\ChatbotExtensionRegistry;
use Chatbot\Service\ChatbotExtensionService;
use ChatbotExtensions\Content\ChatbotExtensionsConfigDisplay;
use ChatbotExtensions\Extension\CalloutExtension;
use PHPUnit\Framework\TestCase;

final class ChatbotExtensionsConfigDisplayTest extends TestCase {

	public function testMetadataIdentifiesTheAdministrativeDisplay(): void {
		$this->assertSame('chatbotextensionsconfigdisplay', ChatbotExtensionsConfigDisplay::getName());
		$this->assertStringContainsString('assistant response extensions', $this->display()->getHelp());
	}

	public function testAuthorizationDenialPreventsRenderingAndSaving(): void {
		$authorization = $this->createStub(IAuthorizationService::class);
		$authorization->method('getDefaultAuthority')->willReturn('base3');
		$authorization->method('decide')->willReturn(AuthorizationDecision::deny());
		$settings = $this->createMock(ISettingsStore::class);
		$settings->expects($this->never())->method('set');
		$view = $this->createMock(IMvcView::class);
		$view->expects($this->never())->method('loadTemplate');

		try {
			$this->assertSame('', $this->display(['action' => 'save', 'enabled_extensions' => ['callouts']], [], $settings, $authorization, $view)->getOutput('json'));
			$this->assertSame(403, http_response_code());
		} finally {
			http_response_code(200);
		}
	}

	public function testUnknownJsonActionsAreRejectedWithoutMutatingSettings(): void {
		$settings = $this->createMock(ISettingsStore::class);
		$settings->expects($this->never())->method('set');
		$display = $this->display(['action' => 'delete'], ['unknown_action' => 'Invalid operation'], $settings);

		$data = json_decode($display->getOutput('json'), true, 512, JSON_THROW_ON_ERROR);
		$this->assertSame('error', $data['status']);
		$this->assertFalse($data['success']);
		$this->assertSame('danger', $data['messages'][0]['type']);
		$this->assertSame('Invalid operation', $data['messages'][0]['text']);
	}

	public function testLegacyActionParameterIsAcceptedForSaving(): void {
		$settings = $this->createMock(ISettingsStore::class);
		$settings->expects($this->once())->method('set')->with(
			'chatbot-extensions',
			'default',
			['enabled' => ['callouts' => true]]
		);
		$settings->expects($this->once())->method('save');
		$settings->method('get')->willReturn([]);
		$display = $this->display(['chatbot_extensions_action' => 'save', 'enabled_extensions' => ['callouts']], ['saved' => 'Changes stored'], $settings);

		$result = json_decode($display->getOutput('json'), true, 512, JSON_THROW_ON_ERROR);
		$this->assertTrue($result['success']);
		$this->assertSame('ok', $result['status']);
		$this->assertSame('success', $result['messages'][0]['type']);
		$this->assertSame('Changes stored', $result['messages'][0]['text']);
		$this->assertSame('callouts', $result['extensions'][0]['id']);
	}

	public function testSaveConvertsScalarSelectedValueIntoEmptySelection(): void {
		$settings = $this->createMock(ISettingsStore::class);
		$settings->expects($this->once())->method('set')->with(
			'chatbot-extensions',
			'default',
			['enabled' => ['callouts' => false]]
		);
		$settings->expects($this->once())->method('save');
		$settings->method('get')->willReturn([]);
		$data = json_decode($this->display(['action' => 'save', 'enabled_extensions' => 'invalid'], [], $settings)->getOutput('json'), true, 512, JSON_THROW_ON_ERROR);
		$this->assertTrue($data['success']);
	}

	public function testInvalidSelectedExtensionReportsFailureWithoutSaving(): void {
		$settings = $this->createMock(ISettingsStore::class);
		$settings->expects($this->never())->method('set');
		$settings->expects($this->never())->method('save');
		$settings->method('get')->willReturn([]);
		$data = json_decode($this->display(['action' => 'save', 'enabled_extensions' => ['not-installed']], [], $settings)->getOutput('json'), true, 512, JSON_THROW_ON_ERROR);

		$this->assertFalse($data['success']);
		$this->assertSame('error', $data['status']);
		$this->assertSame('danger', $data['messages'][0]['type']);
		$this->assertStringContainsString('Unknown assistant response extension', $data['messages'][0]['text']);
	}

	public function testHtmlOutputLocalizesStatesAndUsesLinkTargetResolver(): void {
		$assigned = [];
		$view = $this->createStub(IMvcView::class);
		$view->method('getBricks')->willReturn([
			'title' => 'Localized title',
			'callouts_label' => 'Localized callouts',
			'callouts_description' => 'Localized description',
			'callouts_requirement_1' => 'Localized requirement',
			'callouts_example_1' => 'Localized example'
		]);
		$view->method('assign')->willReturnCallback(static function(string $key, mixed $value) use (&$assigned): void {
			$assigned[$key] = $value;
		});
		$view->method('loadTemplate')->willReturn('rendered');
		$links = $this->createMock(ILinkTargetService::class);
		$links->expects($this->once())->method('getLink')->with(
			['name' => 'chatbotextensionsconfigdisplay', 'out' => 'json'],
			['action' => 'save']
		)->willReturn('/admin/save');
		$display = $this->display([], [], null, null, $view, $links);

		$this->assertSame('rendered', $display->getOutput('html'));
		$this->assertSame('Localized title', $assigned['title']);
		$this->assertSame('/admin/save', $assigned['saveUrl']);
		$this->assertSame('Localized callouts', $assigned['extensions'][0]['label']);
		$this->assertSame('Localized description', $assigned['extensions'][0]['description']);
		$this->assertSame(['Localized requirement'], $assigned['extensions'][0]['requirements']);
		$this->assertSame(['Localized example'], $assigned['extensions'][0]['example_prompts']);
		$this->assertSame([], $assigned['messages']);
	}

	public function testUnsupportedOutputFormatDoesNotRenderTemplate(): void {
		$view = $this->createMock(IMvcView::class);
		$view->expects($this->never())->method('loadTemplate');
		$this->assertSame('', $this->display([], [], null, null, $view)->getOutput('xml'));
	}

	private function display(
		array $requestValues = [],
		array $translations = [],
		?ISettingsStore $settings = null,
		?IAuthorizationService $authorization = null,
		?IMvcView $view = null,
		?ILinkTargetService $links = null
	): ChatbotExtensionsConfigDisplay {
		$request = $this->createStub(IRequest::class);
		$request->method('request')->willReturnCallback(static fn(string $key, mixed $default = null): mixed => $requestValues[$key] ?? $default);
		if ($authorization === null) {
			$authorization = $this->createStub(IAuthorizationService::class);
			$authorization->method('getDefaultAuthority')->willReturn('base3');
			$authorization->method('decide')->willReturn(AuthorizationDecision::allow());
		}
		if ($view === null) {
			$view = $this->createStub(IMvcView::class);
			$view->method('getBricks')->willReturn($translations);
			$view->method('loadTemplate')->willReturn('rendered');
		}
		if ($links === null) {
			$links = $this->createStub(ILinkTargetService::class);
			$links->method('getLink')->willReturn('/save');
		}
		if ($settings === null) {
			$settings = $this->createStub(ISettingsStore::class);
			$settings->method('get')->willReturn([]);
		}
		$resolver = $this->createStub(IAssetResolver::class);
		$classMap = $this->createStub(IClassMap::class);
		$classMap->method('getInstancesByInterface')->willReturn([new CalloutExtension($resolver)]);
		$extensionService = new ChatbotExtensionService(new ChatbotExtensionRegistry($classMap), $settings);

		return new ChatbotExtensionsConfigDisplay($view, $request, $links, $extensionService, $authorization);
	}
}
