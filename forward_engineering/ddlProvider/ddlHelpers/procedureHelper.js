const { map } = require('lodash');
const templates = require('../templates');
const assignTemplates = require('../../utils/assignTemplates');
const { getFunctionArguments, getNamePrefixedWithSchemaName } = require('../../utils/general');

const getProceduresScript = (schemaName, procedures) => {
	return map(procedures, procedure => {
		const orReplace = procedure.orReplace ? ' OR REPLACE' : '';

		return assignTemplates(templates.createProcedure, {
			name: getNamePrefixedWithSchemaName(procedure.name, schemaName),
			orReplace: orReplace,
			parameters: getFunctionArguments(procedure.inputArgs),
			language: procedure.language,
			body: procedure.body,
		});
	}).join('\n');
};

module.exports = {
	getProceduresScript,
};
