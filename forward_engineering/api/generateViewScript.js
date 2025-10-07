function generateViewScript(data, logger, callback, app) {
	callback(new Error('Forward-Engineering of delta model on view level is not supported'));
}

module.exports = {
	generateViewScript,
};
