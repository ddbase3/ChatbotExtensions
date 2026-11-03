<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\AccordionExtension;
use ChatbotExtensions\Extension\CalloutExtension;
use ChatbotExtensions\Extension\DataDownloadExtension;
use ChatbotExtensions\Extension\KpiCardsExtension;
use ChatbotExtensions\Extension\ProgressExtension;
use ChatbotExtensions\Extension\TimelineExtension;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class StructuredContentPromptAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
