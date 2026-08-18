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

	addEventListener() {}
}

class FakeDocument {
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
