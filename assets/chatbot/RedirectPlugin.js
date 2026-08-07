const BLOCK_SELECTOR = 'pre > code.language-base3-redirect';

function getMessageElement(payload) {
	return payload?.content || payload?.element || null;
}

function parseRedirectTarget(code) {
	const source = String(code?.textContent || '').trim();
	if (!source) {
		throw new Error('Portal redirect block is empty.');
	}

	const data = JSON.parse(source);
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('Portal redirect block must contain a JSON object.');
	}

	const keys = Object.keys(data);
	if (
		keys.length !== 2
		|| !Object.prototype.hasOwnProperty.call(data, 'url')
		|| !Object.prototype.hasOwnProperty.call(data, 'label')
	) {
		throw new Error('Portal redirect block must contain exactly url and label properties.');
	}

	const url = String(data.url || '').trim();
	const label = String(data.label || '').trim();
	if (!url) {
		throw new Error('Portal redirect requires a non-empty url.');
	}
	if (!label) {
		throw new Error('Portal redirect requires a non-empty label.');
	}

	return { url, label };
}

function resolveRedirectTarget(document, target) {
	const view = document?.defaultView || globalThis.window;
	const location = view?.location;
	if (!location || typeof location.href !== 'string' || typeof location.assign !== 'function') {
		throw new Error('Portal redirect requires a browser location.');
	}

	const currentUrl = new URL(location.href);
	const targetUrl = new URL(target, currentUrl);
	if (targetUrl.origin !== currentUrl.origin) {
		throw new Error('Portal redirect target must use the current origin.');
	}
	if (targetUrl.username || targetUrl.password) {
		throw new Error('Portal redirect target must not contain credentials.');
	}

	return {
		location,
		url: targetUrl.href
	};
}

function createRedirectLink(document, url, label) {
	const wrapper = document.createElement('div');
	wrapper.className = 'base3-chatbot-extension-block base3-chatbot-redirect';

	const link = document.createElement('a');
	link.className = 'btn btn-default base3-chatbot-redirect-link';
	link.href = url;
	link.textContent = label;
	wrapper.appendChild(link);

	return wrapper;
}

function handleRedirectBlocks(context, state, element, navigate) {
	if (!element || typeof element.querySelectorAll !== 'function') {
		return;
	}

	for (const code of element.querySelectorAll(BLOCK_SELECTOR)) {
		if (state.handled.has(code)) {
			continue;
		}
		state.handled.add(code);

		try {
			const container = code.parentElement;
			if (!container || typeof container.replaceWith !== 'function') {
				continue;
			}

			const document = code.ownerDocument || element.ownerDocument || globalThis.document;
			if (!document || typeof document.createElement !== 'function') {
				throw new Error('Portal redirect requires a browser document.');
			}

			const data = parseRedirectTarget(code);
			const target = resolveRedirectTarget(document, data.url);
			container.replaceWith(createRedirectLink(document, target.url, data.label));

			if (navigate) {
				target.location.assign(target.url);
				return;
			}
		}
		catch (error) {
			context.events.emit('chatbot:error', error);
		}
	}
}

export const RedirectPlugin = {
	name: 'redirect',

	install(context) {
		this.states ??= new WeakMap();

		const state = {
			handled: new WeakSet(),
			unsubscribe: []
		};
		this.states.set(context.chatbot, state);

		state.unsubscribe.push(
			context.events.on('message:completed', (payload) => {
				if (!payload?.interaction && !payload?.error) {
					handleRedirectBlocks(context, state, getMessageElement(payload), true);
				}
			}),
			context.events.on('message:hydrated', (payload) => {
				if (payload?.role === 'assistant' && !payload?.error) {
					handleRedirectBlocks(context, state, getMessageElement(payload), false);
				}
			}),
			context.events.on('opening-message:loaded', ({ element }) => {
				handleRedirectBlocks(context, state, element, false);
			})
		);
	},

	destroy(context) {
		const state = this.states?.get(context.chatbot);
		if (!state) {
			return;
		}

		state.unsubscribe.forEach((unsubscribe) => unsubscribe());
		this.states.delete(context.chatbot);
	}
};
