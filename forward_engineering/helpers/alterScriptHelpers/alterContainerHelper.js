const getAddContainerScript = containerName => {
	return `CREATE SCHEMA IF NOT EXISTS "${containerName}";`;
};

const getDeleteContainerScript = containerName => {
	return `DROP SCHEMA IF EXISTS "${containerName}";`;
};

module.exports = {
	getAddContainerScript,
	getDeleteContainerScript,
};
