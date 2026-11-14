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

namespace Base3\ChatbotExtensions\Test\SettingsTab;

use Base3\CoreFoundation\Authorization\Api\IAuthorizationService;
use Base3\CoreFoundation\Authorization\Api\IFeature;
use Base3\CoreFoundation\Authorization\Dto\AuthorizationDecision;
use Base3\CoreFoundation\Authorization\Dto\AuthorizationRequest;
use Base3\CoreFoundation\Translation\Api\ITranslation;
use Base3\ChatbotExtensions\Content\ChatbotExtensionsConfigDisplay;
use Base3\ChatbotExtensions\SettingsTab\ChatbotextensionsconfigSettingsTab;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class ChatbotextensionsconfigSettingsTabTest extends TestCase {

	public function testTabUsesTheExistingChatbotSettingsNavigation(): void {
		$tab = $this->tab();

		$this->assertSame('chatbotextensionsconfigsettingstab', ChatbotextensionsconfigSettingsTab::getName());
		$this->assertSame('chatbotsettingstab', $tab->getParentTabName());
		$this->assertSame(ChatbotExtensionsConfigDisplay::getName(), $tab->getDisplayName());
		$this->assertNull($tab->getDisplayData());
		$this->assertSame(30, $tab->getOrder());
	}

	public function testTabProvidesTheExistingFeatureContract(): void {
		$tab = $this->tab();

		$this->assertInstanceOf(IFeature::class, $tab);
		$permissions = $tab->getPermissions();
		$this->assertCount(1, $permissions);
		$this->assertSame('feature', $permissions[0]->scope);
		$this->assertSame('chatbotextensionsconfigsettingstab', $permissions[0]->permission);
		$this->assertSame(['group' => 'administration'], $tab->getDefaultAudience());
	}

	public function testTabUsesTheExistingTranslationService(): void {
		$translation = $this->createMock(ITranslation::class);
		$translation->expects($this->exactly(2))->method('translate')->willReturnCallback(
			function(string $set, string $section, string $key): string {
				$this->assertSame('Settings', $set);
				$this->assertSame('chatbotextensionsconfigsettingstab', $section);

				return match ($key) {
					'label' => 'Assistant response extensions',
					'description' => 'Configure response extensions',
					default => throw new RuntimeException('Unexpected translation key')
				};
			}
		);
		$tab = $this->tab($translation);

		$this->assertSame('Assistant response extensions', $tab->getLabel());
		$this->assertSame('Configure response extensions', $tab->getDescription());
	}

	public function testTabVisibilityRequiresExplicitAuthorization(): void {
		foreach ([
			[AuthorizationDecision::allow(), true],
			[AuthorizationDecision::deny(), false],
			[AuthorizationDecision::indeterminate(), false]
		] as [$decision, $expected]) {
			$authorization = $this->createStub(IAuthorizationService::class);
			$authorization->method('getDefaultAuthority')->willReturn('base3');
			$authorization->method('decide')->willReturnCallback(
				function(AuthorizationRequest $request) use ($decision): AuthorizationDecision {
					$this->assertSame('base3', $request->authority);
					$this->assertSame('feature', $request->permission->scope);
					$this->assertSame('chatbotextensionsconfigsettingstab', $request->permission->permission);
					$this->assertNull($request->subject);

					return $decision;
				}
			);

			$this->assertSame($expected, $this->tab(null, $authorization)->isVisible());
		}
	}

	public function testTabVisibilityFailsClosedOnAuthorizationError(): void {
		$authorization = $this->createStub(IAuthorizationService::class);
		$authorization->method('getDefaultAuthority')->willReturn('base3');
		$authorization->method('decide')->willThrowException(new RuntimeException('Authorization unavailable'));

		$this->assertFalse($this->tab(null, $authorization)->isVisible());
	}

	public function testSettingsNavigationHasTranslationsInEverySupportedLanguage(): void {
		$directory = dirname(__DIR__, 2) . '/lang/Settings/';
		$languages = ['ar', 'bg', 'de', 'en', 'es', 'fr', 'hi', 'it', 'pl', 'pt', 'ru', 'zh'];
		$section = ChatbotextensionsconfigSettingsTab::getName();

		foreach ($languages as $language) {
			$filename = $directory . $language . '.ini';
			$this->assertFileExists($filename);
			$data = parse_ini_file($filename, true);
			$this->assertIsArray($data);
			$this->assertArrayHasKey($section, $data);
			$this->assertArrayHasKey('label', $data[$section]);
			$this->assertArrayHasKey('description', $data[$section]);
			$this->assertNotSame('', trim((string)$data[$section]['label']));
			$this->assertNotSame('', trim((string)$data[$section]['description']));
		}
	}

	private function tab(
		?ITranslation $translation = null,
		?IAuthorizationService $authorization = null
	): ChatbotextensionsconfigSettingsTab {
		return new ChatbotextensionsconfigSettingsTab(
			$translation ?? $this->createStub(ITranslation::class),
			$authorization ?? $this->createStub(IAuthorizationService::class)
		);
	}
}
