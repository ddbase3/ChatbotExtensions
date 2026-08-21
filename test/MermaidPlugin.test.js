import assert from 'node:assert/strict';
import test from 'node:test';
import { MermaidPlugin } from '../assets/chatbot/MermaidPlugin.js';

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
		this.innerHTML = '';
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
		if (selector === 'style[data-base3-chatbot-mermaid-styles]') {
			return this.children.find((child) => child.tagName === 'STYLE'
				&& child.attributes.has('data-base3-chatbot-mermaid-styles')) || null;
		}
		return null;
	}

	querySelectorAll() {
		return [];
	}

	replaceWith(element) {
		this.replacement = element;
		this.isConnected = false;
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

function createCodeBlock(document, source) {
	const container = new FakeElement('pre', document);
	const code = new FakeElement('code', document);
	code.textContent = source;
	code.parentElement = container;
	return { container, code };
}

function createContent(document, blocks) {
	const content = new FakeElement('div', document);
	content.querySelectorAll = (selector) => selector === 'pre > code.language-mermaid'
		? blocks.map((block) => block.code)
		: [];
	return content;
}

function createContext(mermaid) {
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
				return { scriptUrl: '/assets/mermaid/mermaid.min.js' };
			},
			resolveGlobal(path) {
				return path === 'mermaid' ? mermaid : null;
			}
		}
	};
}

async function flushAsyncWork(iterations = 8) {
	for (let index = 0; index < iterations; index += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

test('mermaid plugin renders completed blocks with unchanged line breaks', async () => {
	const calls = [];
	let boundHost = null;
	const mermaid = {
		initialize(options) {
			calls.push(['initialize', options]);
		},
		async render(id, source) {
			calls.push(['render', id, source]);
			return {
				svg: '<svg viewBox="0 0 100 50"></svg>',
				bindFunctions(host) {
					boundHost = host;
				}
			};
		}
	};
	const setup = createContext(mermaid);
	const block = createCodeBlock(setup.document, 'graph TD\r\n    A --> B\r\n    B --> C');
	const content = createContent(setup.document, [block]);

	MermaidPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		rawText: '```mermaid\ngraph TD\n    A --> B\n    B --> C\n```',
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	assert.equal(calls[0][0], 'initialize');
	assert.deepEqual(calls[0][1], {
		startOnLoad: false,
		securityLevel: 'strict'
	});
	assert.equal(calls[1][0], 'render');
	assert.equal(calls[1][2], 'graph TD\n    A --> B\n    B --> C');
	assert.match(calls[1][1], /^base3-chatbot-mermaid-/);
	assert.ok(block.container.replacement);
	assert.equal(block.container.replacement.className, 'base3-chatbot-mermaid');
	assert.equal(block.container.replacement.innerHTML, '<svg viewBox="0 0 100 50"></svg>');
	assert.equal(block.container.replacement.attributes.get('role'), 'img');
	assert.equal(boundHost, block.container.replacement);
	assert.ok(setup.root.querySelector('style[data-base3-chatbot-mermaid-styles]'));
	assert.deepEqual(setup.errors, []);

	MermaidPlugin.destroy(setup.context);
});

test('mermaid plugin serializes multiple render operations', async () => {
	let active = 0;
	let maximumActive = 0;
	const sources = [];
	const ids = [];
	const mermaid = {
		initialize() {},
		async render(id, source) {
			ids.push(id);
			sources.push(source);
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			await new Promise((resolve) => setImmediate(resolve));
			active -= 1;
			return { svg: `<svg data-source="${source}"></svg>` };
		}
	};
	const setup = createContext(mermaid);
	const first = createCodeBlock(setup.document, 'flowchart LR\n    A --> B');
	const second = createCodeBlock(setup.document, 'sequenceDiagram\n    A->>B: Hello');
	const content = createContent(setup.document, [first, second]);

	MermaidPlugin.install(setup.context);
	setup.events.emit('message:hydrated', {
		role: 'assistant',
		content,
		error: false
	});
	await flushAsyncWork(12);

	assert.equal(maximumActive, 1);
	assert.deepEqual(sources, [
		'flowchart LR\n    A --> B',
		'sequenceDiagram\n    A->>B: Hello'
	]);
	assert.equal(new Set(ids).size, 2);
	assert.ok(first.container.replacement);
	assert.ok(second.container.replacement);

	MermaidPlugin.destroy(setup.context);
});

test('mermaid plugin unwraps fenced and JSON-wrapped source', async () => {
	const sources = [];
	const mermaid = {
		initialize() {},
		async render(id, source) {
			sources.push(source);
			return { svg: '<svg></svg>' };
		}
	};
	const setup = createContext(mermaid);
	const first = createCodeBlock(setup.document, '```mermaid\nflowchart TD\n    A --> B\n```');
	const second = createCodeBlock(setup.document, JSON.stringify({ code: 'sequenceDiagram\n    A->>B: Hello' }));
	const content = createContent(setup.document, [first, second]);

	MermaidPlugin.install(setup.context);
	setup.events.emit('message:completed', { content, interaction: false, error: false });
	await flushAsyncWork();

	assert.deepEqual(sources, [
		'flowchart TD\n    A --> B',
		'sequenceDiagram\n    A->>B: Hello'
	]);
	assert.deepEqual(setup.errors, []);
	MermaidPlugin.destroy(setup.context);
});

test('mermaid plugin shows parser errors inside the message', async () => {
	const parseError = new Error('Parse error on line 2');
	const mermaid = {
		initialize() {},
		async render() {
			throw parseError;
		}
	};
	const setup = createContext(mermaid);
	const block = createCodeBlock(setup.document, 'graph TD\n    A -- B');
	const content = createContent(setup.document, [block]);

	MermaidPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	assert.ok(block.container.replacement);
	assert.match(block.container.replacement.className, /base3-chatbot-mermaid-error/);
	assert.equal(block.container.replacement.children[0].textContent, 'Mermaid diagram could not be rendered.');
	assert.equal(block.container.replacement.children[1].textContent, 'Parse error on line 2');
	assert.equal(block.container.replacement.children[2].children[2].children[0].textContent, '```mermaid\ngraph TD\n    A -- B\n```');
	assert.deepEqual(setup.errors, [parseError]);

	MermaidPlugin.destroy(setup.context);
});

test('mermaid plugin ignores user and interaction messages', async () => {
	let renderCount = 0;
	const mermaid = {
		initialize() {},
		async render() {
			renderCount += 1;
			return { svg: '<svg></svg>' };
		}
	};
	const setup = createContext(mermaid);
	const block = createCodeBlock(setup.document, 'graph TD\n    A --> B');
	const content = createContent(setup.document, [block]);

	MermaidPlugin.install(setup.context);
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

	assert.equal(renderCount, 0);
	assert.equal(block.container.replacement, null);

	MermaidPlugin.destroy(setup.context);
});
