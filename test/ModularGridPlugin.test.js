import assert from 'node:assert/strict';
import test from 'node:test';
import { ModularGridPlugin } from '../assets/chatbot/ModularGridPlugin.js';
import * as fixtureModule from './fixtures/FakeModularGridModule.js';

const moduleUrl = new URL('./fixtures/FakeModularGridModule.js', import.meta.url).href;

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
		if (selector === 'style[data-base3-chatbot-grid-styles]') {
			return this.children.find((child) => child.tagName === 'STYLE'
				&& child.attributes.has('data-base3-chatbot-grid-styles')) || null;
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
	content.querySelectorAll = (selector) => selector === 'pre > code.language-base3-table'
		? blocks.map((block) => block.code)
		: [];
	return content;
}

function createContext(pluginOptions = {}) {
	fixtureModule.instances.length = 0;
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
				return {
					moduleUrl,
					styleUrl: '/assets/modulargrid/styles/modulargrid.css',
					...pluginOptions
				};
			}
		}
	};
}

async function flushAsyncWork(iterations = 40) {
	for (let index = 0; index < iterations; index += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

test('modular grid plugin renders a completed searchable and pageable table', async () => {
	const setup = createContext();
	const block = createCodeBlock(setup.document, {
		title: 'Project tasks',
		columns: [
			{ key: 'task', label: 'Task' },
			{ key: 'owner', label: 'Owner' },
			{ key: 'status', label: 'Status', sortable: false }
		],
		rows: [
			{ task: 'Analysis', owner: 'Anna', status: 'Done' },
			{ task: 'Implementation', owner: 'Ben', status: 'In progress' }
		],
		search: true,
		paging: true,
		page_size: 10
	});
	const content = createContent(setup.document, [block]);

	ModularGridPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	const instances = fixtureModule.instances;
	assert.equal(instances.length, 1);
	const grid = instances[0];
	assert.equal(grid.initialized, true);
	assert.equal(grid.options.adapter.rows.length, 2);
	assert.deepEqual(grid.options.columns.map((column) => column.key), ['task', 'owner', 'status']);
	assert.equal(grid.options.columns[2].sortable, false);
	assert.deepEqual(grid.options.plugins.map((plugin) => plugin.name), ['search', 'pageSize', 'info', 'paging']);
	assert.equal(grid.options.features.paging, true);
	assert.equal(grid.options.pageSize, 10);
	assert.equal(grid.options.table.resizableColumns, false);
	assert.ok(block.container.replacement);
	assert.equal(block.container.replacement.className, 'base3-chatbot-grid');
	assert.equal(block.container.replacement.attributes.get('role'), 'region');
	assert.equal(block.container.replacement.attributes.get('aria-label'), 'Project tasks');
	assert.equal(block.container.replacement.children[0].textContent, 'Project tasks');
	assert.ok(setup.root.querySelector('style[data-base3-chatbot-grid-styles]'));
	assert.equal(setup.document.head.children.length, 1);
	assert.equal(setup.document.head.children[0].href, 'https://example.test/assets/modulargrid/styles/modulargrid.css');
	assert.deepEqual(setup.errors, []);

	ModularGridPlugin.destroy(setup.context);
	assert.equal(grid.destroyed, true);
});

test('modular grid plugin forwards configured localized strings', async () => {
	const setup = createContext({
		strings: {
			search: 'Suchen',
			searchPlaceholder: 'Tabelle durchsuchen',
			rowsPerPage: 'Zeilen pro Seite',
			clear: 'Löschen',
			previous: 'Zurück',
			next: 'Weiter',
			pageStatus: 'Seite {page} von {totalPages}',
			noRecords: 'Keine Datensätze',
			recordsRange: 'Datensätze {from} bis {to} von {total}',
			recordsRangeFiltered: 'Datensätze {from} bis {to} von {filteredTotal} (gefiltert aus {total})'
		}
	});
	const block = createCodeBlock(setup.document, {
		columns: [{ key: 'name', label: 'Name' }],
		rows: [{ name: 'Alpha' }],
		search: true,
		paging: true,
		page_size: 10
	});
	const content = createContent(setup.document, [block]);

	ModularGridPlugin.install(setup.context);
	setup.events.emit('message:completed', { content, interaction: false, error: false });
	await flushAsyncWork();

	const grid = fixtureModule.instances[0];
	assert.equal(grid.options.strings.search, 'Suchen');
	assert.equal(grid.options.strings.searchPlaceholder, 'Tabelle durchsuchen');
	assert.equal(grid.options.strings.previous, 'Zurück');
	assert.equal(grid.options.strings.recordsRange, 'Datensätze {from} bis {to} von {total}');

	ModularGridPlugin.destroy(setup.context);
});

test('modular grid plugin renders restored tables without search or paging', async () => {
	const setup = createContext();
	const block = createCodeBlock(setup.document, {
		columns: [
			{ key: 'name', label: 'Name' },
			{ key: 'active', label: 'Active' }
		],
		rows: [
			{ name: 'Alpha', active: true },
			{ name: 'Beta', active: false }
		],
		search: false,
		paging: false,
		page_size: 5
	});
	const content = createContent(setup.document, [block]);

	ModularGridPlugin.install(setup.context);
	setup.events.emit('message:hydrated', {
		role: 'assistant',
		content,
		error: false
	});
	await flushAsyncWork();

	const grid = fixtureModule.instances[0];
	assert.deepEqual(grid.options.plugins.map((plugin) => plugin.name), ['info']);
	assert.equal(grid.options.features.paging, false);
	assert.deepEqual(grid.options.layout.options.top, []);
	assert.deepEqual(grid.options.layout.options.bottom, ['footerInfo']);
	assert.deepEqual(grid.options.adapter.rows, [
		{ name: 'Alpha', active: true },
		{ name: 'Beta', active: false }
	]);
	assert.deepEqual(setup.errors, []);

	ModularGridPlugin.destroy(setup.context);
});

test('modular grid plugin rejects undeclared row keys and nested cell values', async () => {
	const setup = createContext();
	const undeclared = createCodeBlock(setup.document, {
		columns: [{ key: 'name', label: 'Name' }],
		rows: [{ name: 'Alpha', hidden: 'value' }]
	});
	const nested = createCodeBlock(setup.document, {
		columns: [{ key: 'name', label: 'Name' }],
		rows: [{ name: { text: 'Alpha' } }]
	});
	const content = createContent(setup.document, [undeclared, nested]);

	ModularGridPlugin.install(setup.context);
	setup.events.emit('opening-message:loaded', { element: content });
	await flushAsyncWork();

	assert.equal(fixtureModule.instances.length, 0);
	assert.equal(undeclared.container.replacement.textContent, 'Table could not be rendered.');
	assert.equal(nested.container.replacement.textContent, 'Table could not be rendered.');
	assert.equal(setup.errors.length, 2);
	assert.match(setup.errors[0].message, /undeclared column "hidden"/);
	assert.match(setup.errors[1].message, /plain text, a finite number, boolean, or null/);

	ModularGridPlugin.destroy(setup.context);
});

test('modular grid plugin rejects unsupported properties and invalid page sizes', async () => {
	const setup = createContext();
	const unsupported = createCodeBlock(setup.document, {
		columns: [{ key: 'name', label: 'Name', render: 'html' }],
		rows: [{ name: 'Alpha' }]
	});
	const pageSize = createCodeBlock(setup.document, {
		columns: [{ key: 'name', label: 'Name' }],
		rows: [{ name: 'Alpha' }],
		page_size: 25
	});
	const content = createContent(setup.document, [unsupported, pageSize]);

	ModularGridPlugin.install(setup.context);
	setup.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});
	await flushAsyncWork();

	assert.equal(fixtureModule.instances.length, 0);
	assert.equal(unsupported.container.replacement.textContent, 'Table could not be rendered.');
	assert.equal(pageSize.container.replacement.textContent, 'Table could not be rendered.');
	assert.equal(setup.errors.length, 2);
	assert.match(setup.errors[0].message, /unsupported property "render"/);
	assert.match(setup.errors[1].message, /must be 5, 10, 20, or 50/);

	ModularGridPlugin.destroy(setup.context);
});

test('modular grid plugin ignores user and interaction messages', async () => {
	const setup = createContext();
	const block = createCodeBlock(setup.document, {
		columns: [{ key: 'name', label: 'Name' }],
		rows: [{ name: 'Alpha' }]
	});
	const content = createContent(setup.document, [block]);

	ModularGridPlugin.install(setup.context);
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

	assert.equal(fixtureModule.instances.length, 0);
	assert.equal(block.container.replacement, null);

	ModularGridPlugin.destroy(setup.context);
});
