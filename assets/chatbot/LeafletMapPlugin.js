const pendingScripts = new Map();
const loadedStyles = new WeakMap();

const STYLE_ATTRIBUTE = 'data-base3-chatbot-map-styles';
const RESOURCE_ATTRIBUTE = 'data-base3-module-resource';
const BLOCK_SELECTOR = 'pre > code.language-base3-map';
const ALLOWED_PROPERTIES = new Set(['title', 'map_type', 'points']);
const ALLOWED_POINT_PROPERTIES = new Set(['lat', 'lng', 'label', 'description']);
const ALLOWED_MAP_TYPES = new Set(['street', 'satellite', 'topographic']);

const BASE_MAPS = Object.freeze({
	street: Object.freeze({
		label: 'Street map',
		url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
		options: Object.freeze({
			maxZoom: 19,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		})
	}),
	satellite: Object.freeze({
		label: 'Satellite imagery',
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		options: Object.freeze({
			maxZoom: 19,
			attribution: 'Tiles &copy; Esri &mdash; Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
		})
	}),
	topographic: Object.freeze({
		label: 'Topographic map',
		url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
		options: Object.freeze({
			maxZoom: 17,
			subdomains: 'abc',
			attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
		})
	})
});

function getDocument(context) {
	return context.root?.ownerDocument || globalThis.document;
}

function ensureStyles(root) {
	if (!root || typeof root.querySelector !== 'function' || root.querySelector(`style[${STYLE_ATTRIBUTE}]`)) {
		return;
	}

	const document = root.ownerDocument || globalThis.document;
	if (!document || typeof document.createElement !== 'function') {
		return;
	}

	const style = document.createElement('style');
	style.setAttribute(STYLE_ATTRIBUTE, '');
	style.textContent = `
.base3-chatbot-map { width: 100%; max-width: 100%; margin: 1rem 0; }
.base3-chatbot-map-title { margin: 0 0 0.6rem; font-size: 1rem; line-height: 1.35; }
.base3-chatbot-map-host { width: 100%; height: clamp(20rem, 52vw, 32rem); min-height: 20rem; border-radius: 0.4rem; overflow: hidden; }
.base3-chatbot-map-host .leaflet-popup-content { overflow-wrap: anywhere; }
.base3-chatbot-map-popup-title { display: block; margin-bottom: 0.25rem; }
.base3-chatbot-map-popup-description { margin: 0; }
.base3-chatbot-map-error { border-inline-start: 0.3rem solid #8b2f2f; border-radius: 0.25rem; padding: 0.85rem 1rem; color: #8b2f2f; background: color-mix(in srgb, currentColor 7%, transparent); white-space: pre-wrap; overflow-wrap: anywhere; }
`;
	root.appendChild(style);
}

function normalizeResourceUrl(document, value, label) {
	const source = String(value || '').trim();
	if (!source) {
		throw new Error(`LeafletMapPlugin requires pluginOptions.${label}.`);
	}

	try {
		return new URL(source, document.baseURI || globalThis.location?.href || import.meta.url).href;
	}
	catch (error) {
		throw new Error(`LeafletMapPlugin received an invalid ${label}.`);
	}
}

function ensureStylesheet(document, url) {
	let documentStyles = loadedStyles.get(document);
	if (!documentStyles) {
		documentStyles = new Set();
		loadedStyles.set(document, documentStyles);
	}
	if (documentStyles.has(url)) {
		return;
	}

	const existing = typeof document.querySelectorAll === 'function'
		? [...document.querySelectorAll(`link[${RESOURCE_ATTRIBUTE}]`)].find(
			(link) => link.dataset?.base3ModuleResource === url
		)
		: null;
	if (existing) {
		documentStyles.add(url);
		return;
	}

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = url;
	link.dataset.base3ModuleResource = url;
	document.head.appendChild(link);
	documentStyles.add(url);
}

function loadScript(document, url) {
	if (pendingScripts.has(url)) {
		return pendingScripts.get(url);
	}

	const promise = new Promise((resolve, reject) => {
		const existing = typeof document.querySelectorAll === 'function'
			? [...document.querySelectorAll(`script[${RESOURCE_ATTRIBUTE}]`)].find(
				(script) => script.dataset?.base3ModuleResource === url
			)
			: null;
		if (existing) {
			if (existing.dataset.loaded === '1') {
				resolve();
				return;
			}
			existing.addEventListener('load', resolve, { once: true });
			existing.addEventListener('error', reject, { once: true });
			return;
		}

		const script = document.createElement('script');
		script.src = url;
		script.async = true;
		script.dataset.base3ModuleResource = url;
		script.addEventListener('load', () => {
			script.dataset.loaded = '1';
			resolve();
		}, { once: true });
		script.addEventListener('error', () => {
			reject(new Error(`Unable to load script "${url}".`));
		}, { once: true });
		document.head.appendChild(script);
	});

	pendingScripts.set(url, promise);
	return promise;
}

function isLeafletApi(value) {
	return value
		&& typeof value.map === 'function'
		&& typeof value.tileLayer === 'function'
		&& typeof value.marker === 'function'
		&& typeof value.latLngBounds === 'function'
		&& value.control
		&& typeof value.control.layers === 'function';
}

async function resolveLeaflet(context, options) {
	const document = getDocument(context);
	if (!document || typeof document.createElement !== 'function') {
		throw new Error('Leaflet map rendering requires a document.');
	}

	const scriptUrl = normalizeResourceUrl(document, options.scriptUrl, 'scriptUrl');
	const styleUrl = normalizeResourceUrl(document, options.styleUrl, 'styleUrl');
	ensureStylesheet(document, styleUrl);

	let leaflet = context.resolveGlobal('L');
	if (isLeafletApi(leaflet)) {
		return leaflet;
	}

	await loadScript(document, scriptUrl);
	leaflet = context.resolveGlobal('L');
	if (!isLeafletApi(leaflet)) {
		throw new Error('Leaflet was loaded but did not expose its global API.');
	}

	return leaflet;
}

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertAllowedProperties(value, allowed, label) {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			throw new Error(`${label} contains unsupported property "${key}".`);
		}
	}
}

function normalizeText(value, label, maximumLength, required = false) {
	if (value === undefined || value === null) {
		if (required) {
			throw new Error(`${label} is required.`);
		}
		return '';
	}
	if (typeof value !== 'string') {
		throw new Error(`${label} must be plain text.`);
	}

	const text = value.trim();
	if (required && !text) {
		throw new Error(`${label} is required.`);
	}
	if (text.length > maximumLength) {
		throw new Error(`${label} must not exceed ${maximumLength} characters.`);
	}
	return text;
}

function normalizeCoordinate(value, label, minimum, maximum) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${label} must be a finite number.`);
	}
	if (value < minimum || value > maximum) {
		throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
	}
	return value;
}

function normalizeMapType(value) {
	if (value === undefined || value === null || value === '') {
		return 'street';
	}
	if (typeof value !== 'string' || !ALLOWED_MAP_TYPES.has(value)) {
		throw new Error('Map map_type must be street, satellite, or topographic.');
	}
	return value;
}

function normalizePoints(value) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
		throw new Error('Map points must contain between 1 and 50 entries.');
	}

	return value.map((point, index) => {
		if (!isObject(point)) {
			throw new Error(`Map point ${index + 1} must be an object.`);
		}
		assertAllowedProperties(point, ALLOWED_POINT_PROPERTIES, `Map point ${index + 1}`);

		return {
			lat: normalizeCoordinate(point.lat, `Map point ${index + 1} lat`, -90, 90),
			lng: normalizeCoordinate(point.lng, `Map point ${index + 1} lng`, -180, 180),
			label: normalizeText(point.label, `Map point ${index + 1} label`, 120, true),
			description: normalizeText(point.description, `Map point ${index + 1} description`, 500)
		};
	});
}

function parseMap(code) {
	const source = String(code?.textContent || '').trim();
	if (!source) {
		throw new Error('Map block is empty.');
	}

	let value;
	try {
		value = JSON.parse(source);
	}
	catch (error) {
		throw new Error(`Map block contains invalid JSON: ${error.message}`);
	}

	if (!isObject(value)) {
		throw new Error('Map block must contain one JSON object.');
	}
	assertAllowedProperties(value, ALLOWED_PROPERTIES, 'Map');

	return {
		title: normalizeText(value.title, 'Map title', 200),
		mapType: normalizeMapType(value.map_type),
		points: normalizePoints(value.points)
	};
}

function createBaseLayers(leaflet) {
	const byType = {};
	const byLabel = {};

	for (const [type, definition] of Object.entries(BASE_MAPS)) {
		const layer = leaflet.tileLayer(definition.url, { ...definition.options });
		byType[type] = layer;
		byLabel[definition.label] = layer;
	}

	return { byType, byLabel };
}

function createPopup(document, point) {
	const popup = document.createElement('div');
	const title = document.createElement('strong');
	title.className = 'base3-chatbot-map-popup-title';
	title.textContent = point.label;
	popup.appendChild(title);

	if (point.description) {
		const description = document.createElement('p');
		description.className = 'base3-chatbot-map-popup-description';
		description.textContent = point.description;
		popup.appendChild(description);
	}

	return popup;
}

function createTooltip(document, point) {
	const tooltip = document.createElement('span');
	tooltip.textContent = point.label;
	return tooltip;
}

function fitMapToPoints(map, leaflet, points) {
	const coordinates = points.map((point) => [point.lat, point.lng]);
	if (coordinates.length === 1) {
		map.setView(coordinates[0], 13);
		return;
	}

	map.fitBounds(leaflet.latLngBounds(coordinates), {
		padding: [32, 32],
		maxZoom: 14
	});
}

function scheduleInvalidateSize(map) {
	const run = () => map.invalidateSize({ pan: false });
	if (typeof globalThis.requestAnimationFrame === 'function') {
		globalThis.requestAnimationFrame(run);
		return;
	}
	globalThis.setTimeout(run, 0);
}

function createErrorElement(document, error) {
	const element = document.createElement('div');
	element.className = 'base3-chatbot-map base3-chatbot-map-error';
	element.setAttribute('role', 'alert');
	element.textContent = `Map error: ${error?.message || error}`;
	return element;
}

async function renderCodeBlock(context, state, code) {
	if (!code || code.dataset?.base3MapState) {
		return;
	}

	const container = code.parentElement;
	if (!container || typeof container.replaceWith !== 'function') {
		return;
	}

	code.dataset.base3MapState = 'rendering';
	const document = code.ownerDocument || getDocument(context);
	let host = null;
	let map = null;

	try {
		const data = parseMap(code);
		const leaflet = await resolveLeaflet(context, state.options);
		if (state.destroyed || code.isConnected === false) {
			return;
		}

		host = document.createElement('section');
		host.className = 'base3-chatbot-map';
		host.setAttribute('role', 'region');
		host.setAttribute('aria-label', data.title || 'Interactive map');

		if (data.title) {
			const title = document.createElement('h4');
			title.className = 'base3-chatbot-map-title';
			title.textContent = data.title;
			host.appendChild(title);
		}

		const mapHost = document.createElement('div');
		mapHost.className = 'base3-chatbot-map-host';
		host.appendChild(mapHost);
		container.replaceWith(host);

		map = leaflet.map(mapHost, {
			center: [0, 0],
			zoom: 2,
			scrollWheelZoom: false
		});

		const layers = createBaseLayers(leaflet);
		layers.byType[data.mapType].addTo(map);
		leaflet.control.layers(layers.byLabel, null, {
			collapsed: true,
			position: 'topright'
		}).addTo(map);

		for (const point of data.points) {
			const marker = leaflet.marker([point.lat, point.lng]).addTo(map);
			marker.bindTooltip(createTooltip(document, point));
			marker.bindPopup(createPopup(document, point));
		}

		fitMapToPoints(map, leaflet, data.points);
		scheduleInvalidateSize(map);
		state.maps.add(map);
	}
	catch (error) {
		if (map && typeof map.remove === 'function') {
			map.remove();
		}
		if (state.destroyed) {
			return;
		}

		const errorElement = createErrorElement(document, error);
		if (host && typeof host.replaceWith === 'function') {
			host.replaceWith(errorElement);
		}
		else if (code.isConnected !== false) {
			container.replaceWith(errorElement);
		}
		context.events.emit('chatbot:error', error);
	}
}

function renderElement(context, state, element) {
	if (!element || typeof element.querySelectorAll !== 'function') {
		return;
	}

	element.querySelectorAll(BLOCK_SELECTOR).forEach((code) => {
		renderCodeBlock(context, state, code);
	});
}

function getMessageElement(payload) {
	return payload?.content || payload?.element || null;
}

export const LeafletMapPlugin = {
	name: 'maps',

	install(context) {
		this.states ??= new WeakMap();

		const state = {
			destroyed: false,
			maps: new Set(),
			options: context.getPluginOptions(),
			unsubscribe: []
		};
		this.states.set(context.chatbot, state);
		ensureStyles(context.root);

		state.unsubscribe.push(
			context.events.on('message:completed', (payload) => {
				if (!payload?.interaction && !payload?.error) {
					renderElement(context, state, getMessageElement(payload));
				}
			}),
			context.events.on('message:hydrated', (payload) => {
				if (payload?.role === 'assistant' && !payload?.error) {
					renderElement(context, state, getMessageElement(payload));
				}
			}),
			context.events.on('opening-message:loaded', ({ element }) => {
				renderElement(context, state, element);
			})
		);
	},

	destroy(context) {
		const state = this.states?.get(context.chatbot);
		if (!state) {
			return;
		}

		state.destroyed = true;
		state.unsubscribe.forEach((unsubscribe) => unsubscribe());
		state.maps.forEach((map) => {
			if (map && typeof map.remove === 'function') {
				map.remove();
			}
		});
		state.maps.clear();
		this.states.delete(context.chatbot);
	}
};
