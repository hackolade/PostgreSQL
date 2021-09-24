module.exports = {
    PING: 'SELECT schema_name FROM information_schema.schemata LIMIT 1;',
    GET_SCHEMA_NAMES: 'SELECT schema_name FROM information_schema.schemata;',
    GET_TABLE_NAMES: 'SELECT * FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name;',
    GET_NAMESPACE_OID: 'SELECT oid FROM pg_namespace WHERE nspname = $1',
    GET_TABLE_LEVEL_DATA: `SELECT pc.relpersistence, pc.reloptions, pt.spcname
        FROM pg_class AS pc 
        LEFT JOIN pg_tablespace AS pt 
        ON pc.reltablespace = pt.oid
        WHERE pc.relname = $1 AND pc.relnamespace = $2;`,
};
