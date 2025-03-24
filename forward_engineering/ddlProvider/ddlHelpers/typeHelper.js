const isString = type => ['char', 'varchar', 'text', 'bit', 'varbit'].includes(type);

const isDateTime = type => ['date', 'time', 'timestamp', 'interval'].includes(type);

const isVector = type => ['vector', 'halfvec', 'sparsevec'].includes(type);

module.exports = {
	isString,
	isDateTime,
	isVector,
};
