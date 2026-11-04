import assert from 'node:assert/strict';
import test from 'node:test';
import {
	AccordionPlugin,
	CalloutPlugin,
	DataDownloadPlugin,
	KpiCardsPlugin,
	ProgressPlugin,
	TimelinePlugin
} from '../assets/chatbot/StructuredContentPlugins.js';

class FakeElement {
	constructor(tagName = 'div') {
		this.tagName = tagName.toUpperCase();
		this.children = [];
		this.attributes = new Map();
		this.className = '';
		this.textContent = '';
		this.parentElement = null;
		this.listeners = new Map();
		this.style = {};
	}

	appendChild(child) {
		this.children.push(child);
		child.parentElement = this;
		return child;
	}

	append(...children) {
		children.forEach((child) => this.appendChild(child));
	}

	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}

	addEventListener(name, listener) {
		this.listeners.set(name, listener);
	}

	click() {
		this.listeners.get('click')?.();
	}

	select() {}

	remove() {
		if (this.parentElement) {
			this.parentElement.children = this.parentElement.children.filter((element) => element !== this);
		}
	}
}

class FakeDocument {
	constructor() {
		this.body = new FakeElement('body');
	}

	createElement(tagName) {
		return new FakeElement(tagName);
	}
}

function createContext(blockLanguage, payload, executeCommand = null) {
	const listeners = new Map();
	const commands = [];
	const document = new FakeDocument();
	let replacement = null;
	const container = {
		replaceWith(element) {
			replacement = element;
		}
	};
	const code = {
		textContent: JSON.stringify(payload),
		ownerDocument: document,
		parentElement: container
	};
	const content = {
		ownerDocument: document,
		querySelectorAll(selector) {
			return selector === `pre > code.language-${blockLanguage}` ? [code] : [];
		}
	};
	const root = new FakeElement('section');
	root.ownerDocument = document;
	root.querySelector = () => null;
	const context = {
		chatbot: {},
		root,
		getPluginOptions() {
			return {};
		},
		commands: {
			execute(name, commandPayload) {
				commands.push({ name, payload: commandPayload });
				if (typeof executeCommand === 'function') {
					return executeCommand(name, commandPayload, document);
				}
				return new FakeElement('fragment');
			}
		},
		events: {
			on(name, listener) {
				listeners.set(name, listener);
				return () => listeners.delete(name);
			},
			emit(name, error) {
				throw error;
			}
		}
	};
	return {
		context,
		listeners,
		content,
		code,
		document,
		getCommands: () => commands,
		getReplacement: () => replacement
	};
}

function completeMessage(setup) {
	setup.listeners.get('message:completed')({
		content: setup.content,
		error: false,
		interaction: false
	});
	return setup.getReplacement();
}

function assertMarkdownCommand(command, markdown) {
	assert.equal(command.name, 'markdown:render-fragment');
	assert.equal(command.payload.markdown, markdown);
	assert.equal(command.payload.allowExtensionBlocks, false);
}

test('structured plugins expose one independently installable plugin per capability', () => {
	assert.deepEqual([
		CalloutPlugin.name,
		KpiCardsPlugin.name,
		ProgressPlugin.name,
		TimelinePlugin.name,
		AccordionPlugin.name,
		DataDownloadPlugin.name
	], [
		'callouts',
		'kpi-cards',
		'progress',
		'timeline',
		'accordions',
		'data-downloads'
	]);
});

test('callout plugin renders body Markdown while keeping the title plain text', () => {
	const markdown = '**Check the source data.**\n\n- Confirm date\n- Confirm owner';
	const setup = createContext('base3-callout', {
		type: 'warning',
		title: '**Attention**',
		text: markdown
	});

	CalloutPlugin.install(setup.context);
	const replacement = completeMessage(setup);
	const commands = setup.getCommands();

	assert.ok(replacement);
	assert.match(replacement.className, /base3-chatbot-callout-warning/);
	assert.equal(replacement.children[0].textContent, '**Attention**');
	assert.equal(replacement.children[1].className, 'base3-chatbot-callout-text');
	assert.equal(commands.length, 1);
	assertMarkdownCommand(commands[0], markdown);
	CalloutPlugin.destroy(setup.context);
});

test('KPI cards render explanatory detail as Markdown and compact values as plain text', () => {
	const markdown = 'Compared with **last month**';
	const setup = createContext('base3-kpi', {
		items: [{
			label: '**Active users**',
			value: '1,240',
			change: '+8%',
			detail: markdown
		}]
	});

	KpiCardsPlugin.install(setup.context);
	const replacement = completeMessage(setup);
	const card = replacement.children[0];
	const commands = setup.getCommands();

	assert.equal(card.children[0].textContent, '**Active users**');
	assert.equal(card.children[1].textContent, '1,240');
	assert.equal(card.children[2].textContent, '+8%');
	assert.equal(card.children[3].className, 'base3-chatbot-kpi-detail');
	assert.equal(commands.length, 1);
	assertMarkdownCommand(commands[0], markdown);
	KpiCardsPlugin.destroy(setup.context);
});

test('progress keeps compact label text literal instead of interpreting Markdown', () => {
	const setup = createContext('base3-progress', {
		items: [{
			label: '**Implementation**',
			value: 55,
			max: 100,
			text: '**55% complete**'
		}]
	});

	ProgressPlugin.install(setup.context);
	const replacement = completeMessage(setup);
	const header = replacement.children[0].children[0];

	assert.equal(header.children[0].textContent, '**Implementation**');
	assert.equal(header.children[1].textContent, '**55% complete**');
	assert.equal(setup.getCommands().length, 0);
	ProgressPlugin.destroy(setup.context);
});

test('timeline renders milestone descriptions as Markdown and metadata as plain text', () => {
	const markdown = 'Build the first version.\n\n- Internal pilot\n- Feedback';
	const setup = createContext('base3-timeline', {
		items: [{
			date: 'Q1 **2026**',
			title: '**Prototype**',
			text: markdown,
			status: 'completed'
		}]
	});

	TimelinePlugin.install(setup.context);
	const replacement = completeMessage(setup);
	const row = replacement.children[0];
	const commands = setup.getCommands();

	assert.equal(row.children[0].textContent, 'Q1 **2026**');
	assert.equal(row.children[1].textContent, '**Prototype**');
	assert.equal(row.children[2].className, 'base3-chatbot-timeline-text');
	assert.equal(commands.length, 1);
	assertMarkdownCommand(commands[0], markdown);
	TimelinePlugin.destroy(setup.context);
});

test('accordion plugin renders item Markdown through the shared Markdown command', () => {
	let command = null;
	let commandPayload = null;
	const markdownFragment = new FakeElement('fragment');
	markdownFragment.appendChild(new FakeElement('p'));
	const setup = createContext('base3-accordion', {
		items: [{
			title: 'Installation',
			markdown: '**Requirements**\n\n- PHP 8.2',
			open: true
		}]
	}, (name, payload) => {
		command = name;
		commandPayload = payload;
		return markdownFragment;
	});

	AccordionPlugin.install(setup.context);
	const replacement = completeMessage(setup);
	const details = replacement.children[0];
	const content = details.children[1];

	assert.equal(command, 'markdown:render-fragment');
	assert.equal(commandPayload.markdown, '**Requirements**\n\n- PHP 8.2');
	assert.equal(commandPayload.allowExtensionBlocks, false);
	assert.equal(details.open, true);
	assert.equal(content.className, 'base3-chatbot-accordion-content');
	assert.equal(content.children[0], markdownFragment);
	AccordionPlugin.destroy(setup.context);
});

test('invalid structured blocks display the original source, an accessible error and diagnostics', () => {
	const cases = [
		[CalloutPlugin, 'base3-callout', { type: 'info', text: '' }, /Callout requires text/],
		[KpiCardsPlugin, 'base3-kpi', { items: [] }, /KPI cards requires between/],
		[KpiCardsPlugin, 'base3-kpi', { items: [{ label: 'Users' }] }, /Every KPI card requires label and value/],
		[ProgressPlugin, 'base3-progress', { items: [{ label: 'Tasks', value: 5, max: 4 }] }, /Every progress item requires/],
		[ProgressPlugin, 'base3-progress', { items: [{ label: 'Tasks', value: 0, max: 0 }] }, /Every progress item requires/],
		[TimelinePlugin, 'base3-timeline', { items: [{ title: '' }] }, /Every timeline item requires a title/],
		[AccordionPlugin, 'base3-accordion', { items: [{ title: 'Install', markdown: '' }] }, /Every accordion item requires/],
		[DataDownloadPlugin, 'base3-download', { format: 'pdf', content: 'unsupported' }, /Data download requires csv or json/],
		[DataDownloadPlugin, 'base3-download', { format: 'csv', content: {} }, /CSV download content must be a string/]
	];

	for (const [plugin, language, payload, reason] of cases) {
		const setup = createContext(language, payload);
		plugin.install(setup.context);
		assert.throws(() => completeMessage(setup), reason);
		const replacement = setup.getReplacement();
		assert.ok(replacement);
		assert.match(replacement.className, /base3-chatbot-extension-error/);
		assert.equal(replacement.attributes.get('role'), 'alert');
		assert.match(replacement.children[1].textContent, reason);
		const details = replacement.children[2];
		assert.equal(details.tagName, 'DETAILS');
		assert.equal(details.children[2].children[0].textContent, `\`\`\`${language}\n${JSON.stringify(payload)}\n\`\`\``);
		plugin.destroy(setup.context);
	}
});

test('structured plugin rejects empty, malformed, array and scalar input without losing diagnostics', () => {
	for (const source of ['', '{bad json', '[]', '42', 'null', '"text"']) {
		const setup = createContext('base3-callout', { text: 'unused' });
		setup.code.textContent = source;
		CalloutPlugin.install(setup.context);
		assert.throws(() => completeMessage(setup));
		assert.equal(setup.getReplacement().attributes.get('role'), 'alert');
		CalloutPlugin.destroy(setup.context);
	}
});

test('structured plugin accepts a fenced JSON object and a double-serialized object', () => {
	for (const source of [
		'```json\n{"type":"success","text":"All checks passed"}\n```',
		'```base3-callout\n{"type":"success","text":"All checks passed"}\n```',
		JSON.stringify(JSON.stringify({ type: 'success', text: 'All checks passed' }))
	]) {
		const setup = createContext('base3-callout', {});
		setup.code.textContent = source;
		CalloutPlugin.install(setup.context);
		const rendered = completeMessage(setup);
		assert.match(rendered.className, /base3-chatbot-callout-success/);
		assert.equal(rendered.children[0].className, 'base3-chatbot-callout-text');
		CalloutPlugin.destroy(setup.context);
	}
});

test('structured renderer ignores interaction messages and non-assistant hydrated messages', () => {
	const setup = createContext('base3-kpi', { items: [{ label: 'Users', value: '3' }] });
	KpiCardsPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, interaction: true, error: false });
	setup.listeners.get('message:completed')({ content: setup.content, interaction: false, error: true });
	setup.listeners.get('message:hydrated')({ content: setup.content, role: 'user', error: false });
	setup.listeners.get('message:hydrated')({ content: setup.content, role: 'assistant', error: true });
	assert.equal(setup.getReplacement(), null);
	setup.listeners.get('message:hydrated')({ content: setup.content, role: 'assistant', error: false });
	assert.ok(setup.getReplacement());
	KpiCardsPlugin.destroy(setup.context);
});

test('progress uses a numeric fallback and valid boundaries', () => {
	const setup = createContext('base3-progress', { items: [
		{ label: 'Start', value: 0, max: 10 },
		{ label: 'Complete', value: 10, max: 10 }
	] });
	ProgressPlugin.install(setup.context);
	const rendered = completeMessage(setup);
	assert.equal(rendered.children[0].children[0].children[1].textContent, '0/10');
	assert.equal(rendered.children[1].children[0].children[1].textContent, '10/10');
	assert.equal(rendered.children[1].children[1].value, 10);
	assert.equal(rendered.children[1].children[1].max, 10);
	assert.equal(rendered.children[0].children[1].attributes.get('aria-label'), 'Start');
	ProgressPlugin.destroy(setup.context);
});

test('data download sanitizes filenames and creates a local CSV or JSON blob on click', () => {
	for (const [payload, filename, mime] of [
		[{ filename: '../../report.csv', format: 'csv', content: 'a,b\n1,2' }, 'report.csv', 'text/csv;charset=utf-8'],
		[{ filename: 'subdir\\report', format: 'json', content: { count: 2 } }, 'report.json', 'application/json;charset=utf-8']
	]) {
		const setup = createContext('base3-download', payload);
		let createdBlob = null;
		let revoked = '';
		let clicked = null;
		setup.document.defaultView = {
			URL: {
				createObjectURL(blob) { createdBlob = blob; return 'blob:test'; },
				revokeObjectURL(url) { revoked = url; }
			},
			setTimeout(callback) { callback(); }
		};
		const originalCreateElement = setup.document.createElement.bind(setup.document);
		setup.document.createElement = (tagName) => {
			const node = originalCreateElement(tagName);
			if (tagName === 'a') node.click = () => { clicked = node; };
			return node;
		};
		DataDownloadPlugin.install(setup.context);
		const rendered = completeMessage(setup);
		const button = rendered.children[1];
		assert.equal(rendered.children[0].textContent, filename);
		assert.match(button.textContent, /Download/);
		button.click();
		assert.equal(createdBlob.type, mime);
		assert.equal(clicked.download, filename);
		assert.equal(clicked.href, 'blob:test');
		assert.equal(revoked, 'blob:test');
		assert.deepEqual(setup.document.body.children, []);
		DataDownloadPlugin.destroy(setup.context);
	}
});
