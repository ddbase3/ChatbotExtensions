const STYLE_ATTRIBUTE = 'data-base3-code-formatting-styles';

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
.base3-chatbot-message pre { max-width: 100%; overflow-x: auto; white-space: pre; }
.base3-chatbot-message pre > code { white-space: inherit; }
`;
	root.appendChild(style);
}

function formatJsonCodeBlocks(element) {
	if (!element || typeof element.querySelectorAll !== 'function') {
		return;
	}

	element.querySelectorAll('pre > code.language-json').forEach((code) => {
		const source = String(code.textContent || '').trim();
		if (!source) {
			return;
		}

		try {
			code.textContent = JSON.stringify(JSON.parse(source), null, 2);
		}
		catch (error) {
			// Keep invalid or incomplete JSON unchanged.
		}
	});
}

function getMessageElement(payload) {
	return payload?.content || payload?.element || null;
}

export const CodeFormattingPlugin = {
	name: 'code-formatting',

	install(context) {
		this.states ??= new WeakMap();
		ensureStyles(context.root);

		const render = (element) => formatJsonCodeBlocks(element);
		const unsubscribe = [
			context.events.on('message:completed', (payload) => {
				if (!payload?.interaction && !payload?.error) {
					render(getMessageElement(payload));
				}
			}),
			context.events.on('message:hydrated', (payload) => {
				if (payload?.role === 'assistant' && !payload?.error) {
					render(getMessageElement(payload));
				}
			}),
			context.events.on('opening-message:loaded', ({ element }) => render(element))
		];

		this.states.set(context.chatbot, () => unsubscribe.forEach((off) => off()));
	},

	destroy(context) {
		const destroy = this.states?.get(context.chatbot);
		if (destroy) {
			destroy();
			this.states.delete(context.chatbot);
		}
	}
};
