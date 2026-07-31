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
		commands: {
			execute(name, commandPayload) {
				if (typeof executeCommand !== 'function') {
					throw new Error(`Unexpected command ${name}.`);
				}
				return executeCommand(name, commandPayload, document);
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
	return { context, listeners, content, getReplacement: () => replacement };
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

test('callout plugin replaces a completed structured block with safe DOM content', () => {
	const setup = createContext('base3-callout', {
		type: 'warning',
		title: 'Attention',
		text: 'Check the source data.'
	});

	CalloutPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: false });
	const replacement = setup.getReplacement();

	assert.ok(replacement);
	assert.match(replacement.className, /base3-chatbot-callout-warning/);
	assert.equal(replacement.children[0].textContent, 'Attention');
	assert.equal(replacement.children[1].textContent, 'Check the source data.');
	CalloutPlugin.destroy(setup.context);
});

test('accordion plugin renders item markdown through the shared markdown command', () => {
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
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: false });
	const replacement = setup.getReplacement();
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
