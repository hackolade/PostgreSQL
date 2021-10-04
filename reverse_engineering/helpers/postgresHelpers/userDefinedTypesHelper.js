const { mapColumnData } = require('./columnHelper');

let _ = null;

const setDependencies = app => {
    _ = app.require('lodash');
};

const getUserDefinedTypes = udtResponse => {
    return _.chain(udtResponse)
        .map(typeData => {
            switch (typeData.type) {
                case 'e':
                    return getEnumType(typeData);
                case 'r':
                    return getRangeType(typeData);
                case 'c':
                    return getCompositeType(typeData);
                default:
                    return null;
            }
        })
        .compact()
        .value();
};

const getEnumType = typeData => {
    return {
        name: typeData.name,
        type: 'enum',
        enum: typeData.enum_values || [],
    };
};

const getRangeType = typeData => {
    return {
        name: typeData.name,
        type: 'range_type',
        rangeSubtype: typeData.range_subtype || '',
        operatorClass: typeData.range_opclass_name || '',
        collation: typeData.range_collation_name || '',
        canonicalFunction: typeData.range_canonical_proc || '',
        subtypeDiffFunction: typeData.range_diff_proc || '',
    };
};

const getCompositeType = typeData => {
    const columns = _.map(typeData.columns, mapColumnData([]));

    return {
        name: typeData.name,
        type: 'composite',
        properties: columns,
    };
};

const isTypeComposite = typeData => typeData.type === 'c';

module.exports = {
    setDependencies,
    getUserDefinedTypes,
    isTypeComposite,
};
