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

namespace ChatbotExtensions\Extension;

use AssistantFoundation\Dto\AssistantResponseClientPlugin;

abstract class AbstractStructuredContentExtension extends AbstractChatbotExtension {

	abstract protected function getClientExportName(): string;

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return new AssistantResponseClientPlugin(
			$this->id(),
			$this->resolveVersionedAsset('plugin/ChatbotExtensions/assets/chatbot/StructuredContentPlugins.js'),
			$this->getClientExportName()
		);
	}
}
