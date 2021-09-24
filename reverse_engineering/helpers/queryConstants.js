module.exports = {
    PING: 'SELECT schema_name FROM information_schema.schemata LIMIT 1;',
    GET_SCHEMA_NAMES: 'SELECT schema_name FROM information_schema.schemata;',
    GET_TABLE_NAMES: 'SELECT * FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name;',
    GET_NAMESPACE_OID: 'SELECT oid FROM pg_namespace WHERE nspname = $1',
    GET_TABLE_LEVEL_DATA: `SELECT pc.relpersistence, pc.reloptions, pt.spcname, ppt.partstrat, ppt.partattrs
        FROM pg_class AS pc 
        LEFT JOIN pg_tablespace AS pt 
        ON pc.reltablespace = pt.oid
        LEFT JOIN pg_partitioned_table AS ppt
		ON pc.oid = ppt.partrelid
        WHERE pc.relname = $1 AND pc.relnamespace = $2;`,
};
