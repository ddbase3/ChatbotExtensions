const pendingScripts = new Map();

const STYLE_ATTRIBUTE = 'data-base3-chatbot-chart-styles';
const BLOCK_SELECTOR = 'pre > code.language-base3-chart';
const ALLOWED_TYPES = new Set(['bar', 'line', 'pie', 'doughnut']);
const ALLOWED_PROPERTIES = new Set([
	'type',
	'title',
	'labels',
	'datasets',
	'x_label',
	'y_label',
	'begin_at_zero',
	'stacked'
]);
const ALLOWED_DATASET_PROPERTIES = new Set(['label', 'data']);

function getDocument(context) {
	return context.root?.ownerDocument || globalThis.document;
}

function getString(options, key, fallback, replacements = {}) {
	let value = String(options?.strings?.[key] ?? fallback);
	for (const [name, replacement] of Object.entries(replacements)) {
		value = value.split(`{${name}}`).join(String(replacement));
	}
	return value;
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
.base3-chatbot-chart { position: relative; width: 100%; max-width: 100%; height: clamp(18rem, 48vw, 28rem); margin: 1rem 0; }
.base3-chatbot-chart canvas { display: block; width: 100% !important; height: 100% !important; }
.base3-chatbot-chart-error { border-inline-start: 0.3rem solid #8b2f2f; border-radius: 0.25rem; height: auto; padding: 0.85rem 1rem; color: #8b2f2f; background: color-mix(in srgb, currentColor 7%, transparent); white-space: pre-wrap; overflow-wrap: anywhere; }
`;
	root.appendChild(style);
}

function loadScript(document, url) {
	url = String(url || '').trim();
	if (!url) {
		return Promise.reject(new Error('ChartPlugin requires pluginOptions.scriptUrl.'));
	}
	if (pendingScripts.has(url)) {
		return pendingScripts.get(url);
	}

	const promise = new Promise((resolve, reject) => {
		const existing = typeof document.querySelectorAll === 'function'
			? [...document.querySelectorAll('script[data-base3-module-resource]')].find(
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

async function resolveChart(context, options) {
	let Chart = context.resolveGlobal('Chart');
	if (typeof Chart === 'function') {
		return Chart;
	}

	const document = getDocument(context);
	if (!document || typeof document.createElement !== 'function') {
		throw new Error('Chart rendering requires a document.');
	}

	await loadScript(document, options.scriptUrl);
	Chart = context.resolveGlobal('Chart');
	if (typeof Chart !== 'function') {
		throw new Error('Chart.js was loaded but did not expose its global API.');
	}

	return Chart;
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

function normalizeBoolean(value, label, fallback) {
	if (value === undefined) {
		return fallback;
	}
	if (typeof value !== 'boolean') {
		throw new Error(`${label} must be boolean.`);
	}
	return value;
}

function normalizeLabels(value) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
		throw new Error('Chart labels must contain between 1 and 100 entries.');
	}
	return value.map((label, index) => normalizeText(label, `Chart label ${index + 1}`, 200, true));
}

function normalizeDatasets(value, labelCount) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 6) {
		throw new Error('Chart datasets must contain between 1 and 6 entries.');
	}

	return value.map((dataset, datasetIndex) => {
		if (!isObject(dataset)) {
			throw new Error(`Chart dataset ${datasetIndex + 1} must be an object.`);
		}
		assertAllowedProperties(dataset, ALLOWED_DATASET_PROPERTIES, `Chart dataset ${datasetIndex + 1}`);

		const label = normalizeText(dataset.label, `Chart dataset ${datasetIndex + 1} label`, 120, true);
		if (!Array.isArray(dataset.data) || dataset.data.length !== labelCount) {
			throw new Error(`Chart dataset ${datasetIndex + 1} must contain exactly ${labelCount} values.`);
		}

		const data = dataset.data.map((value, valueIndex) => {
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				throw new Error(`Chart dataset ${datasetIndex + 1} value ${valueIndex + 1} must be a finite number.`);
			}
			return value;
		});

		return { label, data };
	});
}

function parseChart(code) {
	const source = String(code?.textContent || '').trim();
	if (!source) {
		throw new Error('Chart block is empty.');
	}

	let value;
	try {
		value = JSON.parse(source);
	}
	catch (error) {
		throw new Error(`Chart block contains invalid JSON: ${error.message}`);
	}

	if (!isObject(value)) {
		throw new Error('Chart block must contain one JSON object.');
	}
	assertAllowedProperties(value, ALLOWED_PROPERTIES, 'Chart');

	const type = normalizeText(value.type, 'Chart type', 20, true).toLowerCase();
	if (!ALLOWED_TYPES.has(type)) {
		throw new Error('Chart type must be bar, line, pie, or doughnut.');
	}

	const labels = normalizeLabels(value.labels);
	const datasets = normalizeDatasets(value.datasets, labels.length);
	if (['pie', 'doughnut'].includes(type) && datasets.length !== 1) {
		throw new Error('Pie and doughnut charts require exactly one dataset.');
	}

	const stacked = normalizeBoolean(value.stacked, 'Chart stacked', false);
	if (stacked && type !== 'bar') {
		throw new Error('Stacked mode is only supported for bar charts.');
	}

	return {
		type,
		title: normalizeText(value.title, 'Chart title', 200),
		labels,
		datasets,
		xLabel: normalizeText(value.x_label, 'Chart x-axis label', 120),
		yLabel: normalizeText(value.y_label, 'Chart y-axis label', 120),
		beginAtZero: normalizeBoolean(value.begin_at_zero, 'Chart begin_at_zero', false),
		stacked
	};
}

function createChartConfiguration(data) {
	const datasets = data.datasets.map((dataset) => {
		const normalized = {
			label: dataset.label,
			data: dataset.data
		};
		if (data.type === 'line') {
			normalized.fill = false;
			normalized.tension = 0.25;
		}
		return normalized;
	});

	const options = {
		responsive: true,
		maintainAspectRatio: false,
		animation: {
			duration: 250
		},
		plugins: {
			legend: {
				display: datasets.length > 1 || ['pie', 'doughnut'].includes(data.type),
				position: 'bottom'
			},
			title: {
				display: data.title !== '',
				text: data.title
			}
		}
	};

	if (['bar', 'line'].includes(data.type)) {
		options.scales = {
			x: {
				stacked: data.stacked,
				title: {
					display: data.xLabel !== '',
					text: data.xLabel
				},
				ticks: {
					autoSkip: true,
					maxRotation: 45,
					minRotation: 0
				}
			},
			y: {
				stacked: data.stacked,
				beginAtZero: data.beginAtZero,
				title: {
					display: data.yLabel !== '',
					text: data.yLabel
				}
			}
		};
	}

	return {
		type: data.type,
		data: {
			labels: data.labels,
			datasets
		},
		options
	};
}

function createErrorElement(document, options) {
	const element = document.createElement('div');
	element.className = 'base3-chatbot-chart base3-chatbot-chart-error';
	element.setAttribute('role', 'alert');
	element.textContent = getString(options, 'renderError', 'Chart could not be rendered.');
	return element;
}

async function renderCodeBlock(context, state, code) {
	if (!code || code.dataset?.base3ChartState) {
		return;
	}

	const container = code.parentElement;
	if (!container || typeof container.replaceWith !== 'function') {
		return;
	}

	code.dataset.base3ChartState = 'rendering';
	const document = code.ownerDocument || getDocument(context);

	try {
		const data = parseChart(code);
		const Chart = await resolveChart(context, state.options);
		if (state.destroyed || code.isConnected === false) {
			return;
		}

		const host = document.createElement('div');
		host.className = 'base3-chatbot-chart';
		host.setAttribute('role', 'img');
		host.setAttribute('aria-label', data.title || getString(state.options, 'ariaTemplate', '{type} chart', { type: data.type }));
		const canvas = document.createElement('canvas');
		host.appendChild(canvas);
		container.replaceWith(host);

		try {
			const chart = new Chart(canvas, createChartConfiguration(data));
			state.charts.add(chart);
		}
		catch (error) {
			host.replaceWith(createErrorElement(document, state.options));
			throw error;
		}
	}
	catch (error) {
		if (state.destroyed) {
			return;
		}
		if (code.isConnected !== false) {
			container.replaceWith(createErrorElement(document, state.options));
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

export const ChartPlugin = {
	name: 'charts',

	install(context) {
		this.states ??= new WeakMap();

		const state = {
			charts: new Set(),
			destroyed: false,
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
		state.charts.forEach((chart) => {
			if (chart && typeof chart.destroy === 'function') {
				chart.destroy();
			}
		});
		state.charts.clear();
		this.states.delete(context.chatbot);
	}
};
