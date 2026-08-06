import assert from 'node:assert/strict';
import test from 'node:test';
import { CodeFormattingPlugin } from '../assets/chatbot/CodeFormattingPlugin.js';

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

function createContext() {
	return {
		chatbot: {},
		events: new EventBus(),
		root: {
			querySelector() {
				return {};
			}
		}
	};
}

function createContent(value, selector = 'pre > code.language-json') {
	const code = { textContent: value };
	return {
		code,
		querySelectorAll(requestedSelector) {
			return requestedSelector === selector ? [code] : [];
		}
	};
}

test('code formatting plugin pretty-prints completed JSON code blocks', () => {
	const context = createContext();
	const content = createContent('{"name":"example","items":[1,2,3]}');

	CodeFormattingPlugin.install(context);
	context.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});

	assert.equal(content.code.textContent, `{
  "name": "example",
  "items": [
    1,
    2,
    3
  ]
}`);

	CodeFormattingPlugin.destroy(context);
});

test('code formatting plugin leaves invalid JSON unchanged', () => {
	const context = createContext();
	const content = createContent('{"name":');

	CodeFormattingPlugin.install(context);
	context.events.emit('message:completed', {
		content,
		interaction: false,
		error: false
	});

	assert.equal(content.code.textContent, '{"name":');
	CodeFormattingPlugin.destroy(context);
});

test('code formatting plugin formats restored assistant messages only', () => {
	const context = createContext();
	const assistant = createContent('{"ok":true}');
	const user = createContent('{"ok":false}');

	CodeFormattingPlugin.install(context);
	context.events.emit('message:hydrated', {
		role: 'assistant',
		content: assistant,
		error: false
	});
	context.events.emit('message:hydrated', {
		role: 'user',
		content: user,
		error: false
	});

	assert.equal(assistant.code.textContent, '{\n  "ok": true\n}');
	assert.equal(user.code.textContent, '{"ok":false}');
	CodeFormattingPlugin.destroy(context);
});
