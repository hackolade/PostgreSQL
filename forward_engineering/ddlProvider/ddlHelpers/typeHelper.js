const isString = type => ['char', 'varchar', 'text', 'bit', 'varbit'].includes(type);

const isDateTime = type => ['date', 'time', 'timestamp', 'interval'].includes(type);

const isVector = type => ['vector', 'halfvec', 'sparsevec'].includes(type);

const isInet = type => ['inet', 'cidr', 'macaddr', 'macaddr8'].includes(type);

const isUUID = type => type === 'uuid';

module.exports = {
	isString,
	isDateTime,
	isVector,
	isInet,
	isUUID,
};
