let _ = null;

const setDependencies = app => {
    _ = app.require('lodash');
};

const columnPropertiesMapper = {
    columns_default: 'default',
    is_nullable: {
        keyword: 'required',
        values: {
            YES: false,
            NO: true,
        },
    },
    not_null: 'required',
    data_type: 'type',
    numeric_precision: 'precision',
    numeric_scale: 'scale',
    datetime_precision: 'timePrecision',
    interval_type: 'intervalOptions',
    collation_name: 'collationRule',
    column_name: 'name',
    number_of_array_dimensions: 'numberOfArrayDimensions',
    udt_name: 'udt_name',
    character_maximum_length: 'length',
    description: 'description',
};

const mapColumnData = userDefinedTypes => column => {
    return _.chain(column)
        .toPairs()
        .map(([key, value]) => [
            columnPropertiesMapper[key]?.keyword || columnPropertiesMapper[key],
            _.get(columnPropertiesMapper, `${key}.values.${value}`, value),
        ])
        .filter(([key, value]) => key && !_.isNil(value))
        .fromPairs()
        .thru(setColumnType(userDefinedTypes))
        .value();
};

const setColumnType = userDefinedTypes => column => ({
    ...column,
    ...getType(userDefinedTypes, column),
});

const getType = (userDefinedTypes, column) => {
    if (column.type === 'ARRAY') {
        return getArrayType(userDefinedTypes, column);
    }

    if (column.type === 'USER-DEFINED') {
        return mapType(userDefinedTypes, column.udt_name);
    }

    return mapType(userDefinedTypes, column.type);
};

const getArrayType = (userDefinedTypes, column) => {
    const typeData = mapType(userDefinedTypes, column.udt_name.slice(1));

    return {
        ...typeData,
        array_type: _.fill(Array(column.numberOfArrayDimensions), ''),
    };
};

const mapType = (userDefinedTypes, type) => {
    switch (type) {
        case 'bigint':
        case 'bigserial':
        case 'smallint':
        case 'integer':
        case 'numeric':
        case 'real':
        case 'double precision':
        case 'smallserial':
        case 'serial':
        case 'money':
            return { type: 'numeric', mode: type };
        case 'int8':
            return { type: 'numeric', mode: 'bigint' };
        case 'int2':
            return { type: 'numeric', mode: 'smallint' };
        case 'int4':
            return { type: 'numeric', mode: 'integer' };
        case 'float4':
            return { type: 'numeric', mode: 'real' };
        case 'float8':
            return { type: 'numeric', mode: 'double precision' };
        case 'bit':
        case 'char':
        case 'text':
        case 'tsvector':
        case 'tsquery':
            return { type: 'char', mode: type };
        case 'bit varying':
            return { type: 'char', mode: 'varbit' };
        case 'character':
            return { type: 'char', mode: 'char' };
        case 'character varying':
            return { type: 'char', mode: 'varchar' };
        case 'bpchar':
            return { type: 'char', mode: 'char' };
        case 'point':
        case 'line':
        case 'lseg':
        case 'box':
        case 'path':
        case 'polygon':
        case 'circle':
            return { type: 'geometry', mode: type };
        case 'bytea':
            return { type: 'binary', mode: type };
        case 'inet':
        case 'cidr':
        case 'macaddr':
        case 'macaddr8':
            return { type: 'inet', mode: type };
        case 'date':
        case 'time':
        case 'timestamp':
        case 'interval':
            return { type: 'datetime', mode: type };
        case 'timestamptz':
        case 'timestamp with time zone':
            return { type: 'datetime', mode: 'timestamp', with_timezone: true };
        case 'timestamp without time zone':
            return { type: 'datetime', mode: 'timestamp' };
        case 'timetz':
        case 'time with time zone':
            return { type: 'datetime', mode: 'time', with_timezone: true };
        case 'time without time zone':
            return { type: 'datetime', mode: 'time' };
        case 'json':
        case 'jsonb':
            return { type: 'json', mode: type, subtype: 'object' };
        case 'int4range':
        case 'int8range':
        case 'numrange':
        case 'daterange':
        case 'tsrange':
        case 'tstzrange':
            return { type: 'range', mode: type };
        case 'int4multirange':
        case 'int8multirange':
        case 'nummultirange':
        case 'tsmultirange':
        case 'tstzmultirange':
        case 'datemultirange':
            return { type: 'multirange', mode: type };
        case 'uuid':
        case 'xml':
        case 'boolean':
            return { type };
        case 'bool':
            return { type: 'boolean' };
        case 'oid':
        case 'regclass':
        case 'regcollation':
        case 'regconfig':
        case 'regdictionary':
        case 'regnamespace':
        case 'regoper':
        case 'regoperator':
        case 'regproc':
        case 'regprocedure':
        case 'regrole':
        case 'regtype':
            return { type: 'oid', mode: type };

        default: {
            if (_.some(userDefinedTypes, { name: type })) {
                return { $ref: `#/definitions/${type}` };
            }

            return { type: 'char', mode: 'varchar' };
        }
    }
};

const setSubtypeFromSampledJsonValues = (columns, documents) => {
    const sampleDocument = _.first(documents) || {};

    return columns.map(column => {
        if (column.type !== 'json') {
            return column;
        }

        const sampleValue = sampleDocument[column.name];
        const parsedValue = safeParse(sampleValue);
        const jsonType = getParsedJsonValueType(parsedValue);

        return {
            ...column,
            subtype: jsonType,
        };
    });
};

const safeParse = json => {
    try {
        return JSON.parse(json);
    } catch (error) {
        return {};
    }
};

const getParsedJsonValueType = value => {
    if (Array.isArray(value)) {
        return 'array';
    }

    const type = typeof value;

    if (type === 'undefined') {
        return 'object';
    }

    return type;
};

module.exports = {
    setDependencies,
    mapColumnData,
    setSubtypeFromSampledJsonValues,
};
