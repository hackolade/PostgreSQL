module.exports = {
    PING: 'SELECT schema_name FROM information_schema.schemata LIMIT 1;',
    GET_SCHEMA_NAMES: 'SELECT schema_name FROM information_schema.schemata;',
    GET_TABLE_NAMES: 'SELECT * FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name;',
};
