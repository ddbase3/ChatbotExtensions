<?php declare(strict_types=1);

namespace ChatbotExtensions\SettingsTab;

use UiFoundation\Settings\AbstractFeatureSettingsTab;

final class ChatbotextensionsconfigSettingsTab extends AbstractFeatureSettingsTab {

	public function getParentTabName(): ?string {
		return 'chatbotsettingstab';
	}

	public function getDisplayName(): ?string {
		return 'chatbotextensionsconfigdisplay';
	}

	public function getOrder(): int {
		return 30;
	}
}
