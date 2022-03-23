const { DROP_STATEMENTS } = require('./constants');

const commentDropStatements = (script = '') =>
	script
		.split('\n')
		.map(line => {
			if (DROP_STATEMENTS.some(statement => line.includes(statement))) {
				return `-- ${line}`;
			} else {
				return line;
			}
		})
		.join('\n');

module.exports = {
	commentDropStatements,
};
