const STYLE_ATTRIBUTE = 'data-base3-chatbot-extension-styles';


function getString(options, key, fallback, replacements = {}) {
	let value = String(options?.strings?.[key] ?? fallback);
	for (const [name, replacement] of Object.entries(replacements)) {
		value = value.split(`{${name}}`).join(String(replacement));
	}
	return value;
}

function createElement(document, tagName, className = '', text = null) {
	const element = document.createElement(tagName);
	if (className) {
		element.className = className;
	}
	if (text !== null && text !== undefined) {
		element.textContent = String(text);
	}
	return element;
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
.base3-chatbot-extension-block { margin: 1rem 0; }
.base3-chatbot-callout { border-inline-start: 0.3rem solid currentColor; border-radius: 0.25rem; padding: 0.85rem 1rem; background: color-mix(in srgb, currentColor 7%, transparent); }
.base3-chatbot-callout-title { display: block; margin-bottom: 0.3rem; font-weight: 700; }
.base3-chatbot-callout-text > :first-child { margin-top: 0; }
.base3-chatbot-callout-text > :last-child { margin-bottom: 0; }
.base3-chatbot-callout-info { color: #245b8a; }
.base3-chatbot-callout-success { color: #276738; }
.base3-chatbot-callout-warning { color: #765500; }
.base3-chatbot-callout-error { color: #8b2f2f; }
.base3-chatbot-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); gap: 0.75rem; }
.base3-chatbot-kpi-card { min-width: 0; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 0.35rem; padding: 0.85rem; }
.base3-chatbot-kpi-label, .base3-chatbot-kpi-detail { display: block; overflow-wrap: anywhere; }
.base3-chatbot-kpi-detail > :first-child { margin-top: 0; }
.base3-chatbot-kpi-detail > :last-child { margin-bottom: 0; }
.base3-chatbot-kpi-value { display: block; margin: 0.2rem 0; font-size: 1.45rem; font-weight: 700; overflow-wrap: anywhere; }
.base3-chatbot-kpi-change { display: inline-block; margin-top: 0.25rem; font-weight: 600; }
.base3-chatbot-progress-list { display: grid; gap: 0.75rem; }
.base3-chatbot-progress-header { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.25rem; }
.base3-chatbot-progress-item progress { display: block; width: 100%; }
.base3-chatbot-timeline { margin: 1rem 0; padding: 0; list-style: none; }
.base3-chatbot-timeline-item { position: relative; margin-inline-start: 0.45rem; padding: 0 0 1rem 1.25rem; border-inline-start: 2px solid color-mix(in srgb, currentColor 25%, transparent); }
.base3-chatbot-timeline-item::before { content: ''; position: absolute; inset-inline-start: -0.38rem; top: 0.2rem; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: currentColor; }
.base3-chatbot-timeline-item:last-child { padding-bottom: 0; }
.base3-chatbot-timeline-date { display: block; font-size: 0.88rem; opacity: 0.75; }
.base3-chatbot-timeline-title { display: block; margin: 0.1rem 0; font-weight: 700; }
.base3-chatbot-timeline-text > :first-child { margin-top: 0; }
.base3-chatbot-timeline-text > :last-child { margin-bottom: 0; }
.base3-chatbot-accordion { display: grid; gap: 0.5rem; }
.base3-chatbot-accordion details { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 0.35rem; padding: 0.65rem 0.8rem; }
.base3-chatbot-accordion summary { cursor: pointer; font-weight: 700; }
.base3-chatbot-accordion-content { margin-top: 0.65rem; }
.base3-chatbot-accordion-content > :first-child { margin-top: 0; }
.base3-chatbot-accordion-content > :last-child { margin-bottom: 0; }
.base3-chatbot-download { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 0.35rem; padding: 0.8rem; }
.base3-chatbot-download-name { min-width: 0; overflow-wrap: anywhere; font-family: monospace; }
.base3-chatbot-download-button { flex: 0 0 auto; }
.base3-chatbot-extension-error { border-inline-start: 0.3rem solid #8b2f2f; padding: 0.75rem 0.9rem; color: #8b2f2f; background: color-mix(in srgb, currentColor 7%, transparent); }
`;
	root.appendChild(style);
}

function parseBlock(code) {
	const source = String(code?.textContent || '').trim();
	if (!source) {
		throw new Error('Structured chatbot block is empty.');
	}

	const value = JSON.parse(source);
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Structured chatbot block must contain a JSON object.');
	}
	return value;
}

function replaceCodeBlocks(context, root, language, renderer, options) {
	if (!root || typeof root.querySelectorAll !== 'function') {
		return;
	}

	const selector = `pre > code.language-${language}`;
	root.querySelectorAll(selector).forEach((code) => {
		const container = code.parentElement;
		if (!container || typeof container.replaceWith !== 'function') {
			return;
		}

		try {
			const replacement = renderer(root.ownerDocument || globalThis.document, parseBlock(code), context, options);
			if (replacement) {
				container.replaceWith(replacement);
			}
		}
		catch (error) {
			const document = code.ownerDocument || globalThis.document;
			const replacement = document.createElement('div');
			replacement.className = 'base3-chatbot-extension-block base3-chatbot-extension-error';
			replacement.setAttribute('role', 'alert');
			replacement.textContent = getString(options, 'renderError', 'Content could not be rendered.');
			container.replaceWith(replacement);
			context.events.emit('chatbot:error', error);
		}
	});
}

function getMessageElement(payload) {
	return payload?.content || payload?.element || null;
}

function installStructuredPlugin(context, language, renderer) {
	ensureStyles(context.root);
	const options = context.getPluginOptions();
	const render = (element) => replaceCodeBlocks(context, element, language, renderer, options);
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

	return () => unsubscribe.forEach((off) => off());
}

function createStructuredPlugin(name, language, renderer) {
	return {
		name,
		install(context) {
			this.states ??= new WeakMap();
			this.states.set(context.chatbot, installStructuredPlugin(context, language, renderer));
		},
		destroy(context) {
			const destroy = this.states?.get(context.chatbot);
			if (destroy) {
				destroy();
				this.states.delete(context.chatbot);
			}
		}
	};
}

function createMarkdownContent(document, context, className, markdown) {
	const content = createElement(document, 'div', className);
	content.appendChild(context.commands.execute('markdown:render-fragment', {
		markdown,
		document,
		allowExtensionBlocks: false
	}));
	return content;
}

function renderCallout(document, data, context) {
	const type = ['info', 'success', 'warning', 'error'].includes(data.type) ? data.type : 'info';
	const text = String(data.text || '').trim();
	if (!text) {
		throw new Error('Callout requires text.');
	}

	const block = createElement(document, 'aside', `base3-chatbot-extension-block base3-chatbot-callout base3-chatbot-callout-${type}`);
	const title = String(data.title || '').trim();
	if (title) {
		block.appendChild(createElement(document, 'strong', 'base3-chatbot-callout-title', title));
	}
	block.appendChild(createMarkdownContent(document, context, 'base3-chatbot-callout-text', text));
	return block;
}

function getItems(data, minimum, maximum, label) {
	if (!Array.isArray(data.items) || data.items.length < minimum || data.items.length > maximum) {
		throw new Error(`${label} requires between ${minimum} and ${maximum} items.`);
	}
	return data.items;
}

function renderKpiCards(document, data, context) {
	const grid = createElement(document, 'section', 'base3-chatbot-extension-block base3-chatbot-kpi-grid');
	getItems(data, 1, 6, 'KPI cards').forEach((item) => {
		const label = String(item?.label || '').trim();
		const value = String(item?.value || '').trim();
		if (!label || !value) {
			throw new Error('Every KPI card requires label and value.');
		}

		const card = createElement(document, 'article', 'base3-chatbot-kpi-card');
		card.appendChild(createElement(document, 'span', 'base3-chatbot-kpi-label', label));
		card.appendChild(createElement(document, 'strong', 'base3-chatbot-kpi-value', value));
		const change = String(item.change || '').trim();
		const detail = String(item.detail || '').trim();
		if (change) {
			card.appendChild(createElement(document, 'span', 'base3-chatbot-kpi-change', change));
		}
		if (detail) {
			card.appendChild(createMarkdownContent(document, context, 'base3-chatbot-kpi-detail', detail));
		}
		grid.appendChild(card);
	});
	return grid;
}

function renderProgress(document, data) {
	const list = createElement(document, 'section', 'base3-chatbot-extension-block base3-chatbot-progress-list');
	getItems(data, 1, 8, 'Progress').forEach((item) => {
		const label = String(item?.label || '').trim();
		const value = Number(item?.value);
		const maximum = Number(item?.max);
		if (!label || !Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0 || value < 0 || value > maximum) {
			throw new Error('Every progress item requires a valid label, value, and maximum.');
		}

		const row = createElement(document, 'div', 'base3-chatbot-progress-item');
		const header = createElement(document, 'div', 'base3-chatbot-progress-header');
		header.appendChild(createElement(document, 'span', 'base3-chatbot-progress-label', label));
		header.appendChild(createElement(document, 'span', 'base3-chatbot-progress-text', String(item.text || `${value}/${maximum}`)));
		const progress = createElement(document, 'progress');
		progress.value = value;
		progress.max = maximum;
		progress.setAttribute('aria-label', label);
		row.append(header, progress);
		list.appendChild(row);
	});
	return list;
}

function renderTimeline(document, data, context) {
	const list = createElement(document, 'ol', 'base3-chatbot-extension-block base3-chatbot-timeline');
	getItems(data, 1, 12, 'Timeline').forEach((item) => {
		const title = String(item?.title || '').trim();
		if (!title) {
			throw new Error('Every timeline item requires a title.');
		}
		const status = ['completed', 'current', 'planned', 'neutral'].includes(item.status) ? item.status : 'neutral';
		const row = createElement(document, 'li', `base3-chatbot-timeline-item base3-chatbot-timeline-${status}`);
		const date = String(item.date || '').trim();
		const text = String(item.text || '').trim();
		if (date) {
			row.appendChild(createElement(document, 'span', 'base3-chatbot-timeline-date', date));
		}
		row.appendChild(createElement(document, 'strong', 'base3-chatbot-timeline-title', title));
		if (text) {
			row.appendChild(createMarkdownContent(document, context, 'base3-chatbot-timeline-text', text));
		}
		list.appendChild(row);
	});
	return list;
}

function renderAccordion(document, data, context) {
	const list = createElement(document, 'section', 'base3-chatbot-extension-block base3-chatbot-accordion');
	getItems(data, 1, 10, 'Accordion').forEach((item) => {
		const title = String(item?.title || '').trim();
		const markdown = String(item?.markdown || '').trim();
		if (!title || !markdown) {
			throw new Error('Every accordion item requires title and markdown.');
		}

		const details = createElement(document, 'details');
		details.open = item.open === true;
		details.appendChild(createElement(document, 'summary', '', title));
		const content = createMarkdownContent(document, context, 'base3-chatbot-accordion-content', markdown);
		details.appendChild(content);
		list.appendChild(details);
	});
	return list;
}

function normalizeFilename(value, format) {
	const fallback = `assistant-data.${format}`;
	const filename = String(value || '').trim().split(/[\\/]/).pop() || fallback;
	return filename.toLowerCase().endsWith(`.${format}`) ? filename : `${filename}.${format}`;
}

function getDownloadContent(data, format) {
	if (format === 'csv') {
		if (typeof data.content !== 'string') {
			throw new Error('CSV download content must be a string.');
		}
		return data.content;
	}
	return JSON.stringify(data.content, null, 2);
}

function renderDataDownload(document, data, context, options) {
	const format = String(data.format || '').toLowerCase();
	if (!['csv', 'json'].includes(format) || !Object.prototype.hasOwnProperty.call(data, 'content')) {
		throw new Error('Data download requires csv or json format and content.');
	}

	const filename = normalizeFilename(data.filename, format);
	const content = getDownloadContent(data, format);
	const block = createElement(document, 'section', 'base3-chatbot-extension-block base3-chatbot-download');
	block.appendChild(createElement(document, 'span', 'base3-chatbot-download-name', filename));
	const button = createElement(document, 'button', 'btn btn-default base3-chatbot-download-button', getString(options, 'download', 'Download {format}', { format: format.toUpperCase() }));
	button.type = 'button';
	button.addEventListener('click', () => {
		const view = document.defaultView || globalThis;
		const blob = new Blob([content], {
			type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
		});
		const url = view.URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.hidden = true;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		view.setTimeout(() => view.URL.revokeObjectURL(url), 0);
	});
	block.appendChild(button);
	return block;
}

export const CalloutPlugin = createStructuredPlugin('callouts', 'base3-callout', renderCallout);
export const KpiCardsPlugin = createStructuredPlugin('kpi-cards', 'base3-kpi', renderKpiCards);
export const ProgressPlugin = createStructuredPlugin('progress', 'base3-progress', renderProgress);
export const TimelinePlugin = createStructuredPlugin('timeline', 'base3-timeline', renderTimeline);
export const AccordionPlugin = createStructuredPlugin('accordions', 'base3-accordion', renderAccordion);
export const DataDownloadPlugin = createStructuredPlugin('data-downloads', 'base3-download', renderDataDownload);
