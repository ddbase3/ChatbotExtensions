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
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class AbstractChatbotExtensionTest extends TestCase {

	public function testVersionedAssetsUseAContentHashAndPreserveExistingQueryParameters(): void {
		$asset = 'plugin/ChatbotExtensions/assets/chatbot/StructuredContentPlugins.js';
		$resolver = $this->createStub(IAssetResolver::class);
		$resolver->method('resolve')->willReturnCallback(static fn(string $path): string => '/assets/' . $path . '?theme=dark');
		$extension = new AbstractChatbotExtensionProbe($resolver);
		$file = dirname(__DIR__, 2) . '/assets/chatbot/StructuredContentPlugins.js';

		$this->assertSame('/assets/' . $asset . '?theme=dark&v=' . substr(hash_file('sha256', $file), 0, 12), $extension->assetUrl($asset));
		$this->assertSame('/assets/plugin/OtherPlugin/assets/example.js?theme=dark', $extension->assetUrl('plugin/OtherPlugin/assets/example.js'));
	}

	public function testMissingVersionedAssetDoesNotSilentlyProduceAnUnversionedUrl(): void {
		$resolver = $this->createStub(IAssetResolver::class);
		$resolver->method('resolve')->willReturn('/assets/missing.js');
		$extension = new AbstractChatbotExtensionProbe($resolver);
		$this->expectException(RuntimeException::class);
		$this->expectExceptionMessage('Chatbot extension asset is missing');
		$extension->assetUrl('plugin/ChatbotExtensions/assets/chatbot/DoesNotExist.js');
	}

	public function testUnavailableTranslationUsesTheExplicitFallbackValue(): void {
		$extension = new AbstractChatbotExtensionProbe($this->createStub(IAssetResolver::class));
		$this->assertSame('Test fallback', $extension->translation(['language' => 'de'], 'nonexistent_translation_key', 'Test fallback'));
		$this->assertSame('Test fallback', $extension->translation(['language' => 'xx'], 'nonexistent_translation_key', 'Test fallback'));
	}

	public function testAllClientDiagnosticKeysAreTranslatedAndPresent(): void {
		$extension = new AbstractChatbotExtensionProbe($this->createStub(IAssetResolver::class));
		$strings = $extension->clientStrings(['language' => 'en']);
		$this->assertSame([
			'renderError', 'renderDetails', 'renderGeneratedCode',
			'renderCopyCode', 'renderCopiedCode', 'renderCopyFailed'
		], array_keys($strings));
		foreach ($strings as $value) {
			$this->assertNotSame('', trim($value));
		}
	}
}

require_once __DIR__ . '/AbstractChatbotExtensionProbe.php';
