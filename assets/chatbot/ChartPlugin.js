const pendingScripts = new Map();

const STYLE_ATTRIBUTE = 'data-base3-chatbot-chart-styles';
const BLOCK_SELECTOR = 'pre > code.language-base3-chart';
const ALLOWED_TYPES = new Set(['bar', 'line', 'pie', 'doughnut']);

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
	if (value === undefined || value === null || value === '') {
		return fallback;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true') return true;
		if (normalized === 'false') return false;
	}
	throw new Error(`${label} must be boolean.`);
}

function normalizeLabels(value) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
		throw new Error('Chart labels must contain between 1 and 100 entries.');
	}
	return value.map((label, index) => {
		if (typeof label === 'number' && Number.isFinite(label)) return String(label);
		if (typeof label === 'boolean') return label ? 'true' : 'false';
		return normalizeText(label, `Chart label ${index + 1}`, 200, true);
	});
}

function normalizeNumber(value, label) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string') {
		const source = value.trim();
		if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(source)) {
			const number = Number(source);
			if (Number.isFinite(number)) return number;
		}
	}
	throw new Error(`${label} must be a finite number.`);
}

function normalizeDatasets(value, labelCount) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 6) {
		throw new Error('Chart datasets must contain between 1 and 6 entries.');
	}

	return value.map((dataset, datasetIndex) => {
		if (!isObject(dataset)) {
			throw new Error(`Chart dataset ${datasetIndex + 1} must be an object.`);
		}

		const label = normalizeText(dataset.label, `Chart dataset ${datasetIndex + 1} label`, 120, true);
		if (!Array.isArray(dataset.data) || dataset.data.length !== labelCount) {
			throw new Error(`Chart dataset ${datasetIndex + 1} must contain exactly ${labelCount} values.`);
		}

		const data = dataset.data.map((value, valueIndex) => normalizeNumber(
			value,
			`Chart dataset ${datasetIndex + 1} value ${valueIndex + 1}`
		));

		return { label, data };
	});
}

function normalizeFencedSource(source) {
	const normalized = String(source || '').replace(/\r\n?/g, '\n').trim();
	const match = normalized.match(/^```([^\n`]*)\n([\s\S]*?)\n```$/);
	if (!match) return normalized;

	const language = String(match[1] || '').trim().toLowerCase();
	if (language === '' || language === 'json' || language === 'base3-chart') {
		return match[2].trim();
	}
	return normalized;
}

function parseJsonValue(source) {
	let value;
	try {
		value = JSON.parse(source);
	}
	catch (error) {
		throw new Error(`Chart block contains invalid JSON: ${error.message}`);
	}

	if (typeof value === 'string') {
		const nested = value.trim();
		if (nested.startsWith('{') && nested.endsWith('}')) {
			try {
				value = JSON.parse(nested);
			}
			catch (error) {
				throw new Error(`Chart block contains invalid nested JSON: ${error.message}`);
			}
		}
	}
	return value;
}

function parseChart(code) {
	const source = normalizeFencedSource(code?.textContent || '');
	if (!source) {
		throw new Error('Chart block is empty.');
	}

	const value = parseJsonValue(source);
	if (!isObject(value)) {
		throw new Error('Chart block must contain one JSON object.');
	}

	const wrappedData = isObject(value.data) ? value.data : null;
	const rawType = normalizeText(value.type, 'Chart type', 20, true).toLowerCase();
	const type = rawType === 'donut' ? 'doughnut' : rawType;
	if (!ALLOWED_TYPES.has(type)) {
		throw new Error('Chart type must be bar, line, pie, or doughnut.');
	}

	const labels = normalizeLabels(value.labels ?? wrappedData?.labels);
	const datasets = normalizeDatasets(value.datasets ?? wrappedData?.datasets, labels.length);
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
		xLabel: normalizeText(value.x_label ?? value.xLabel, 'Chart x-axis label', 120),
		yLabel: normalizeText(value.y_label ?? value.yLabel, 'Chart y-axis label', 120),
		beginAtZero: normalizeBoolean(value.begin_at_zero ?? value.beginAtZero, 'Chart begin_at_zero', false),
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

function copyText(document, text) {
	if (globalThis.navigator?.clipboard && typeof globalThis.navigator.clipboard.writeText === 'function') {
		return globalThis.navigator.clipboard.writeText(text);
	}
	if (!document?.body || typeof document.execCommand !== 'function') {
		return Promise.reject(new Error('Clipboard API is unavailable.'));
	}

	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	textarea.select();
	const copied = document.execCommand('copy');
	textarea.remove();
	return copied ? Promise.resolve() : Promise.reject(new Error('Copy command failed.'));
}

function appendErrorDetails(element, document, error, source, options) {
	const message = String(error?.message || error || '').trim();
	if (message) {
		const reason = document.createElement('div');
		reason.className = 'base3-chatbot-extension-error-reason';
		reason.textContent = message;
		element.appendChild(reason);
	}
	if (!source) return;

	const details = document.createElement('details');
	details.className = 'base3-chatbot-extension-error-details';
	const summary = document.createElement('summary');
	summary.textContent = getString(options, 'renderDetails', 'Technical details');
	details.appendChild(summary);

	const label = document.createElement('div');
	label.textContent = getString(options, 'renderGeneratedCode', 'Generated extension code');
	details.appendChild(label);

	const pre = document.createElement('pre');
	const code = document.createElement('code');
	code.textContent = source;
	pre.appendChild(code);
	details.appendChild(pre);

	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = getString(options, 'renderCopyCode', 'Copy generated code');
	if (typeof button.addEventListener === 'function') {
		button.addEventListener('click', () => {
			copyText(document, source).then(() => {
				button.textContent = getString(options, 'renderCopiedCode', 'Copied');
			}).catch(() => {
				button.textContent = getString(options, 'renderCopyFailed', 'Copy failed');
			});
		});
	}
	details.appendChild(button);
	element.appendChild(details);
}

function createErrorElement(document, error, source, options) {
	const element = document.createElement('div');
	element.className = 'base3-chatbot-chart base3-chatbot-chart-error';
	element.setAttribute('role', 'alert');

	const title = document.createElement('div');
	title.textContent = getString(options, 'renderError', 'Chart.js chart could not be rendered.');
	element.appendChild(title);
	appendErrorDetails(element, document, error, source, options);
	return element;
}

async function renderCodeBlock(context, state, code) {
	if (!code || code.dataset?.base3ChartState) return;

	const container = code.parentElement;
	if (!container || typeof container.replaceWith !== 'function') return;

	const source = String(code.textContent || '').replace(/\r\n?/g, '\n').trim();
	const diagnosticSource = `\`\`\`base3-chart\n${source}\n\`\`\``;
	code.dataset.base3ChartState = 'rendering';
	const document = code.ownerDocument || getDocument(context);
	let host = null;

	try {
		const data = parseChart(code);
		const Chart = await resolveChart(context, state.options);
		if (state.destroyed || code.isConnected === false) return;

		host = document.createElement('div');
		host.className = 'base3-chatbot-chart';
		host.setAttribute('role', 'img');
		host.setAttribute('aria-label', data.title || getString(state.options, 'ariaTemplate', '{type} chart', { type: data.type }));
		const canvas = document.createElement('canvas');
		host.appendChild(canvas);
		container.replaceWith(host);

		const chart = new Chart(canvas, createChartConfiguration(data));
		state.charts.add(chart);
	}
	catch (error) {
		if (state.destroyed) return;
		const errorElement = createErrorElement(document, error, diagnosticSource, state.options);
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
