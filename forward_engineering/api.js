const { generateScript } = require('./api/generateScript');
const { generateViewScript } = require('./api/generateViewScript');
const { generateContainerScript } = require('./api/generateContainerScript');
const { getDatabases } = require('./api/getDatabases');
const { applyToInstance } = require('./api/applyToInstance');
const { testConnection } = require('./api/testConnection');
const { isDropInStatements } = require('./api/isDropInStatements');

module.exports = {
	generateScript,
	generateViewScript,
	generateContainerScript,
	getDatabases,
	applyToInstance,
	testConnection,
	isDropInStatements,
};
