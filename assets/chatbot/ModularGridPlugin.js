const pendingModules = new Map();
const loadedStyles = new WeakMap();

const STYLE_ATTRIBUTE = 'data-base3-chatbot-grid-styles';
const RESOURCE_ATTRIBUTE = 'data-base3-module-resource';
const BLOCK_SELECTOR = 'pre > code.language-base3-table';
const ALLOWED_PROPERTIES = new Set([
	'title',
	'columns',
	'rows',
	'search',
	'paging',
	'page_size'
]);
const ALLOWED_COLUMN_PROPERTIES = new Set(['key', 'label', 'sortable']);
const ALLOWED_PAGE_SIZES = new Set([5, 10, 20, 50]);
const COLUMN_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

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

function ensureHostStyles(root) {
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
.base3-chatbot-grid { max-width: 100%; margin: 1rem 0; }
.base3-chatbot-grid-title { margin: 0 0 0.65rem; font-size: 1rem; font-weight: 600; }
.base3-chatbot-grid-host { min-width: 0; max-width: 100%; overflow-x: auto; }
.base3-chatbot-grid-toolbar { display: flex !important; align-items: center !important; flex-flow: row nowrap !important; gap: 0.45rem !important; width: 100% !important; }
.base3-chatbot-grid-toolbar > * { flex: 0 0 auto !important; width: auto !important; min-width: 0 !important; margin: 0 !important; }
.base3-chatbot-grid-toolbar-group { display: flex !important; align-items: center !important; flex-flow: row nowrap !important; gap: 0.3rem !important; width: auto !important; min-width: 0 !important; margin: 0 !important; }
.base3-chatbot-grid-toolbar label { display: inline-flex !important; align-items: center !important; width: auto !important; min-width: 0 !important; margin: 0 !important; white-space: nowrap !important; }
.base3-chatbot-grid-toolbar input { flex: 0 1 11rem !important; width: 11rem !important; min-width: 6rem !important; max-width: 11rem !important; margin: 0 !important; }
.base3-chatbot-grid-toolbar button { flex: 0 0 auto !important; width: auto !important; min-width: 0 !important; margin: 0 !important; padding-inline: 0.5rem !important; white-space: nowrap !important; }
.base3-chatbot-grid-toolbar select { flex: 0 0 auto !important; width: auto !important; min-width: 3.75rem !important; max-width: 5rem !important; margin: 0 !important; }
@media (max-width: 640px) {
	.base3-chatbot-grid-toolbar { align-items: stretch !important; flex-direction: column !important; }
	.base3-chatbot-grid-toolbar-group { flex-wrap: wrap !important; }
	.base3-chatbot-grid-toolbar input { flex: 1 1 10rem !important; width: auto !important; max-width: none !important; }
}
.base3-chatbot-grid-error { border-inline-start: 0.3rem solid #8b2f2f; border-radius: 0.25rem; padding: 0.85rem 1rem; color: #8b2f2f; background: color-mix(in srgb, currentColor 7%, transparent); white-space: pre-wrap; overflow-wrap: anywhere; }
`;
	root.appendChild(style);
}


function addClass(element, className) {
	if (!element) {
		return;
	}
	if (element.classList && typeof element.classList.add === 'function') {
		element.classList.add(className);
		return;
	}

	const classes = new Set(String(element.className || '').split(/\s+/).filter(Boolean));
	classes.add(className);
	element.className = [...classes].join(' ');
}

function getLabelText(label) {
	return String(label?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getAncestors(element, boundary) {
	const ancestors = [];
	let current = element;
	while (current && current !== boundary) {
		ancestors.push(current);
		current = current.parentElement;
	}
	return ancestors;
}

function findCommonAncestor(first, second, boundary) {
	const secondAncestors = new Set(getAncestors(second, boundary));
	return getAncestors(first, boundary).find((element) => secondAncestors.has(element)) || null;
}

function getToolbarGroup(element, toolbar) {
	let group = element;
	while (group?.parentElement && group.parentElement !== toolbar) {
		group = group.parentElement;
	}
	return group;
}

function compactToolbar(gridHost, options) {
	if (!gridHost || typeof gridHost.querySelectorAll !== 'function') {
		return;
	}

	const labels = [...gridHost.querySelectorAll('label')];
	const searchText = getString(options, 'search', 'Search').trim().toLowerCase();
	const rowsPerPageText = getString(options, 'rowsPerPage', 'Rows per page').trim().toLowerCase();
	const searchLabel = labels.find((label) => getLabelText(label).startsWith(searchText));
	const pageSizeLabel = labels.find((label) => getLabelText(label).startsWith(rowsPerPageText));
	if (!searchLabel || !pageSizeLabel) {
		return;
	}

	const toolbar = findCommonAncestor(searchLabel, pageSizeLabel, gridHost);
	if (!toolbar) {
		return;
	}

	addClass(toolbar, 'base3-chatbot-grid-toolbar');
	addClass(getToolbarGroup(searchLabel, toolbar), 'base3-chatbot-grid-toolbar-group');
	addClass(getToolbarGroup(pageSizeLabel, toolbar), 'base3-chatbot-grid-toolbar-group');
}

function normalizeResourceUrl(document, value, label) {
	const source = String(value || '').trim();
	if (!source) {
		throw new Error(`ModularGridPlugin requires pluginOptions.${label}.`);
	}

	try {
		return new URL(source, document.baseURI || globalThis.location?.href || import.meta.url).href;
	}
	catch (error) {
		throw new Error(`ModularGridPlugin received an invalid ${label}.`);
	}
}

function ensureStylesheet(document, url) {
	let documentStyles = loadedStyles.get(document);
	if (!documentStyles) {
		documentStyles = new Set();
		loadedStyles.set(document, documentStyles);
	}
	if (documentStyles.has(url)) {
		return;
	}

	const existing = typeof document.querySelectorAll === 'function'
		? [...document.querySelectorAll(`link[${RESOURCE_ATTRIBUTE}]`)].find(
			(link) => link.dataset?.base3ModuleResource === url
		)
		: null;
	if (existing) {
		documentStyles.add(url);
		return;
	}

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = url;
	link.dataset.base3ModuleResource = url;
	document.head.appendChild(link);
	documentStyles.add(url);
}

function loadModule(url) {
	url = String(url || '').trim();
	if (!url) {
		return Promise.reject(new Error('ModularGridPlugin requires pluginOptions.moduleUrl.'));
	}
	if (pendingModules.has(url)) {
		return pendingModules.get(url);
	}

	const promise = import(url);
	pendingModules.set(url, promise);
	return promise;
}

async function resolveGridModule(context, options) {
	const document = getDocument(context);
	if (!document || typeof document.createElement !== 'function') {
		throw new Error('ModularGrid rendering requires a document.');
	}

	const moduleUrl = normalizeResourceUrl(document, options.moduleUrl, 'moduleUrl');
	const styleUrl = normalizeResourceUrl(document, options.styleUrl, 'styleUrl');
	ensureStylesheet(document, styleUrl);
	const module = await loadModule(moduleUrl);
	const requiredExports = [
		'ModularGrid',
		'ArrayAdapter',
		'createClassicLayout',
		'SearchPlugin',
		'PageSizePlugin',
		'InfoPlugin',
		'PagingPlugin'
	];

	for (const exportName of requiredExports) {
		if (!module || module[exportName] === undefined || module[exportName] === null) {
			throw new Error(`ModularGrid module does not export ${exportName}.`);
		}
	}

	return module;
}

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertAllowedProperties(value, allowed, label) {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			throw new Error(`${label} contains unsupported property "${key}".`);
		}
	}
}

function normalizeText(value, label, maximumLength, required = false) {
	if (value === undefined || value === null) {
		if (required) {
			throw new Error(`${label} is required.`);
		}
		return '';
	}
	if (typeof value !== 'string') {
		throw new Error(`${label} must be plain text.`);
	}

	const text = value.trim();
	if (required && !text) {
		throw new Error(`${label} is required.`);
	}
	if (text.length > maximumLength) {
		throw new Error(`${label} must not exceed ${maximumLength} characters.`);
	}
	return text;
}

function normalizeBoolean(value, label, fallback) {
	if (value === undefined) {
		return fallback;
	}
	if (typeof value !== 'boolean') {
		throw new Error(`${label} must be boolean.`);
	}
	return value;
}

function normalizeColumns(value) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
		throw new Error('Table columns must contain between 1 and 20 entries.');
	}

	const keys = new Set();
	return value.map((column, index) => {
		if (!isObject(column)) {
			throw new Error(`Table column ${index + 1} must be an object.`);
		}
		assertAllowedProperties(column, ALLOWED_COLUMN_PROPERTIES, `Table column ${index + 1}`);

		const key = normalizeText(column.key, `Table column ${index + 1} key`, 64, true);
		if (!COLUMN_KEY_PATTERN.test(key)) {
			throw new Error(`Table column ${index + 1} key must start with a letter and contain only letters, digits, and underscores.`);
		}
		if (keys.has(key)) {
			throw new Error(`Table column key "${key}" is duplicated.`);
		}
		keys.add(key);

		return {
			key,
			label: normalizeText(column.label, `Table column ${index + 1} label`, 120, true),
			sortable: normalizeBoolean(column.sortable, `Table column ${index + 1} sortable`, true),
			resizable: false,
			reorderable: false
		};
	});
}

function normalizeCell(value, rowIndex, key) {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') {
		if (typeof value === 'string' && value.length > 2000) {
			throw new Error(`Table row ${rowIndex + 1} cell "${key}" must not exceed 2000 characters.`);
		}
		return value;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	throw new Error(`Table row ${rowIndex + 1} cell "${key}" must be plain text, a finite number, boolean, or null.`);
}

function normalizeRows(value, columns) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 200) {
		throw new Error('Table rows must contain between 1 and 200 entries.');
	}

	const keys = columns.map((column) => column.key);
	const keySet = new Set(keys);

	return value.map((row, rowIndex) => {
		if (!isObject(row)) {
			throw new Error(`Table row ${rowIndex + 1} must be an object.`);
		}
		for (const key of Object.keys(row)) {
			if (!keySet.has(key)) {
				throw new Error(`Table row ${rowIndex + 1} contains undeclared column "${key}".`);
			}
		}

		const normalized = {};
		keys.forEach((key) => {
			normalized[key] = normalizeCell(row[key] ?? null, rowIndex, key);
		});
		return normalized;
	});
}

function normalizePageSize(value) {
	if (value === undefined) {
		return 10;
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || !ALLOWED_PAGE_SIZES.has(value)) {
		throw new Error('Table page_size must be 5, 10, 20, or 50.');
	}
	return value;
}

function parseTable(code) {
	const source = String(code?.textContent || '').trim();
	if (!source) {
		throw new Error('Table block is empty.');
	}

	let value;
	try {
		value = JSON.parse(source);
	}
	catch (error) {
		throw new Error(`Table block contains invalid JSON: ${error.message}`);
	}

	if (!isObject(value)) {
		throw new Error('Table block must contain one JSON object.');
	}
	assertAllowedProperties(value, ALLOWED_PROPERTIES, 'Table');

	const columns = normalizeColumns(value.columns);
	return {
		title: normalizeText(value.title, 'Table title', 200),
		columns,
		rows: normalizeRows(value.rows, columns),
		search: normalizeBoolean(value.search, 'Table search', true),
		paging: normalizeBoolean(value.paging, 'Table paging', true),
		pageSize: normalizePageSize(value.page_size)
	};
}

function createGridOptions(data, module, options) {
	const plugins = [];
	if (data.search) {
		plugins.push(module.SearchPlugin);
	}
	if (data.paging) {
		plugins.push(module.PageSizePlugin);
	}
	plugins.push(module.InfoPlugin);
	if (data.paging) {
		plugins.push(module.PagingPlugin);
	}

	return {
		strings: {
			search: getString(options, 'search', 'Search'),
			searchPlaceholder: getString(options, 'searchPlaceholder', 'Search table'),
			rowsPerPage: getString(options, 'rowsPerPage', 'Rows per page'),
			clear: getString(options, 'clear', 'Clear'),
			previous: getString(options, 'previous', 'Prev'),
			next: getString(options, 'next', 'Next'),
			pageStatus: getString(options, 'pageStatus', 'Page {page} of {totalPages}'),
			noRecords: getString(options, 'noRecords', 'No records'),
			recordsRange: getString(options, 'recordsRange', 'Records {from} to {to} of {total}'),
			recordsRangeFiltered: getString(options, 'recordsRangeFiltered', 'Records {from} to {to} of {filteredTotal} (filtered from {total})')
		},
		layout: module.createClassicLayout({
			top: data.search || data.paging ? ['toolbar'] : [],
			bottom: data.paging ? ['footerInfo', 'footerPaging'] : ['footerInfo']
		}),
		columns: data.columns,
		adapter: new module.ArrayAdapter(data.rows),
		pageSize: data.pageSize,
		pageSizeOptions: [5, 10, 20, 50],
		features: {
			paging: data.paging
		},
		table: {
			zebraRows: true,
			resizableColumns: false,
			reorderableColumns: false
		},
		plugins,
		pluginOptions: {
			search: {
				showClearButton: true
			},
			pageSize: {},
			info: {
				displayMode: 'range'
			},
			paging: {
				showWhenSinglePage: false
			}
		}
	};
}

function createErrorElement(document, error, options) {
	const element = document.createElement('div');
	element.className = 'base3-chatbot-grid base3-chatbot-grid-error';
	element.setAttribute('role', 'alert');

	const prefix = getString(options, 'renderError', 'Table could not be rendered.');
	const message = String(error?.message || error || '').trim();
	element.textContent = message ? `${prefix} ${message}` : prefix;

	return element;
}

async function renderCodeBlock(context, state, code) {
	if (!code || code.dataset?.base3GridState) {
		return;
	}

	const container = code.parentElement;
	if (!container || typeof container.replaceWith !== 'function') {
		return;
	}

	code.dataset.base3GridState = 'rendering';
	const document = code.ownerDocument || getDocument(context);
	let host = null;

	try {
		const data = parseTable(code);
		const module = await resolveGridModule(context, state.options);
		if (state.destroyed || code.isConnected === false) {
			return;
		}

		host = document.createElement('section');
		host.className = 'base3-chatbot-grid';
		host.setAttribute('role', 'region');
		host.setAttribute('aria-label', data.title || getString(state.options, 'aria', 'Data table'));

		if (data.title) {
			const title = document.createElement('h4');
			title.className = 'base3-chatbot-grid-title';
			title.textContent = data.title;
			host.appendChild(title);
		}

		const gridHost = document.createElement('div');
		gridHost.className = 'base3-chatbot-grid-host';
		host.appendChild(gridHost);
		container.replaceWith(host);

		const grid = new module.ModularGrid(gridHost, createGridOptions(data, module, state.options));
		await grid.init();
		compactToolbar(gridHost, state.options);
		if (state.destroyed) {
			grid.destroy();
			return;
		}
		state.grids.add(grid);
	}
	catch (error) {
		if (state.destroyed) {
			return;
		}
		const errorElement = createErrorElement(document, error, state.options);
		if (host && typeof host.replaceWith === 'function') {
			host.replaceWith(errorElement);
		}
		else if (code.isConnected !== false) {
			container.replaceWith(errorElement);
		}
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

function getMessageElement(payload) {
	return payload?.content || payload?.element || null;
}

export const ModularGridPlugin = {
	name: 'tables',

	install(context) {
		this.states ??= new WeakMap();

		const state = {
			grids: new Set(),
			destroyed: false,
			options: context.getPluginOptions(),
			unsubscribe: []
		};
		this.states.set(context.chatbot, state);
		ensureHostStyles(context.root);

		state.unsubscribe.push(
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
		state.grids.forEach((grid) => {
			if (grid && typeof grid.destroy === 'function') {
				grid.destroy();
			}
		});
		state.grids.clear();
		this.states.delete(context.chatbot);
	}
};
