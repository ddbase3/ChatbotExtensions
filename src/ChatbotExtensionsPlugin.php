<?php declare(strict_types=1);

/***********************************************************************
 * This file is part of ChatbotExtensions for BASE3 Framework.
 *
 * ChatbotExtensions provides optional assistant response renderers for
 * the modular Chatbot client.
 *
 * Developed by Daniel Dahme
 * Licensed under GPL-3.0
 * https://www.gnu.org/licenses/gpl-3.0.en.html
 **********************************************************************/

namespace ChatbotExtensions;

use Base3\Api\ICheck;
use Base3\Api\IContainer;
use Base3\Api\IPlugin;

final class ChatbotExtensionsPlugin implements IPlugin, ICheck {

	public function __construct(private readonly IContainer $container) {}

	public static function getName(): string {
		return 'chatbotextensionsplugin';
	}

	public function init() {
		$this->container->set(self::getName(), $this, IContainer::SHARED | IContainer::NOOVERWRITE);
	}

	public function checkDependencies() {
		return [
			'assistantfoundationplugin_installed' => $this->container->get('assistantfoundationplugin')
				? 'Ok'
				: 'assistantfoundationplugin not installed',
			'chatbotplugin_installed' => $this->container->get('chatbotplugin')
				? 'Ok'
				: 'chatbotplugin not installed',
			'clientstackplugin_installed' => $this->container->get('clientstackplugin')
				? 'Ok'
				: 'clientstackplugin not installed'
		];
	}
}
