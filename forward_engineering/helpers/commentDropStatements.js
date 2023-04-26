const { DROP_STATEMENTS } = require('./constants');

const isDropNotNullStatementRegex = /ALTER TABLE IF EXISTS .+ ALTER COLUMN .+ DROP NOT NULL;/;

const isDropConstraintStatementRegex = /ALTER TABLE IF EXISTS .+ DROP CONSTRAINT IF EXISTS .+;/;

const dropCommentRegex = /COMMENT ON (TABLE|SCHEMA|VIEW|COLUMN) .+ IS NULL;/;

/**
 * @param scriptLine {string}
 * @return {boolean}
 * */
const shouldStatementBeCommentedOut = (scriptLine) => {
	const doesContainDropStatements = DROP_STATEMENTS.some(statement => scriptLine.includes(statement));
	if (doesContainDropStatements) {
		return true;
	}

	return [
		isDropNotNullStatementRegex,
		isDropConstraintStatementRegex,
		dropCommentRegex,
	].some(regex => regex.test(scriptLine));
}

/**
 * @param script {string}
 * @return {boolean}
 * */
const doesScriptContainDropStatements = (script) => {
	return script.split('\n')
		.some(shouldStatementBeCommentedOut);
}


const commentDropStatements = (script = '') =>
	script
		.split('\n')
		.map(line => {
			if (shouldStatementBeCommentedOut(line)) {
				return `-- ${line}`;
			}
			return line;
		})
		.join('\n');

module.exports = {
	commentDropStatements,
	doesScriptContainDropStatements,
};
