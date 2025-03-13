/**
 * @enum {string}
 */
const TABLE_TYPE = {
	foreignTable: 'f',
	regularTable: 'r',
	partitionedTable: 'p',
	materializedView: 'm',
	view: 'v',
};

module.exports = {
	TABLE_TYPE,
};
