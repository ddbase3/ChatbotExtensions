const pendingScripts = new Map();
const initializationPromises = new WeakMap();
let renderQueue = Promise.resolve();
let renderSequence = 0;

const STYLE_ATTRIBUTE = 'data-base3-chatbot-mermaid-styles';
const BLOCK_SELECTOR = 'pre > code.language-mermaid';

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
.base3-chatbot-mermaid { max-width: 100%; margin: 1rem 0; overflow: auto; }
.base3-chatbot-mermaid svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
.base3-chatbot-mermaid-error { border-inline-start: 0.3rem solid #8b2f2f; border-radius: 0.25rem; padding: 0.85rem 1rem; color: #8b2f2f; background: color-mix(in srgb, currentColor 7%, transparent); white-space: pre-wrap; overflow-wrap: anywhere; }
`;
	root.appendChild(style);
}

function loadScript(document, url) {
	url = String(url || '').trim();
	if (!url) {
		return Promise.reject(new Error('MermaidPlugin requires pluginOptions.mermaid.scriptUrl.'));
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

function initializeMermaid(mermaid) {
	if (initializationPromises.has(mermaid)) {
		return initializationPromises.get(mermaid);
	}

	const promise = Promise.resolve().then(() => {
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'strict'
		});
		return mermaid;
	});
	initializationPromises.set(mermaid, promise);
	return promise;
}

async function resolveMermaid(context, options) {
	let mermaid = context.resolveGlobal('mermaid');
	if (mermaid && typeof mermaid.render === 'function' && typeof mermaid.initialize === 'function') {
		return initializeMermaid(mermaid);
	}

	const document = getDocument(context);
	if (!document || typeof document.createElement !== 'function') {
		throw new Error('Mermaid rendering requires a document.');
	}

	await loadScript(document, options.scriptUrl);
	mermaid = context.resolveGlobal('mermaid');
	if (!mermaid || typeof mermaid.render !== 'function' || typeof mermaid.initialize !== 'function') {
		throw new Error('Mermaid was loaded but did not expose its global API.');
	}

	return initializeMermaid(mermaid);
}

function createRenderId() {
	renderSequence += 1;
	const suffix = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
		? globalThis.crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
		: `${Date.now().toString(16)}-${renderSequence.toString(16)}`;
	return `base3-chatbot-mermaid-${suffix}`;
}

function normalizeSource(code) {
	let source = String(code?.textContent || '').replace(/\r\n?/g, '\n').trim();
	if (!source) return '';

	const fence = source.match(/^```([^\n`]*)\n([\s\S]*?)\n```$/);
	if (fence) {
		const language = String(fence[1] || '').trim().toLowerCase();
		if (language === '' || language === 'mermaid') {
			source = fence[2].trim();
		}
	}

	if (source.startsWith('"') || source.startsWith('{')) {
		try {
			const decoded = JSON.parse(source);
			if (typeof decoded === 'string') {
				source = decoded.trim();
			}
			else if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
				const wrapped = decoded.code ?? decoded.source ?? decoded.mermaid;
				if (typeof wrapped === 'string') source = wrapped.trim();
			}
		}
		catch (error) {
			// Mermaid source may legitimately begin with characters that are also valid JSON prefixes.
		}
	}

	if (/^mermaid\s*\n/i.test(source)) {
		source = source.replace(/^mermaid\s*\n/i, '').trim();
	}
	return source;
}

function enqueueRender(task) {
	const result = renderQueue.then(task, task);
	renderQueue = result.catch(() => {});
	return result;
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
	element.className = 'base3-chatbot-mermaid base3-chatbot-mermaid-error';
	element.setAttribute('role', 'alert');

	const title = document.createElement('div');
	title.textContent = getString(options, 'renderError', 'Mermaid diagram could not be rendered.');
	element.appendChild(title);
	appendErrorDetails(element, document, error, source, options);
	return element;
}

async function renderCodeBlock(context, state, code) {
	if (!code || code.dataset?.base3MermaidState) return;

	const container = code.parentElement;
	if (!container || typeof container.replaceWith !== 'function') return;

	const rawSource = String(code.textContent || '').replace(/\r\n?/g, '\n').trim();
	const diagnosticSource = `\`\`\`mermaid\n${rawSource}\n\`\`\``;
	const source = normalizeSource(code);
	if (!source) return;

	code.dataset.base3MermaidState = 'rendering';
	const document = code.ownerDocument || getDocument(context);

	try {
		const mermaid = await resolveMermaid(context, state.options);
		if (state.destroyed || code.isConnected === false) return;

		const result = await enqueueRender(() => mermaid.render(createRenderId(), source));
		if (state.destroyed || code.isConnected === false) return;

		const svg = typeof result === 'string' ? result : String(result?.svg || '');
		if (!svg.trim()) {
			throw new Error('Mermaid returned an empty diagram.');
		}

		const host = document.createElement('div');
		host.className = 'base3-chatbot-mermaid';
		host.setAttribute('role', 'img');
		host.setAttribute('aria-label', getString(state.options, 'aria', 'Mermaid diagram'));
		host.innerHTML = svg;
		container.replaceWith(host);

		if (result && typeof result.bindFunctions === 'function') {
			result.bindFunctions(host);
		}
	}
	catch (error) {
		if (state.destroyed || code.isConnected === false) return;
		container.replaceWith(createErrorElement(document, error, diagnosticSource, state.options));
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

function markPending(element, options) {
	if (!element || typeof element.querySelectorAll !== 'function') {
		return;
	}
	element.querySelectorAll(BLOCK_SELECTOR).forEach((code) => {
		const container = code.parentElement;
		if (!container || container.classList.contains('base3-chatbot-extension-pending')) {
			return;
		}
		container.classList.add('base3-chatbot-extension-pending');
		const document = code.ownerDocument || globalThis.document;
		const indicator = document.createElement('span');
		indicator.className = 'base3-chatbot-extension-pending-indicator';
		indicator.setAttribute('aria-hidden', 'true');
		const label = document.createElement('span');
		label.className = 'base3-chatbot-extension-pending-text';
		label.textContent = getString(options, 'loading', 'Content is being created...');
		container.append(indicator, label);
	});
}

function getMessageElement(payload) {
	return payload?.content || payload?.element || null;
}

export const MermaidPlugin = {
	name: 'mermaid',

	install(context) {
		this.states ??= new WeakMap();

		const state = {
			destroyed: false,
			options: context.getPluginOptions(),
			unsubscribe: []
		};
		this.states.set(context.chatbot, state);
		ensureStyles(context.root);

		state.unsubscribe.push(
			context.events.on('message:rendered', (payload) => {
				if (!payload?.error) {
					markPending(getMessageElement(payload), state.options);
				}
			}),
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
		this.states.delete(context.chatbot);
	}
};
