/**
 * @typedef {import('./types').ColumnDefinition} ColumnDefinition
 * @typedef {import('./types').JsonSchema} JsonSchema
 * @typedef {import('./types').ConstraintDto} ConstraintDto
 */
const { toLower } = require('lodash');

const types = require('./configs/descriptors');
const defaultTypes = require('./configs/defaultTypes');
const { decorateType } = require('./ddlProvider/ddlHelpers/columnDefinitionHelper');
const { getCompositeKeyConstraints, getColumnConstraints } = require('./ddlProvider/ddlHelpers/keyHelper');

class DbtProvider {
	/**
	 * @returns {DbtProvider}
	 */
	static createDbtProvider() {
		return new DbtProvider();
	}

	/**
	 * @param {string} type
	 * @returns {string | undefined}
	 */
	getDefaultType(type) {
		return defaultTypes[type];
	}

	/**
	 * @returns {Record<string, object>}
	 */
	getTypesDescriptors() {
		return types;
	}

	/**
	 * @param {string} type
	 * @returns {boolean}
	 */
	hasType(type) {
		return Object.keys(types).map(toLower).includes(toLower(type));
	}

	/**
	 * @param {{ type: string; columnDefinition: ColumnDefinition }}
	 * @returns {string}
	 */
	decorateType({ type, columnDefinition }) {
		return decorateType(type, columnDefinition);
	}

	/**
	 * @param {{ jsonSchema: JsonSchema }}
	 * @returns {ConstraintDto[]}
	 */
	getCompositeKeyConstraints({ jsonSchema }) {
		return getCompositeKeyConstraints({ jsonSchema });
	}

	/**
	 * @param {{ columnDefinition: ColumnDefinition; jsonSchema: JsonSchema }}
	 * @returns {ConstraintDto[]}
	 */
	getColumnConstraints({ columnDefinition, jsonSchema }) {
		return getColumnConstraints({ columnDefinition, jsonSchema });
	}
}

module.exports = DbtProvider;
