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
    interval: {},
    boolean: {
        mode: 'boolean',
    },
    int4range: {
        capacity: 4,
        mode: 'range',
    },
    int8range: {
        capacity: 8,
        mode: 'range',
    },
    numrange: {
        capacity: 12,
        mode: 'decimal',
        mode: 'range',
    },
    daterange: {
        format: 'YYYY-MM-DD',
        mode: 'range',
    },
    tsrange: {
        format: 'YYYY-MM-DD hh:mm:ss',
        mode: 'range',
    },
    tstzrange: {
        format: 'YYYY-MM-DD hh:mm:ss',
        mode: 'range',
    },

    int4multirange: {
        capacity: 4,
        mode: 'multirange',
    },
    int8multirange: {
        capacity: 12,
        mode: 'decimal',
        mode: 'multirange',
    },
    nummultirange: {
        capacity: 12,
        mode: 'decimal',
        mode: 'multirange',
    },
    datemultirange: {
        format: 'YYYY-MM-DD',
        mode: 'multirange',
    },
    tsmultirange: {
        format: 'YYYY-MM-DD hh:mm:ss',
        mode: 'multirange',
    },
    tstzmultirange: {
        format: 'YYYY-MM-DD hh:mm:ss',
        mode: 'multirange',
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
