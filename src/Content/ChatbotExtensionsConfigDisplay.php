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

namespace ChatbotExtensions\Content;

use Base3\Api\IDisplay;
use Base3\Api\IMvcView;
use Base3\Api\IRequest;
use Base3\LinkTarget\Api\ILinkTargetService;
use Chatbot\Service\ChatbotExtensionService;
use Throwable;

final class ChatbotExtensionsConfigDisplay implements IDisplay {

	private const FORM_ACTION_SAVE = 'save';

	private array $messages = [];

	/** @var array<string,string> */
	private array $translations = [];

	public function __construct(
		private readonly IMvcView $view,
		private readonly IRequest $request,
		private readonly ILinkTargetService $linkTargetService,
		private readonly ChatbotExtensionService $extensionService
	) {}

	public static function getName(): string {
		return 'chatbotextensionsconfigdisplay';
	}

	public function setData($data) {
		$this->messages = [];
		$this->translations = [];
	}

	public function getOutput(string $out = 'html', bool $final = false): string {
		$out = strtolower(trim($out));
		$this->prepareTranslations();

		if ($out === 'json') {
			return $this->getJsonOutput($final);
		}

		if ($out !== 'html') {
			return '';
		}

		$this->view->setPath(DIR_PLUGIN . 'ChatbotExtensions');
		$this->view->setTemplate('Content/ChatbotExtensionsConfigDisplay.php');
		$this->view->assign('title', $this->translate('title', 'Chatbot Extensions'));
		$this->view->assign(
			'description',
			$this->translate(
				'description',
				'Enable optional assistant output capabilities. Disabled extensions do not add model instructions or browser modules.'
			)
		);
		$this->view->assign('formId', 'base3_chatbot_extensions_config');
		$this->view->assign('saveUrl', $this->getSaveUrl());
		$this->view->assign('extensions', $this->getLocalizedStates());
		$this->view->assign('messages', $this->messages);
		$this->view->assign('saveLabel', $this->translate('save', 'Save'));
		$this->view->assign('requirementsLabel', $this->translate('requirements', 'Requirements'));
		$this->view->assign('examplesLabel', $this->translate('examples', 'Example prompts'));
		$this->view->assign('copyPromptLabel', $this->translate('copy_prompt', 'Copy prompt'));
		$this->view->assign('copiedPromptLabel', $this->translate('copied_prompt', 'Copied'));
		$this->view->assign('noExtensionsLabel', $this->translate('no_extensions', 'No extensions are installed.'));
		$this->view->assign(
			'requestError',
			$this->translate('request_error', 'Extension settings could not be saved.')
		);

		return $this->view->loadTemplate();
	}

	public function getHelp(): string {
		return 'Configure optional assistant response extensions for the Chatbot.';
	}

	private function getJsonOutput(bool $final): string {
		if ($final && !headers_sent()) {
			header('Content-Type: application/json; charset=UTF-8');
		}

		$action = trim((string)$this->request->request('action', ''));
		if ($action === '') {
			$action = trim((string)$this->request->request('chatbot_extensions_action', ''));
		}

		if ($action !== self::FORM_ACTION_SAVE) {
			return $this->jsonError($this->translate('unknown_action', 'Unknown action.'));
		}

		$success = $this->save();

		return $this->jsonResponse($success, [
			'messages' => $this->messages,
			'extensions' => $this->getLocalizedStates()
		]);
	}

	private function getSaveUrl(): string {
		return $this->linkTargetService->getLink(
			[
				'name' => self::getName(),
				'out' => 'json'
			],
			[
				'action' => self::FORM_ACTION_SAVE
			]
		);
	}

	private function save(): bool {
		$selected = $this->request->request('enabled_extensions', []);
		$selected = is_array($selected) ? $selected : [];

		try {
			$this->extensionService->saveEnabled(array_values(array_map('strval', $selected)));
			$this->messages[] = [
				'type' => 'success',
				'text' => $this->translate('saved', 'Extension settings saved.')
			];
			return true;
		}
		catch (Throwable $exception) {
			$this->messages[] = [
				'type' => 'danger',
				'text' => sprintf(
					$this->translate('save_error', 'Extension settings could not be saved: %s'),
					$exception->getMessage()
				)
			];
			return false;
		}
	}

	private function jsonResponse(bool $success, array $data = []): string {
		$json = json_encode(array_merge([
			'status' => $success ? 'ok' : 'error',
			'success' => $success
		], $data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

		return is_string($json) ? $json : '{"status":"error","success":false}';
	}

	private function jsonError(string $message): string {
		$this->messages = [[
			'type' => 'danger',
			'text' => $message
		]];

		return $this->jsonResponse(false, [
			'messages' => $this->messages
		]);
	}


	/** @return array<int,array<string,mixed>> */
	private function getLocalizedStates(): array {
		$states = $this->extensionService->getStates();

		foreach ($states as &$state) {
			$id = preg_replace('/[^a-z0-9]+/', '_', strtolower((string)($state['id'] ?? '')));
			if (!is_string($id) || $id === '') {
				continue;
			}

			$state['label'] = $this->translate($id . '_label', (string)($state['label'] ?? ''));
			$state['description'] = $this->translate(
				$id . '_description',
				(string)($state['description'] ?? '')
			);

			$requirements = is_array($state['requirements'] ?? null) ? $state['requirements'] : [];
			foreach ($requirements as $index => &$requirement) {
				$requirement = $this->translate(
					$id . '_requirement_' . ($index + 1),
					(string)$requirement
				);
			}
			unset($requirement);
			$state['requirements'] = $requirements;

			$examples = is_array($state['example_prompts'] ?? null) ? $state['example_prompts'] : [];
			foreach ($examples as $index => &$example) {
				$example = $this->translate(
					$id . '_example_' . ($index + 1),
					(string)$example
				);
			}
			unset($example);
			$state['example_prompts'] = $examples;
		}
		unset($state);

		return $states;
	}

	private function prepareTranslations(): void {
		$this->view->setPath(DIR_PLUGIN . 'ChatbotExtensions');
		$this->view->loadBricks('Administration');
		$translations = $this->view->getBricks('chatbot_extensions_administration');
		$this->translations = is_array($translations) ? $translations : [];
	}

	private function translate(string $key, string $fallback): string {
		$value = $this->translations[$key] ?? null;
		return is_scalar($value) && trim((string)$value) !== ''
			? trim((string)$value)
			: $fallback;
	}
}
