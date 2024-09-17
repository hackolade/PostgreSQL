/**
 * @param {{
 * index: number;
 * numberOfStatements: number;
 * lastIndexOfActivatedStatement: number;
 * delimiter: string;
 * }}
 * @return {string}
 * */
const getDelimiter = ({ index, numberOfStatements, lastIndexOfActivatedStatement, delimiter }) => {
	const isLastStatement = index === numberOfStatements - 1;
	const isLastActivatedStatement = index === lastIndexOfActivatedStatement;

	if (isLastStatement) {
		return '';
	}

	if (isLastActivatedStatement) {
		return ' --' + delimiter;
	}

	return delimiter;
};

/**
 * @param {{
 * statements?: string[];
 * delimiter?: string;
 * indent?: string;
 * }}
 * @return {string}
 * */
const joinActivatedAndDeactivatedStatements = ({ statements = [], delimiter = ',', indent = '\n' }) => {
	const lastIndexOfActivatedStatement = statements.findLastIndex(statement => !statement.startsWith('--'));
	const numberOfStatements = statements.length;

	return statements
		.map((statement, index) => {
			const currentDelimiter = getDelimiter({
				index,
				numberOfStatements,
				lastIndexOfActivatedStatement,
				delimiter,
			});

			return statement + currentDelimiter;
		})
		.join(indent);
};

module.exports = {
	joinActivatedAndDeactivatedStatements,
};
