<?php declare(strict_types=1);

namespace ChatbotExtensions\Test\Extension;

use Base3\Api\IAssetResolver;
use ChatbotExtensions\Extension\LeafletMapExtension;
use PHPUnit\Framework\TestCase;

final class LeafletMapExtensionAssetResolver implements IAssetResolver {

	public function resolve(string $path): string {
		return '/resolved/' . $path;
	}
}
