import assert from 'node:assert/strict';
import test from 'node:test';
import { LeafletMapPlugin } from '../assets/chatbot/LeafletMapPlugin.js';

class EventBus {
	constructor() {
		this.listeners = new Map();
	}

	on(name, listener) {
		const listeners = this.listeners.get(name) || new Set();
		listeners.add(listener);
		this.listeners.set(name, listeners);
		return () => listeners.delete(listener);
	}

	emit(name, payload) {
		for (const listener of this.listeners.get(name) || []) {
			listener(payload);
		}
	}
}

class FakeElement {
	constructor(tagName = 'div', document = null) {
		this.tagName = tagName.toUpperCase();
		this.ownerDocument = document;
		this.children = [];
		this.attributes = new Map();
		this.dataset = {};
		this.className = '';
		this.textContent = '';
		this.parentElement = null;
		this.isConnected = true;
		this.replacement = null;
		this.rel = '';
		this.href = '';
	}

	appendChild(child) {
		this.children.push(child);
		child.parentElement = this;
		child.ownerDocument ||= this.ownerDocument;
		return child;
	}

	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}

	querySelector(selector) {
		if (selector === 'style[data-base3-chatbot-map-styles]') {
			return this.children.find((child) => child.tagName === 'STYLE'
				&& child.attributes.has('data-base3-chatbot-map-styles')) || null;
		}
		return null;
	}

	querySelectorAll() {
		return [];
	}

	replaceWith(element) {
		this.replacement = element;
	}
}

class FakeDocument {
	constructor() {
		this.baseURI = 'https://example.test/chat/';
		this.head = new FakeElement('head', this);
	}

	createElement(tagName) {
		return new FakeElement(tagName, this);
	}

	querySelectorAll(selector) {
		if (selector === 'link[data-base3-module-resource]') {
			return this.head.children.filter((child) => child.tagName === 'LINK');
		}
		if (selector === 'script[data-base3-module-resource]') {
			return this.head.children.filter((child) => child.tagName === 'SCRIPT');
		}
		return [];
	}
}

function createCodeBlock(document, payload) {
	const container = new FakeElement('pre', document);
	const code = new FakeElement('code', document);
	code.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
	code.parentElement = container;
	return { container, code };
}

function createContent(document, blocks) {
	const content = new FakeElement('div', document);
	content.querySelectorAll = (selector) => selector === 'pre > code.language-base3-map'
		? blocks.map((block) => block.code)
		: [];
	return content;
}

function createFakeLeaflet() {
	const maps = [];
	const tileLayers = [];
	const markers = [];
	const layerControls = [];

	const leaflet = {
		maps,
		tileLayers,
		markers,
		layerControls,

		map(element, options) {
			const map = {
				element,
				options,
				layers: [],
				markers: [],
				controls: [],
				setViewArgs: null,
				fitBoundsArgs: null,
				invalidateSizeArgs: null,
				removed: false,
				setView(coordinates, zoom) {
					this.setViewArgs = { coordinates, zoom };
					return this;
				},
				fitBounds(bounds, fitOptions) {
					this.fitBoundsArgs = { bounds, options: fitOptions };
					return this;
				},
				invalidateSize(invalidateOptions) {
					this.invalidateSizeArgs = invalidateOptions;
					return this;
				},
				remove() {
					this.removed = true;
				}
			};
			maps.push(map);
			return map;
		},

		tileLayer(url, options) {
			const layer = {
				url,
				options,
				addTo(map) {
					map.layers.push(this);
					return this;
				}
			};
			tileLayers.push(layer);
			return layer;
		},

		marker(coordinates) {
			const marker = {
				coordinates,
				tooltip: null,
				popup: null,
				addTo(map) {
					map.markers.push(this);
					return this;
				},
				bindTooltip(content) {
					this.tooltip = content;
					return this;
				},
				bindPopup(content) {
					this.popup = content;
					return this;
				}
			};
			markers.push(marker);
			return marker;
		},

		latLngBounds(coordinates) {
			return { coordinates };
		},

		control: {
			layers(baseLayers, overlays, options) {
				const control = {
					baseLayers,
					overlays,
					options,
					addTo(map) {
						map.controls.push(this);
						return this;
					}
				};
				layerControls.push(control);
				return control;
			}
		}
	};

	return leaflet;
}

function createContext(leaflet) {
	const document = new FakeDocument();
	const root = new FakeElement('section', document);
	const events = new EventBus();
	const errors = [];
	const commands = [];
	const originalEmit = events.emit.bind(events);
	events.emit = (name, payload) => {
		if (name === 'chatbot:error') {
			errors.push(payload);
		}
		originalEmit(name, payload);
	};

	return {
		document,
		root,
		events,
		errors,
		commands,
		context: {
			chatbot: {},
			root,
			events,
			commands: {
				execute(name, payload) {
					commands.push({ name, payload });
					return new FakeElement('fragment', document);
				}
			},
			getPluginOptions() {
				return {
					scriptUrl: '/assets/leaflet/leaflet.js',
					styleUrl: '/assets/leaflet/leaflet.css'
				};
			},
			resolveGlobal(path) {
				return path === 'L' ? leaflet : null;
			}
		}
	};
}

async function flushAsyncWork(iterations = 8) {
	for (let index = 0; index < iterations; index += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

test('leaflet map plugin renders multiple points with fixed satellite tiles and automatic bounds', async () => {
	const leaflet = createFakeLeaflet();
	const setup = createContext(leaflet);
	const block = createCodeBlock(setup.document, {
		title: 'Field locations',
		map_type: 'satellite',
		points: [
			{ lat: 52.52, lng: 13.405, label: 'Berlin', description: '**Capital** of Germany\n\n- Government district' },
			{ lat: 48.137, lng: 11.575, label: 'Munich', description: 'Second location' }
		]
	});
	const content = createContent(setup.document, [block]);

	LeafletMapPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	assert.equal(leaflet.maps.length, 1);
	assert.equal(leaflet.tileLayers.length, 3);
	assert.equal(leaflet.layerControls.length, 1);
	assert.deepEqual(Object.keys(leaflet.layerControls[0].baseLayers), [
		'Street map',
		'Satellite imagery',
		'Topographic map'
	]);

	const map = leaflet.maps[0];
	assert.equal(map.layers.length, 1);
	assert.match(map.layers[0].url, /World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/);
	assert.match(map.layers[0].options.attribution, /Esri/);
	assert.equal(map.markers.length, 2);
	assert.deepEqual(map.fitBoundsArgs.bounds.coordinates, [[52.52, 13.405], [48.137, 11.575]]);
	assert.deepEqual(map.fitBoundsArgs.options, { padding: [32, 32], maxZoom: 14 });
	assert.equal(map.setViewArgs, null);

	const firstMarker = map.markers[0];
	assert.equal(firstMarker.tooltip.textContent, 'Berlin');
	assert.equal(firstMarker.popup.children[0].textContent, 'Berlin');
	assert.equal(firstMarker.popup.children[1].className, 'base3-chatbot-map-popup-description');
	assert.equal(firstMarker.popup.children[1].children[0].tagName, 'FRAGMENT');
	assert.equal(setup.commands.length, 2);
	assert.equal(setup.commands[0].name, 'markdown:render-fragment');
	assert.equal(setup.commands[0].payload.markdown, '**Capital** of Germany\n\n- Government district');
	assert.equal(setup.commands[0].payload.allowExtensionBlocks, false);

	assert.ok(block.container.replacement);
	assert.equal(block.container.replacement.className, 'base3-chatbot-map');
	assert.equal(block.container.replacement.attributes.get('aria-label'), 'Field locations');
	assert.ok(setup.root.querySelector('style[data-base3-chatbot-map-styles]'));
	assert.equal(setup.document.head.children.filter((child) => child.tagName === 'LINK').length, 1);
	assert.deepEqual(setup.errors, []);

	LeafletMapPlugin.destroy(setup.context);
	assert.equal(map.removed, true);
});

test('leaflet map plugin defaults to street tiles and centers a single restored point', async () => {
	const leaflet = createFakeLeaflet();
	const setup = createContext(leaflet);
	const block = createCodeBlock(setup.document, {
		points: [{ lat: 50.1109, lng: 8.6821, label: 'Frankfurt' }]
	});
	const content = createContent(setup.document, [block]);

	LeafletMapPlugin.install(setup.context);
	setup.events.emit('message:hydrated', {
		role: 'assistant',
		content,
		error: false
	});
	await flushAsyncWork();

	assert.equal(leaflet.maps.length, 1);
	const map = leaflet.maps[0];
	assert.match(map.layers[0].url, /tile\.openstreetmap\.org/);
	assert.deepEqual(map.setViewArgs, {
		coordinates: [50.1109, 8.6821],
		zoom: 13
	});
	assert.equal(map.fitBoundsArgs, null);
	assert.deepEqual(setup.errors, []);

	LeafletMapPlugin.destroy(setup.context);
});

test('leaflet map plugin renders topographic opening maps and removes them on destroy', async () => {
	const leaflet = createFakeLeaflet();
	const setup = createContext(leaflet);
	const block = createCodeBlock(setup.document, {
		map_type: 'topographic',
		points: [{ lat: 46.948, lng: 7.4474, label: 'Bern' }]
	});
	const content = createContent(setup.document, [block]);

	LeafletMapPlugin.install(setup.context);
	setup.events.emit('opening-message:loaded', { element: content });
	await flushAsyncWork();

	assert.equal(leaflet.maps.length, 1);
	assert.match(leaflet.maps[0].layers[0].url, /tile\.opentopomap\.org/);
	assert.equal(leaflet.maps[0].layers[0].options.maxZoom, 17);
	assert.match(leaflet.maps[0].layers[0].options.attribution, /OpenTopoMap/);

	LeafletMapPlugin.destroy(setup.context);
	assert.equal(leaflet.maps[0].removed, true);
});

test('leaflet map plugin rejects arbitrary tile configuration and invalid coordinates', async () => {
	const leaflet = createFakeLeaflet();
	const setup = createContext(leaflet);
	const first = createCodeBlock(setup.document, {
		map_type: 'street',
		tile_url: 'https://example.test/{z}/{x}/{y}.png',
		points: [{ lat: 52.52, lng: 13.405, label: 'Berlin' }]
	});
	const second = createCodeBlock(setup.document, {
		points: [{ lat: 95, lng: 13.405, label: 'Invalid' }]
	});
	const content = createContent(setup.document, [first, second]);

	LeafletMapPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	assert.equal(leaflet.maps.length, 0);
	assert.equal(first.container.replacement.textContent, 'Map could not be rendered.');
	assert.equal(second.container.replacement.textContent, 'Map could not be rendered.');
	assert.equal(setup.errors.length, 2);
	assert.match(setup.errors[0].message, /unsupported property "tile_url"/);
	assert.match(setup.errors[1].message, /between -90 and 90/);

	LeafletMapPlugin.destroy(setup.context);
});

test('leaflet map plugin ignores interaction responses and hydrated user messages', async () => {
	const leaflet = createFakeLeaflet();
	const setup = createContext(leaflet);
	const first = createCodeBlock(setup.document, {
		points: [{ lat: 52.52, lng: 13.405, label: 'Berlin' }]
	});
	const second = createCodeBlock(setup.document, {
		points: [{ lat: 48.137, lng: 11.575, label: 'Munich' }]
	});

	LeafletMapPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content: createContent(setup.document, [first]),
		interaction: true,
		error: false
	});
	setup.events.emit('message:hydrated', {
		role: 'user',
		content: createContent(setup.document, [second]),
		error: false
	});
	await flushAsyncWork();

	assert.equal(leaflet.maps.length, 0);
	assert.equal(first.container.replacement, null);
	assert.equal(second.container.replacement, null);

	LeafletMapPlugin.destroy(setup.context);
});
