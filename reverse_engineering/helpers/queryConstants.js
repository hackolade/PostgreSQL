module.exports = {
    PING: 'SELECT schema_name FROM information_schema.schemata LIMIT 1;',
    GET_SCHEMA_NAMES: 'SELECT schema_name FROM information_schema.schemata;',
    GET_TABLE_NAMES: `
        SELECT t.table_name, t.table_type, pc.relispartition AS is_table_partitioned
	        FROM information_schema.tables as t
 	        INNER JOIN pg_class as pc
 	        ON t.table_name = pc.relname
 	        INNER JOIN pg_namespace AS pn
 	        ON t.table_schema = pn.nspname
 	        WHERE t.table_schema = $1 AND pn.nspname = $1
	        ORDER BY t.table_name;`,
    GET_NAMESPACE_OID: 'SELECT oid FROM pg_namespace WHERE nspname = $1',
    GET_TABLE_LEVEL_DATA: `
        SELECT pc.oid, pc.relpersistence, pc.reloptions, pt.spcname
            FROM pg_class AS pc 
            LEFT JOIN pg_tablespace AS pt 
            ON pc.reltablespace = pt.oid
            WHERE pc.relname = $1 AND pc.relnamespace = $2;`,
    GET_TABLE_PARTITION_DATA: `
        SELECT partstrat as partition_method,
	            partattrs::int2[] as partition_attributes_positions,
	            pg_get_expr(partexprs, partrelid) AS expressions
            FROM pg_partitioned_table
            WHERE partrelid = $1;`,
    GET_TABLE_ATTRIBUTES_WITH_POSITIONS: `
        SELECT attname as name, attnum as position
            FROM pg_attribute
            WHERE attrelid = $1 AND attnum > 0;`,
    GET_TABLE_COLUMNS: `
        SELECT ic.*, pa.attndims FROM information_schema.columns AS ic
	        INNER JOIN pg_attribute AS pa
	        ON pa.attname = ic.column_name
	        WHERE ic.table_name = $1 AND table_schema = $2 AND pa.attrelid = $3
            ORDER BY ordinal_position;`,
    GET_DESCRIPTION_BY_OID: `SELECT obj_description($1)`,
    GET_ROWS_COUNT: fullTableName => `SELECT COUNT(*) FROM ${fullTableName};`,
    GET_SAMPLED_DATA: fullTableName => `SELECT * FROM ${fullTableName} LIMIT $1;`,
    GET_INHERITS_PARENT_TABLE_NAME: `
        SELECT pc.relname AS parent_table_name FROM pg_inherits AS pi
	        INNER JOIN pg_class AS pc
	        ON pc.oid = pi.inhparent
	        WHERE pi.inhrelid = $1;`,
    GET_TABLE_CONSTRAINTS: `
        SELECT pcon.conname AS constraint_name, 
	            pcon.contype AS constraint_type,
	            pcon.connoinherit AS no_inherit,
	            pcon.conkey AS constraint_keys,
	            pg_get_expr(pcon.conbin, pcon.conrelid) AS expression,
	            obj_description(pcon.oid) AS description,
	            pc.reloptions AS storage_parameters,
	            pt.spcname AS tablespace
	        FROM pg_constraint AS pcon
	        LEFT JOIN pg_class AS pc
	        ON pcon.conindid = pc.oid
	        LEFT JOIN pg_tablespace AS pt
	        ON pc.reltablespace = pt.oid
	        WHERE pcon.conrelid = $1;`,
};
