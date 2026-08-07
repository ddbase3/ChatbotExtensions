import assert from 'node:assert/strict';
import test from 'node:test';
import { RedirectPlugin } from '../assets/chatbot/RedirectPlugin.js';

function createElement(tagName) {
	return {
		tagName: tagName.toUpperCase(),
		className: '',
		href: '',
		textContent: '',
		children: [],
		appendChild(child) {
			this.children.push(child);
			return child;
		}
	};
}

function createSetup(payload, currentUrl = 'https://portal.example/current') {
	const listeners = new Map();
	const errors = [];
	let assignedUrl = null;
	let replacement = null;
	const document = {
		defaultView: {
			location: {
				href: currentUrl,
				assign(url) {
					assignedUrl = url;
				}
			}
		},
		createElement
	};
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
			return selector === 'pre > code.language-base3-redirect' ? [code] : [];
		}
	};
	const context = {
		chatbot: {},
		events: {
			on(name, listener) {
				listeners.set(name, listener);
				return () => listeners.delete(name);
			},
			emit(name, error) {
				if (name === 'chatbot:error') {
					errors.push(error);
				}
			}
		}
	};

	return {
		context,
		listeners,
		content,
		errors,
		getAssignedUrl: () => assignedUrl,
		getReplacement: () => replacement
	};
}

function assertRenderedLink(setup, expectedUrl, expectedLabel) {
	const replacement = setup.getReplacement();
	assert.ok(replacement);
	assert.equal(replacement.className, 'base3-chatbot-extension-block base3-chatbot-redirect');
	assert.equal(replacement.children.length, 1);
	assert.equal(replacement.children[0].tagName, 'A');
	assert.equal(replacement.children[0].href, expectedUrl);
	assert.equal(replacement.children[0].textContent, expectedLabel);
}

test('redirect plugin renders a labeled link and navigates a freshly completed message', () => {
	const setup = createSetup({ url: '/projects/dashboard?view=active#top', label: 'Project dashboard' });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: false });

	assertRenderedLink(setup, 'https://portal.example/projects/dashboard?view=active#top', 'Project dashboard');
	assert.equal(setup.getAssignedUrl(), 'https://portal.example/projects/dashboard?view=active#top');
	assert.deepEqual(setup.errors, []);
	RedirectPlugin.destroy(setup.context);
});

test('redirect plugin accepts an absolute URL on the current origin', () => {
	const setup = createSetup({ url: 'https://portal.example/settings/profile', label: 'Profile settings' });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: false });

	assertRenderedLink(setup, 'https://portal.example/settings/profile', 'Profile settings');
	assert.equal(setup.getAssignedUrl(), 'https://portal.example/settings/profile');
	RedirectPlugin.destroy(setup.context);
});

test('redirect plugin renders restored assistant messages as links without navigation', () => {
	const setup = createSetup({ url: '/projects/dashboard', label: 'Project dashboard' });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('message:hydrated')({ content: setup.content, role: 'assistant', error: false });

	assertRenderedLink(setup, 'https://portal.example/projects/dashboard', 'Project dashboard');
	assert.equal(setup.getAssignedUrl(), null);
	assert.deepEqual(setup.errors, []);
	RedirectPlugin.destroy(setup.context);
});

test('redirect plugin renders opening messages as links without navigation', () => {
	const setup = createSetup({ url: '/projects/dashboard', label: 'Project dashboard' });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('opening-message:loaded')({ element: setup.content });

	assertRenderedLink(setup, 'https://portal.example/projects/dashboard', 'Project dashboard');
	assert.equal(setup.getAssignedUrl(), null);
	RedirectPlugin.destroy(setup.context);
});

test('redirect plugin rejects external origins without rendering or navigating', () => {
	const setup = createSetup({ url: 'https://example.org/phishing', label: 'External page' });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: false });

	assert.equal(setup.getReplacement()?.className, 'base3-chatbot-error');
	assert.match(setup.getReplacement()?.textContent || '', /current origin/);
	assert.equal(setup.getAssignedUrl(), null);
	assert.equal(setup.errors.length, 1);
	assert.match(setup.errors[0].message, /current origin/);
	RedirectPlugin.destroy(setup.context);
});

test('redirect plugin requires a non-empty label', () => {
	const setup = createSetup({ url: '/projects/dashboard', label: '' });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: false });

	assert.equal(setup.getReplacement()?.className, 'base3-chatbot-error');
	assert.match(setup.getReplacement()?.textContent || '', /non-empty label/);
	assert.equal(setup.getAssignedUrl(), null);
	assert.equal(setup.errors.length, 1);
	assert.match(setup.errors[0].message, /non-empty label/);
	RedirectPlugin.destroy(setup.context);
});

test('redirect plugin rejects additional payload properties', () => {
	const setup = createSetup({ url: '/projects/dashboard', label: 'Project dashboard', extra: true });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: false });

	assert.equal(setup.getReplacement()?.className, 'base3-chatbot-error');
	assert.match(setup.getReplacement()?.textContent || '', /exactly url and label/);
	assert.equal(setup.getAssignedUrl(), null);
	assert.equal(setup.errors.length, 1);
	assert.match(setup.errors[0].message, /exactly url and label/);
	RedirectPlugin.destroy(setup.context);
});

test('redirect plugin ignores interaction messages', () => {
	const setup = createSetup({ url: '/projects/dashboard', label: 'Project dashboard' });

	RedirectPlugin.install(setup.context);
	setup.listeners.get('message:completed')({ content: setup.content, error: false, interaction: true });

	assert.equal(setup.getReplacement(), null);
	assert.equal(setup.getAssignedUrl(), null);
	RedirectPlugin.destroy(setup.context);
});
