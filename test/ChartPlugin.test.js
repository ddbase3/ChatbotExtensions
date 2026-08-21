import assert from 'node:assert/strict';
import test from 'node:test';
import { ChartPlugin } from '../assets/chatbot/ChartPlugin.js';

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
		if (selector === 'style[data-base3-chatbot-chart-styles]') {
			return this.children.find((child) => child.tagName === 'STYLE'
				&& child.attributes.has('data-base3-chatbot-chart-styles')) || null;
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
		this.head = new FakeElement('head', this);
	}

	createElement(tagName) {
		return new FakeElement(tagName, this);
	}

	querySelectorAll() {
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
	content.querySelectorAll = (selector) => selector === 'pre > code.language-base3-chart'
		? blocks.map((block) => block.code)
		: [];
	return content;
}

function createContext(Chart) {
	const document = new FakeDocument();
	const root = new FakeElement('section', document);
	const events = new EventBus();
	const errors = [];
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
		context: {
			chatbot: {},
			root,
			events,
			getPluginOptions() {
				return { scriptUrl: '/assets/chart/chart.js' };
			},
			resolveGlobal(path) {
				return path === 'Chart' ? Chart : null;
			}
		}
	};
}

async function flushAsyncWork(iterations = 8) {
	for (let index = 0; index < iterations; index += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

test('chart plugin renders a completed bar chart through restricted configuration', async () => {
	const instances = [];
	class FakeChart {
		constructor(canvas, configuration) {
			this.canvas = canvas;
			this.configuration = configuration;
			this.destroyed = false;
			instances.push(this);
		}

		destroy() {
			this.destroyed = true;
		}
	}

	const setup = createContext(FakeChart);
	const block = createCodeBlock(setup.document, {
		type: 'bar',
		title: 'Quarterly revenue',
		labels: ['Q1', 'Q2', 'Q3', 'Q4'],
		datasets: [{ label: 'Revenue', data: [120000, 145000, 138000, 171000] }],
		x_label: 'Quarter',
		y_label: 'Revenue',
		begin_at_zero: true,
		stacked: false
	});
	const content = createContent(setup.document, [block]);

	ChartPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	assert.equal(instances.length, 1);
	const chart = instances[0];
	assert.equal(chart.canvas.tagName, 'CANVAS');
	assert.deepEqual(chart.configuration.data.labels, ['Q1', 'Q2', 'Q3', 'Q4']);
	assert.deepEqual(chart.configuration.data.datasets, [{
		label: 'Revenue',
		data: [120000, 145000, 138000, 171000]
	}]);
	assert.equal(chart.configuration.type, 'bar');
	assert.equal(chart.configuration.options.scales.y.beginAtZero, true);
	assert.equal(chart.configuration.options.scales.x.title.text, 'Quarter');
	assert.equal(chart.configuration.options.plugins.title.text, 'Quarterly revenue');
	assert.equal(Object.prototype.hasOwnProperty.call(chart.configuration, 'plugins'), false);
	assert.ok(block.container.replacement);
	assert.equal(block.container.replacement.className, 'base3-chatbot-chart');
	assert.equal(block.container.replacement.attributes.get('role'), 'img');
	assert.equal(block.container.replacement.attributes.get('aria-label'), 'Quarterly revenue');
	assert.ok(setup.root.querySelector('style[data-base3-chatbot-chart-styles]'));
	assert.deepEqual(setup.errors, []);

	ChartPlugin.destroy(setup.context);
	assert.equal(chart.destroyed, true);
});

test('chart plugin renders restored line charts and adds only fixed line options', async () => {
	const configurations = [];
	class FakeChart {
		constructor(canvas, configuration) {
			configurations.push(configuration);
		}
		destroy() {}
	}

	const setup = createContext(FakeChart);
	const block = createCodeBlock(setup.document, {
		type: 'line',
		labels: ['Jan', 'Feb', 'Mar'],
		datasets: [
			{ label: 'Product A', data: [12, 18, 15] },
			{ label: 'Product B', data: [9, 14, 17] }
		]
	});
	const content = createContent(setup.document, [block]);

	ChartPlugin.install(setup.context);
	setup.events.emit('message:hydrated', {
		role: 'assistant',
		content,
		error: false
	});
	await flushAsyncWork();

	assert.equal(configurations.length, 1);
	assert.equal(configurations[0].data.datasets[0].fill, false);
	assert.equal(configurations[0].data.datasets[0].tension, 0.25);
	assert.equal(configurations[0].options.plugins.legend.display, true);
	assert.deepEqual(setup.errors, []);

	ChartPlugin.destroy(setup.context);
});

test('chart plugin tolerates native Chart.js wrappers and styling without forwarding them', async () => {
	const configurations = [];
	class FakeChart {
		constructor(canvas, configuration) {
			configurations.push(configuration);
		}
		destroy() {}
	}

	const setup = createContext(FakeChart);
	const block = createCodeBlock(setup.document, {
		type: 'bar',
		data: {
			labels: ['A', 2026],
			datasets: [{
				label: 'Value',
				data: ['1', '2.5'],
				backgroundColor: 'red',
				borderColor: 'blue'
			}]
		},
		options: { plugins: { legend: { display: false } } },
		xLabel: 'Category',
		beginAtZero: 'true'
	});
	const content = createContent(setup.document, [block]);

	ChartPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	assert.equal(configurations.length, 1);
	assert.deepEqual(configurations[0].data.labels, ['A', '2026']);
	assert.deepEqual(configurations[0].data.datasets, [{ label: 'Value', data: [1, 2.5] }]);
	assert.equal(configurations[0].options.scales.x.title.text, 'Category');
	assert.equal(configurations[0].options.scales.y.beginAtZero, true);
	assert.equal(Object.prototype.hasOwnProperty.call(configurations[0].data.datasets[0], 'backgroundColor'), false);
	assert.deepEqual(setup.errors, []);

	ChartPlugin.destroy(setup.context);
});

test('chart plugin enforces matching dataset lengths and one dataset for pie charts', async () => {
	let chartCount = 0;
	class FakeChart {
		constructor() {
			chartCount += 1;
		}
	}

	const setup = createContext(FakeChart);
	const first = createCodeBlock(setup.document, {
		type: 'bar',
		labels: ['A', 'B'],
		datasets: [{ label: 'Value', data: [1] }]
	});
	const second = createCodeBlock(setup.document, {
		type: 'pie',
		labels: ['A', 'B'],
		datasets: [
			{ label: 'First', data: [1, 2] },
			{ label: 'Second', data: [3, 4] }
		]
	});
	const content = createContent(setup.document, [first, second]);

	ChartPlugin.install(setup.context);
	setup.events.emit('opening-message:loaded', { element: content });
	await flushAsyncWork();

	assert.equal(chartCount, 0);
	assert.equal(first.container.replacement.children[0].textContent, 'Chart.js chart could not be rendered.');
	assert.match(first.container.replacement.children[1].textContent, /exactly 2 values/);
	assert.equal(second.container.replacement.children[0].textContent, 'Chart.js chart could not be rendered.');
	assert.match(second.container.replacement.children[1].textContent, /exactly one dataset/);
	assert.match(first.container.replacement.children[2].children[2].children[0].textContent, /^```base3-chart/);
	assert.match(first.container.replacement.children[2].children[2].children[0].textContent, /\"labels\":\[\"A\",\"B\"\]/);
	assert.equal(setup.errors.length, 2);
	assert.match(setup.errors[0].message, /exactly 2 values/);
	assert.match(setup.errors[1].message, /exactly one dataset/);

	ChartPlugin.destroy(setup.context);
});

test('chart plugin ignores user and interaction messages', async () => {
	let chartCount = 0;
	class FakeChart {
		constructor() {
			chartCount += 1;
		}
	}

	const setup = createContext(FakeChart);
	const block = createCodeBlock(setup.document, {
		type: 'bar',
		labels: ['A'],
		datasets: [{ label: 'Value', data: [1] }]
	});
	const content = createContent(setup.document, [block]);

	ChartPlugin.install(setup.context);
	setup.events.emit('message:hydrated', {
		role: 'user',
		content,
		error: false
	});
	setup.events.emit('message:completed', {
		content,
		interaction: true,
		error: false
	});
	await flushAsyncWork();

	assert.equal(chartCount, 0);
	assert.equal(block.container.replacement, null);

	ChartPlugin.destroy(setup.context);
});
