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

final class LeafletMapExtension extends AbstractChatbotExtension {

	public static function getName(): string {
		return 'leafletmapextension';
	}

	public function id(): string {
		return 'maps';
	}

	public function getLabel(): string {
		return 'Maps (Leaflet)';
	}

	public function getDescription(): string {
		return 'Renders safe interactive point maps with street, satellite, or topographic base maps.';
	}

	public function getPriority(): int {
		return 108;
	}

	public function getRequirements(): array {
		return [
			'ClientStack Markdown renderer',
			'ClientStack Leaflet library',
			'Internet access to the selected tile provider'
		];
	}

	public function getExamplePrompts(): array {
		return [
			'Show Berlin, Hamburg, Munich, Cologne, and Frankfurt as labeled points on a street map.',
			'Place the following field locations on a topographic map and add a short description to each marker.'
		];
	}

	public function getSystemPrompt(array $context): string {
		if (empty($context['use_markdown'])) {
			return 'Map rendering is unavailable because Markdown rendering is disabled. Do not emit base3-map blocks.';
		}

		return <<<'PROMPT'
An active Leaflet map renderer is available in the chat. Users describe places or coordinate-based locations in natural language and are not expected to know the technical payload syntax.
If the user asks for locations, sites, stations, branches, events, measurements, destinations, or other points to be shown on a map, you MUST use the renderer when an interactive point map is an appropriate answer. Never return the payload as bare JSON and never place it in a generic `json` code block.
The complete map must use the exact fenced block identifier `base3-map`:
```base3-map
{"title":"German cities","map_type":"street","points":[{"lat":52.520008,"lng":13.404954,"label":"Berlin","description":"Capital of Germany"},{"lat":53.551086,"lng":9.993682,"label":"Hamburg","description":"Port city"},{"lat":48.135124,"lng":11.581981,"label":"Munich","description":"Capital of Bavaria"}]}
```
The opening fence, the exact identifier `base3-map`, one JSON object, and the closing fence are mandatory.
The required property is `points`. Optional properties are `title` and `map_type`.
`map_type` may only be `street`, `satellite`, or `topographic`. If no map type is requested, use `street`.
`points` must contain between 1 and 50 objects. Every point requires finite numeric `lat` and `lng` coordinates and a short plain-text `label`. `lat` must be between -90 and 90 and `lng` between -180 and 180. The optional `description` must be short plain text.
The renderer automatically determines the center and map bounds from all points. Do not include center, zoom, bounds, routes, lines, polygons, icons, colors, tile URLs, or provider configuration.
Do not include HTML, Markdown, JavaScript, callbacks, URLs, nested objects, nested arrays, custom marker configuration, or properties other than those documented above and `lat`, `lng`, `label`, plus `description` inside points.
Use normal explanatory prose outside the block when useful. When the user explicitly requests a map and valid coordinates are available, do not replace it with a textual coordinate list.
Before finishing, verify that the JSON is valid, every coordinate is numeric and within range, and every point contains a meaningful label.
PROMPT;
	}

	public function getClientPlugin(array $context): ?AssistantResponseClientPlugin {
		return new AssistantResponseClientPlugin(
			'maps',
			$this->resolveVersionedAsset('plugin/ChatbotExtensions/assets/chatbot/LeafletMapPlugin.js'),
			'LeafletMapPlugin',
			[
				'scriptUrl' => $this->assetResolver->resolve(
					'plugin/ClientStack/assets/leaflet/leaflet.js'
				),
				'styleUrl' => $this->assetResolver->resolve(
					'plugin/ClientStack/assets/leaflet/leaflet.css'
				)
			]
		);
	}
}
