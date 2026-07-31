export const instances = [];

export class ArrayAdapter {
	constructor(rows = []) {
		this.rows = rows.slice();
	}
}

export class ModularGrid {
	constructor(container, options = {}) {
		this.container = container;
		this.options = options;
		this.initialized = false;
		this.destroyed = false;
		instances.push(this);
	}

	async init() {
		this.initialized = true;
		return this;
	}

	destroy() {
		this.destroyed = true;
	}
}

export function createClassicLayout(options = {}) {
	return {
		type: 'classic',
		options
	};
}

export const SearchPlugin = { name: 'search' };
export const PageSizePlugin = { name: 'pageSize' };
export const InfoPlugin = { name: 'info' };
export const PagingPlugin = { name: 'paging' };
