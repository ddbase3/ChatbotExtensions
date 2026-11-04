<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\CalloutExtension;
use ChatbotExtensions\Extension\DataDownloadExtension;
use ChatbotExtensions\Extension\RedirectExtension;
use PHPUnit\Framework\TestCase;

final class ClientLocalizationTest extends TestCase {

	public function testGermanRegionCodeLoadsOwningPluginTranslation(): void {
		$extension = new CalloutExtension($this->resolver());
		$plugin = $extension->getClientPlugin(['language' => ' DE_de ']);

		$translations = parse_ini_file(dirname(__DIR__, 2) . '/lang/Administration/de.ini', true)['chatbot_extensions_administration'];
		$this->assertSame($translations['client_render_error'], $plugin->getOptions()['strings']['renderError']);
		$this->assertSame($translations['client_render_details'], $plugin->getOptions()['strings']['renderDetails']);
		$this->assertSame($translations['client_render_copy_code'], $plugin->getOptions()['strings']['renderCopyCode']);
	}

	public function testUnsupportedLanguageFallsBackToEnglishPluginCatalog(): void {
		$extension = new CalloutExtension($this->resolver());
		$plugin = $extension->getClientPlugin(['language' => 'xx-XX']);

		$translations = parse_ini_file(dirname(__DIR__, 2) . '/lang/Administration/en.ini', true)['chatbot_extensions_administration'];
		$this->assertSame($translations['client_render_error'], $plugin->getOptions()['strings']['renderError']);
	}

	public function testDownloadAndNavigationUseTheirOwnTranslationKeys(): void {
		$resolver = $this->resolver();
		$download = (new DataDownloadExtension($resolver))->getClientPlugin(['language' => 'de']);
		$redirect = (new RedirectExtension($resolver))->getClientPlugin(['language' => 'de']);
		$translations = parse_ini_file(dirname(__DIR__, 2) . '/lang/Administration/de.ini', true)['chatbot_extensions_administration'];

		$this->assertSame($translations['client_download'], $download->getOptions()['strings']['download']);
		$this->assertSame($translations['client_redirect_error'], $redirect->getOptions()['strings']['renderError']);
		$this->assertSame(['renderError' => $translations['client_redirect_error']], $redirect->getOptions()['strings']);
	}

	private function resolver(): IAssetResolver {
		$resolver = $this->createStub(IAssetResolver::class);
		$resolver->method('resolve')->willReturnCallback(static fn(string $path): string => '/resolved/' . $path);
		return $resolver;
	}
}
