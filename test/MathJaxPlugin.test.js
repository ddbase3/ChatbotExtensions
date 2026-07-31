import assert from 'node:assert/strict';
import test from 'node:test';
import { MathJaxPlugin } from '../assets/chatbot/MathJaxPlugin.js';

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
		for(const listener of this.listeners.get(name) || []) {
			listener(payload);
		}
	}
}

function flushPromises() {
	return new Promise((resolve) => setImmediate(resolve));
}

function createContext(mathJax) {
	const chatbot = {};
	const events = new EventBus();

	return {
		chatbot,
		events,
		getPluginOptions() {
			return {
				scriptUrl: '/assets/mathjax/tex-mml-chtml.js'
			};
		},
		resolveGlobal(path) {
			return path === 'MathJax' ? mathJax : null;
		}
	};
}

function createMathJax() {
	const calls = [];

	return {
		calls,
		startup: {
			promise: Promise.resolve()
		},
		typesetClear(elements) {
			calls.push(['clear', elements]);
		},
		async typesetPromise(elements) {
			calls.push(['typeset', elements]);
		}
	};
}

test('mathjax plugin waits for completed assistant output', async () => {
	const mathJax = createMathJax();
	const context = createContext(mathJax);
	const content = { isConnected: true };

	MathJaxPlugin.install(context);
	context.events.emit('message:rendering', {
		content,
		rawText: String.raw`The result is \(x`
	});
	await flushPromises();
	assert.deepEqual(mathJax.calls, []);

	context.events.emit('message:completed', {
		content,
		rawText: String.raw`The result is \(x^2 + y^2\).`,
		interaction: false,
		error: false
	});
	await flushPromises();

	assert.deepEqual(mathJax.calls, [
		['typeset', [content]]
	]);

	MathJaxPlugin.destroy(context);
});

test('mathjax plugin typesets restored assistant messages', async () => {
	const mathJax = createMathJax();
	const context = createContext(mathJax);
	const content = { isConnected: true };

	MathJaxPlugin.install(context);
	context.events.emit('message:hydrated', {
		role: 'assistant',
		content,
		rawText: String.raw`\[x = 1\]`,
		error: false
	});
	await flushPromises();

	assert.deepEqual(mathJax.calls, [
		['typeset', [content]]
	]);

	MathJaxPlugin.destroy(context);
});

test('mathjax plugin ignores plain text and user messages', async () => {
	const mathJax = createMathJax();
	const context = createContext(mathJax);

	MathJaxPlugin.install(context);
	context.events.emit('message:completed', {
		content: { isConnected: true },
		rawText: 'This is plain text.',
		interaction: false,
		error: false
	});
	context.events.emit('message:hydrated', {
		role: 'user',
		content: { isConnected: true },
		rawText: String.raw`\(x\)`,
		error: false
	});
	await flushPromises();

	assert.deepEqual(mathJax.calls, []);
	MathJaxPlugin.destroy(context);
});

test('mathjax plugin clears only its own instance content', async () => {
	const mathJax = createMathJax();
	const first = createContext(mathJax);
	const second = createContext(mathJax);
	const firstContent = { isConnected: true };
	const secondContent = { isConnected: true };

	MathJaxPlugin.install(first);
	MathJaxPlugin.install(second);
	first.events.emit('message:completed', {
		content: firstContent,
		rawText: String.raw`\(a\)`,
		interaction: false,
		error: false
	});
	second.events.emit('message:completed', {
		content: secondContent,
		rawText: String.raw`\(b\)`,
		interaction: false,
		error: false
	});
	await flushPromises();

	MathJaxPlugin.destroy(first);

	assert.deepEqual(mathJax.calls, [
		['typeset', [firstContent]],
		['typeset', [secondContent]],
		['clear', [firstContent]]
	]);

	MathJaxPlugin.destroy(second);
});


test('mathjax plugin waits for MathJax 4 startup before checking the public API', async () => {
	const previousMathJax = globalThis.MathJax;
	const previousDocument = globalThis.document;
	const previousCss = globalThis.CSS;
	const events = new EventBus();
	const chatbot = {};
	let resolveStartup;
	let scriptListeners = {};
	const startupPromise = new Promise((resolve) => {
		resolveStartup = resolve;
	});

	const context = {
		chatbot,
		events,
		getPluginOptions() {
			return {
				scriptUrl: '/assets/mathjax/tex-mml-chtml-startup-test.js'
			};
		},
		resolveGlobal(path) {
			return path === 'MathJax' ? globalThis.MathJax : null;
		}
	};

	try {
		globalThis.MathJax = undefined;
		globalThis.CSS = {
			escape(value) {
				return value;
			}
		};
		globalThis.document = {
			querySelector() {
				return null;
			},
			createElement() {
				scriptListeners = {};
				return {
					dataset: {},
					addEventListener(type, listener) {
						scriptListeners[type] = listener;
					}
				};
			},
			head: {
				appendChild() {
					globalThis.MathJax = {
						...globalThis.MathJax,
						startup: {
							...globalThis.MathJax.startup,
							promise: startupPromise
						}
					};
					queueMicrotask(() => scriptListeners.load());
				}
			}
		};

		const content = { isConnected: true };
		MathJaxPlugin.install(context);
		events.emit('message:completed', {
			content,
			rawText: String.raw`\[a = b + c\]`,
			interaction: false,
			error: false
		});
		await flushPromises();

		globalThis.MathJax.typesetClear = () => {};
		globalThis.MathJax.typesetPromise = async (elements) => {
			globalThis.MathJax.typesetElements = elements;
		};
		resolveStartup();
		await flushPromises();
		await flushPromises();

		assert.deepEqual(globalThis.MathJax.typesetElements, [content]);
	} finally {
		MathJaxPlugin.destroy(context);
		globalThis.MathJax = previousMathJax;
		globalThis.document = previousDocument;
		globalThis.CSS = previousCss;
	}
});

test('mathjax plugin enables responsive line breaking before loading MathJax', async () => {
	const previousMathJax = globalThis.MathJax;
	const previousDocument = globalThis.document;
	const previousCss = globalThis.CSS;
	const events = new EventBus();
	const chatbot = {};
	let configuredMathJax = null;
	let scriptListeners = {};

	const context = {
		chatbot,
		events,
		getPluginOptions() {
			return {
				scriptUrl: '/assets/mathjax/tex-mml-chtml-linebreak-test.js'
			};
		},
		resolveGlobal(path) {
			return path === 'MathJax' ? globalThis.MathJax : null;
		}
	};

	try {
		globalThis.MathJax = undefined;
		globalThis.CSS = {
			escape(value) {
				return value;
			}
		};
		globalThis.document = {
			querySelector() {
				return null;
			},
			createElement() {
				scriptListeners = {};
				return {
					dataset: {},
					addEventListener(type, listener) {
						scriptListeners[type] = listener;
					}
				};
			},
			head: {
				appendChild() {
					configuredMathJax = globalThis.MathJax;
					globalThis.MathJax = {
						...configuredMathJax,
						startup: {
							...configuredMathJax.startup,
							promise: Promise.resolve()
						},
						typesetClear() {},
						async typesetPromise() {}
					};
					queueMicrotask(() => scriptListeners.load());
				}
			}
		};

		MathJaxPlugin.install(context);
		context.events.emit('message:completed', {
			content: { isConnected: true },
			rawText: String.raw`\[a = b + c\]`,
			interaction: false,
			error: false
		});
		await flushPromises();
		await flushPromises();

		assert.equal(configuredMathJax.startup.typeset, false);
		assert.equal(configuredMathJax.output.displayOverflow, 'linebreak');
		assert.equal(configuredMathJax.output.linebreaks.inline, true);
		assert.equal(configuredMathJax.output.linebreaks.width, '100%');
	} finally {
		MathJaxPlugin.destroy(context);
		globalThis.MathJax = previousMathJax;
		globalThis.document = previousDocument;
		globalThis.CSS = previousCss;
	}
});

test('mathjax plugin owns markdown delimiter protection through generic render hooks', () => {
	const renderContext = {
		text: String.raw`Value: \(a & b\)`,
		element: { innerHTML: '' }
	};
	const context = {
		getPluginOptions() {
			return { protectMarkdown: true };
		}
	};

	MathJaxPlugin.prepareMessageContent(context, renderContext);
	assert.doesNotMatch(renderContext.text, /\\\(/);
	renderContext.element.innerHTML = `<p>${renderContext.text}</p>`;
	MathJaxPlugin.finalizeMessageContent(context, renderContext, true);

	assert.match(renderContext.element.innerHTML, /\\\(a &amp; b\\\)/);
});
