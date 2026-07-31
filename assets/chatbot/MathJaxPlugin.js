const pendingScripts = new Map();

const MATHJAX_RENDER_STATE = Symbol('base3-mathjax-render-state');
const MATHJAX_EXPRESSION_PATTERN = /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g;

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function protectMathJaxExpressions(value) {
	const source = String(value || '');
	const expressions = [];
	let prefix = 'BASE3MATHJAXEXPRESSION';
	while (source.includes(prefix)) {
		prefix += 'X';
	}

	const text = source.replace(MATHJAX_EXPRESSION_PATTERN, (expression) => {
		const token = `${prefix}${expressions.length}END`;
		expressions.push({ token, expression });
		return token;
	});

	return {
		text,
		restore(html) {
			return expressions.reduce(
				(output, item) => output.split(item.token).join(escapeHtml(item.expression)),
				String(html || '')
			);
		}
	};
}

function loadScript(url) {
	url = String(url || '').trim();
	if (!url) {
		return Promise.resolve();
	}
	if (pendingScripts.has(url)) {
		return pendingScripts.get(url);
	}

	const promise = new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[data-base3-module-resource="${CSS.escape(url)}"]`);
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

function getGlobalTarget() {
	return typeof window !== 'undefined' ? window : globalThis;
}

function configureMathJax() {
	const target = getGlobalTarget();
	const current = target.MathJax && typeof target.MathJax === 'object'
		? target.MathJax
		: {};

	if (typeof current.typesetPromise === 'function') {
		return;
	}

	target.MathJax = {
		...current,
		startup: {
			...(current.startup || {}),
			typeset: false
		},
		tex: {
			...(current.tex || {}),
			inlineMath: [['\\(', '\\)']],
			displayMath: [['\\[', '\\]']]
		},
		output: {
			...(current.output || {}),
			displayOverflow: 'linebreak',
			linebreaks: {
				...(current.output?.linebreaks || {}),
				inline: true,
				width: '100%'
			}
		}
	};
}

function containsMath(value) {
	const text = String(value || '');
	if (!text) {
		return false;
	}

	return /<math(?:\s|>)/i.test(text)
		|| /\\\([\s\S]+?\\\)/.test(text)
		|| /\\\[[\s\S]+?\\\]/.test(text);
}

async function resolveMathJax(context, options) {
	let mathJax = context.resolveGlobal('MathJax');
	if (mathJax && typeof mathJax.typesetPromise === 'function') {
		return mathJax;
	}

	const scriptUrl = String(options.scriptUrl || '').trim();
	if (!scriptUrl) {
		throw new Error('MathJaxPlugin requires pluginOptions.mathjax.scriptUrl.');
	}

	configureMathJax();
	await loadScript(scriptUrl);

	mathJax = context.resolveGlobal('MathJax');
	if (!mathJax || typeof mathJax !== 'object') {
		throw new Error('MathJax was loaded but did not expose its global API.');
	}

	if (mathJax.startup?.promise) {
		await mathJax.startup.promise;
	}

	mathJax = context.resolveGlobal('MathJax');
	if (!mathJax || typeof mathJax.typesetPromise !== 'function') {
		throw new Error('MathJax startup completed without exposing typesetPromise().');
	}

	return mathJax;
}

function getMessageElement(payload) {
	return payload?.content || payload?.element || null;
}

function clearElement(context, state, element) {
	if (!element || !state.typesetElements.has(element)) {
		return;
	}

	const mathJax = context.resolveGlobal('MathJax');
	if (mathJax && typeof mathJax.typesetClear === 'function') {
		mathJax.typesetClear([element]);
	}
	state.typesetElements.delete(element);
}

function clearAll(context, state) {
	if (state.typesetElements.size === 0) {
		return;
	}

	const elements = [...state.typesetElements];
	const mathJax = context.resolveGlobal('MathJax');
	if (mathJax && typeof mathJax.typesetClear === 'function') {
		mathJax.typesetClear(elements);
	}
	state.typesetElements.clear();
}

async function typesetElement(context, state, element, sourceText) {
	if (state.destroyed || !element || !containsMath(sourceText)) {
		return;
	}

	try {
		const mathJax = await resolveMathJax(context, state.options);
		if (state.destroyed || element.isConnected === false) {
			return;
		}

		clearElement(context, state, element);
		await mathJax.typesetPromise([element]);
		if (state.destroyed || element.isConnected === false) {
			if (typeof mathJax.typesetClear === 'function') {
				mathJax.typesetClear([element]);
			}
			return;
		}
		state.typesetElements.add(element);
	} catch (error) {
		if (!state.destroyed) {
			context.events.emit('chatbot:error', error);
		}
	}
}

export const MathJaxPlugin = {
	name: 'mathjax',

	prepareMessageContent(context, renderContext) {
		const options = context.getPluginOptions();
		if (options.protectMarkdown !== true) {
			return;
		}

		const protectedContent = protectMathJaxExpressions(renderContext.text);
		renderContext.text = protectedContent.text;
		renderContext[MATHJAX_RENDER_STATE] = protectedContent;
	},

	finalizeMessageContent(context, renderContext, handled) {
		const protectedContent = renderContext[MATHJAX_RENDER_STATE];
		if (!handled || !protectedContent || !renderContext.element) {
			return;
		}

		renderContext.element.innerHTML = protectedContent.restore(renderContext.element.innerHTML);
	},

	install(context) {
		this.states ??= new WeakMap();

		const state = {
			destroyed: false,
			options: context.getPluginOptions(),
			typesetElements: new Set(),
			unsubscribe: []
		};
		this.states.set(context.chatbot, state);

		state.unsubscribe.push(
			context.events.on('message:rendering', (payload) => {
				clearElement(context, state, getMessageElement(payload));
			}),
			context.events.on('message:completed', (payload) => {
				if (payload?.interaction || payload?.error) {
					return;
				}
				typesetElement(context, state, getMessageElement(payload), payload?.rawText);
			}),
			context.events.on('message:hydrated', (payload) => {
				if (payload?.role !== 'assistant' || payload?.error) {
					return;
				}
				typesetElement(context, state, getMessageElement(payload), payload?.rawText);
			}),
			context.events.on('opening-message:loaded', ({ element }) => {
				typesetElement(context, state, element, element?.textContent || '');
			}),
			context.events.on('conversation:changed', () => {
				clearAll(context, state);
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
		clearAll(context, state);
		this.states.delete(context.chatbot);
	}
};
