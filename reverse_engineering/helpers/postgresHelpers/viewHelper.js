const { clearEmptyPropertiesInObject } = require('./common');

let _ = null;

const setDependencies = app => {
    _ = app.require('lodash');
};

const VIEW_SUFFIX = ' (v)';

const isViewByTableType = table_type => table_type === 'VIEW';
const isViewByName = name => _.endsWith(name, VIEW_SUFFIX);
const removeViewNameSuffix = name => name.slice(0, -VIEW_SUFFIX.length);
const setViewSuffix = name => `${name}${VIEW_SUFFIX}`;

const generateCreateViewScript = (viewName, viewData) => {
    return `CREATE VIEW ${viewName} AS ${viewData.view_definition}`;
};

const prepareViewData = (viewData, viewOptions) => {
    const data = {
        withCheckOption: Boolean(viewData.check_option),
        checkTestingScope: getCheckTestingScope(viewData.check_option),
        view_option: _.join(viewOptions?.view_options, ','),
        temporary: viewOptions?.persistence === 't',
        recursive: isViewRecursive(viewData),
    };

    return clearEmptyPropertiesInObject(data);
};

const getCheckTestingScope = check_option => {
    if (check_option === 'NONE') {
        return '';
    }

    return check_option;
};

const isViewRecursive = viewData => {
    return _.startsWith(_.trim(viewData.view_definition), 'WITH RECURSIVE');
};

module.exports = {
    setDependencies,
    isViewByTableType,
    isViewByName,
    removeViewNameSuffix,
    generateCreateViewScript,
    setViewSuffix,
    prepareViewData,
};
