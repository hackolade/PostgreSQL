let _ = null;

const setDependencies = app => {
    _ = app.require('lodash');
};

const clearEmptyPropertiesInObject = obj =>
    _.chain(obj)
        .toPairs()
        .filter(([key, value]) => Boolean(value))
        .fromPairs()
        .value();

module.exports = {
    clearEmptyPropertiesInObject,
    setDependencies,
};
