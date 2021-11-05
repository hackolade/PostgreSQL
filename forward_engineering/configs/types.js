module.exports = {
    char: {
        size: 1,
    },
    varchar: {
        mode: 'varying',
    },
    text: {
        mode: 'text',
    },
    bit: {
        size: 1,
        mode: 'bit',
    },
    varbit: {
        size: 1,
        mode: 'varying',
    },
    tsvector: {
        mode: 'text',
    },
    tsquery: {
        mode: 'text',
    },
    smallint: {
        capacity: 2,
    },
    integer: {
        capacity: 4,
    },
    bigint: {
        capacity: 8,
    },
    numeric: {
        capacity: 12,
        mode: 'decimal',
    },
    real: {
        capacity: 4,
        mode: 'floating',
    },
    'double precision': {
        capacity: 8,
        mode: 'floating',
    },
    smallserial: {
        capacity: 2,
    },
    serial: {
        capacity: 4,
    },
    bigserial: {
        capacity: 8,
    },
    money: {
        capacity: 8,
        mode: 'decimal',
    },
    bytea: {
        size: 4,
        mode: 'binary',
    },
    date: {
        format: 'YYYY-MM-DD',
    },
    time: {
        format: 'hh:mm:ss.nnnnnn',
    },
    timestamp: {
        format: 'YYYY-MM-DD hh:mm:ss',
    },
    interval: {
        format: 'PnYnMnDTnHnMnS',
    },
    boolean: {
        mode: 'boolean',
    },
    int4range: {
        mode: 'range',
        modeType: 'integer',
        capacity: 4,
    },
    int8range: {
        mode: 'range',
        modeType: 'integer',
        capacity: 8,
    },
    numrange: {
        mode: 'range',
        modeType: 'decimal',
        capacity: 12,
    },
    daterange: {
        mode: 'range',
        modeType: 'date',
        format: 'YYYY-MM-DD',
    },
    tsrange: {
        mode: 'range',
        modeType: 'timestamp',
        format: 'YYYY-MM-DD hh:mm:ss',
    },
    tstzrange: {
        mode: 'range',
        modeType: 'timestamp',
        format: 'YYYY-MM-DD hh:mm:ss.nnnZ',
    },

    int4multirange: {
        mode: 'multirange',
        modeType: 'integer',
        capacity: 4,
    },
    int8multirange: {
        mode: 'multirange',
        modeType: 'integer',
        capacity: 8,
    },
    nummultirange: {
        mode: 'multirange',
        modeType: 'decimal',
        capacity: 12,
    },
    datemultirange: {
        mode: 'multirange',
        modeType: 'date',
        format: 'YYYY-MM-DD',
    },
    tsmultirange: {
        mode: 'multirange',
        modeType: 'timestamp',
        format: 'YYYY-MM-DD hh:mm:ss',
    },
    tstzmultirange: {
        mode: 'multirange',
        modeType: 'timestamp',
        format: 'YYYY-MM-DD hh:mm:ss.nnnZ',
    },
    geometry: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    point: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    line: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    lseg: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    box: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    path: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    polygon: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    circle: {
        format: 'euclidian',
        mode: 'geospatial',
    },
    inet: {
        mode: 'ip',
    },
    cidr: {
        mode: 'ip',
    },
    macaddr: {},
    macaddr8: {},
    uuid: {
        mode: 'uuid',
    },
    oid: {
        mode: 'uuid',
    },
    regclass: {},
    regcollation: {},
    regconfig: {},
    regdictionary: {},
    regnamespace: {},
    regoper: {},
    regoperator: {},
    regproc: {},
    regprocedure: {},
    regrole: {},
    regtype: {},
    xml: {
        mode: 'xml',
    },
    json: {
        format: 'semi-structured',
    },
    jsonb: {
        format: 'semi-structured',
    },
    composite: {
        format: 'semi-structured',
        mode: 'object',
    },
    enum: {
        mode: 'enum',
    },
    range_udt: {
        mode: 'range',
    },
    domain: {
        mode: 'domain',
    },
};
