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

namespace Base3\ChatbotExtensions\Test;

use Base3\CoreFoundation\Api\IContainer;
use Base3\ChatbotExtensions\ChatbotExtensionsPlugin;
use PHPUnit\Framework\TestCase;

final class ChatbotExtensionsPluginTest extends TestCase {

	public function testPluginRegistersItselfUsingExistingContainerWithNoOverwrite(): void {
		$container = $this->createMock(IContainer::class);
		$plugin = new ChatbotExtensionsPlugin($container);

		$container->expects($this->once())->method('set')->with(
			'chatbotextensionsplugin',
			$this->identicalTo($plugin),
			IContainer::SHARED | IContainer::NOOVERWRITE
		)->willReturn($container);

		$this->assertSame('chatbotextensionsplugin', ChatbotExtensionsPlugin::getName());
		$plugin->init();
	}

	public function testInstalledDependenciesProduceIndependentOkResults(): void {
		$container = $this->createStub(IContainer::class);
		$container->method('get')->willReturnCallback(static function(string $id): object {
			return (object)['id' => $id];
		});

		$this->assertSame([
			'assistantfoundationplugin_installed' => 'Ok',
			'chatbotplugin_installed' => 'Ok',
			'clientstackplugin_installed' => 'Ok'
		], (new ChatbotExtensionsPlugin($container))->checkDependencies());
	}

	public function testMissingDependenciesAreNamedSeparately(): void {
		$container = $this->createStub(IContainer::class);
		$container->method('get')->willReturnCallback(static fn(string $id): ?object => $id === 'chatbotplugin' ? (object)[] : null);

		$this->assertSame([
			'assistantfoundationplugin_installed' => 'assistantfoundationplugin not installed',
			'chatbotplugin_installed' => 'Ok',
			'clientstackplugin_installed' => 'clientstackplugin not installed'
		], (new ChatbotExtensionsPlugin($container))->checkDependencies());
	}
}
