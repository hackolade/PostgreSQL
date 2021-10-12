module.exports = ({
    _,
    wrap,
    assignTemplates,
    templates,
    commentIfDeactivated,
    getNamePrefixedWithSchemaName,
    wrapComment,
}) => {
    const addLength = (type, length) => {
        return `${type}(${length})`;
    };

    const addScalePrecision = (type, precision, scale) => {
        if (_.isNumber(scale)) {
            return `${type}(${precision},${scale})`;
        } else {
            return `${type}(${precision})`;
        }
    };

    const addPrecision = (type, precision) => {
        if (_.isNumber(precision)) {
            return `${type}(${precision})`;
        }

        return type;
    };

    const addWithTimezone = (type, with_timezone) => {
        if (with_timezone) {
            return `${type} WITH TIME ZONE`;
        }

        return type;
    };

    const canHaveLength = type => ['char', 'varchar', 'bit', 'varbit'].includes(type);
    const canHavePrecision = type => type === 'numeric';
    const canHaveTimePrecision = type => ['time', 'timestamp'].includes(type);
    const canHaveScale = type => type === 'numeric';

    const decorateType = (type, columnDefinition) => {
        if (canHaveLength(type) && _.isNumber(columnDefinition.length)) {
            return addLength(type, columnDefinition.length);
        } else if (canHavePrecision(type) && canHaveScale(type) && _.isNumber(columnDefinition.precision)) {
            return addScalePrecision(type, columnDefinition.precision, columnDefinition.scale);
        } else if (canHavePrecision(type) && _.isNumber(columnDefinition.precision)) {
            return addPrecision(type, columnDefinition.precision);
        } else if (
            canHaveTimePrecision(type) &&
            (_.isNumber(columnDefinition.timePrecision) || columnDefinition.with_timezone)
        ) {
            return addWithTimezone(addPrecision(type, columnDefinition.timePrecision), columnDefinition.with_timezone);
        }

        return type;
    };

    const isString = type => ['char', 'varchar', 'text', 'bit', 'varbit'].includes(type);
    const isDateTime = type => ['date', 'time', 'timestamp', 'interval'].includes(type);

    const escapeQuotes = str => _.trim(str).replace(/(\')+/g, "'$1");

    const decorateDefault = (type, defaultValue) => {
        const constantsValues = ['current_timestamp', 'null'];
        if ((isString(type) || isDateTime(type)) && !constantsValues.includes(_.toLower(defaultValue))) {
            return wrap(escapeQuotes(defaultValue), '"', '"');
        } else {
            return defaultValue;
        }
    };

    const getColumnComments = (tableName, columnDefinitions) => {
        return _.chain(columnDefinitions)
            .filter('comment')
            .map(columnData => {
                const comment = assignTemplates(templates.comment, {
                    object: 'COLUMN',
                    objectName: getNamePrefixedWithSchemaName(columnData.name, tableName),
                    comment: wrapComment(columnData.comment),
                });

                return commentIfDeactivated(comment, columnData);
            })
            .join('\n')
            .value();
    };

    return {
        decorateType,
        decorateDefault,
        getColumnComments,
    };
};
