const queryConstants = {
    PING: 'SELECT schema_name FROM information_schema.schemata LIMIT 1;',
    GET_VERSION: 'SELECT version()',
    GET_SCHEMA_NAMES: 'SELECT schema_name FROM information_schema.schemata;',
    GET_TABLE_NAMES: `
        SELECT table_name, table_type
            FROM information_schema.tables
 	        WHERE table_schema = $1
	        ORDER BY table_name;`,
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
    GET_TABLE_COLUMNS: `
        SELECT * FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = $2
            ORDER BY ordinal_position`,
    GET_TABLE_COLUMNS_ADDITIONAL_DATA: `
        SELECT attname AS name, attndims AS number_of_array_dimensions 
            FROM pg_attribute
	        WHERE attrelid = $1;`,
    GET_DESCRIPTION_BY_OID: `SELECT obj_description($1)`,
    GET_ROWS_COUNT: fullTableName => `SELECT COUNT(*) AS quantity FROM ${fullTableName};`,
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
    GET_TABLE_INDEXES: `
        SELECT indexname,
               index_method,
               index_unique,
               array_agg(attname
                         ORDER BY ord)::text[] AS columns,
               array_agg(coll
                         ORDER BY ord) AS collations,
               array_agg(opclass
                         ORDER BY ord) AS opclasses,
               array_agg(expression
                         ORDER BY ord) AS expressions,
               array_agg(ascending
                         ORDER BY ord) AS ascendings,
               array_agg(nulls_first
                         ORDER BY ord) AS nulls_first,
        		reloptions AS storage_parameters,
        		tablespace_name
        FROM
            (SELECT ct.oid AS table_oid,
                    c.relname AS indexname,
                    m.amname AS index_method,
                    indexes.indisunique AS index_unique,
                    indexes.ord,
                    attribute.attname,
        	 		c.reloptions,
        	 		tablespace_t.spcname AS tablespace_name,
                    CASE
                        WHEN collation_namespace.nspname is not null THEN format('%I.%I',collation_namespace.nspname,collation_t.collname)
                    END AS coll,
                    CASE
                        WHEN opclass_t.opcname is not null THEN format('%I.%I',opclas_namespace.nspname,opclass_t.opcname)
                    END AS opclass,
                    CASE
                        WHEN indexes.ord > 0 THEN pg_index_column_has_property(indexes.indexrelid, indexes.key, 'asc')
                    END AS ascending,
                    CASE
                        WHEN indexes.ord > 0 THEN pg_index_column_has_property(indexes.indexrelid, indexes.key, 'nulls_first')
                    END AS nulls_first,
                    pg_get_indexdef(indexes.indexrelid, ord, false) AS expression
             FROM
                 (SELECT *,
                         generate_series(1,array_length(i.indkey,1)) AS ord,
                         unnest(i.indkey) AS key,
                         unnest(i.indcollation) AS coll,
                         unnest(i.indclass) AS class,
                         unnest(i.indoption) AS option
                  FROM pg_index i) indexes
             JOIN pg_class c ON (c.oid=indexes.indexrelid)
             JOIN pg_class ct ON (ct.oid=indexes.indrelid)
             JOIN pg_am m ON (m.oid=c.relam)
             LEFT JOIN pg_attribute attribute ON (attribute.attrelid=indexes.indrelid
                                                  AND attribute.attnum=indexes.key)
             LEFT JOIN pg_collation collation_t ON (collation_t.oid=indexes.coll)
             LEFT JOIN pg_namespace collation_namespace ON (collation_namespace.oid=collation_t.collnamespace)
             LEFT JOIN pg_opclass opclass_t ON (opclass_t.oid=indexes.class)
             LEFT JOIN pg_namespace opclas_namespace ON (opclas_namespace.oid=opclass_t.opcnamespace)
        	 LEFT JOIN pg_tablespace tablespace_t ON (tablespace_t.oid = c.reltablespace)) s2
        WHERE table_oid = $1
        GROUP BY indexname,
                 index_method,
                 index_unique,
        		 reloptions,
        		 tablespace_name;`,
    GET_TABLE_FOREIGN_KEYS: `
        SELECT pcon.conname AS relationship_name, 
                pcon.conkey AS table_columns_positions,
                pc_foreign_table.relname AS foreign_table_name, 
                ARRAY(
                    SELECT column_name FROM unnest(pcon.confkey) AS column_position 
                    JOIN information_schema.columns ON (ordinal_position = column_position)
                    WHERE table_name = pc_foreign_table.relname AND table_schema = foreign_table_namespace.nspname)::text[] AS foreign_columns,
                foreign_table_namespace.nspname AS foreign_table_schema
            FROM pg_constraint AS pcon
            LEFT JOIN pg_class AS pc ON pcon.conindid = pc.oid
            LEFT JOIN pg_tablespace AS pt ON pc.reltablespace = pt.oid
            LEFT JOIN pg_class AS pc_foreign_table ON (pcon.confrelid = pc_foreign_table.oid)
            JOIN pg_namespace AS foreign_table_namespace ON (pc_foreign_table.relnamespace = foreign_table_namespace.oid)
            WHERE pcon.conrelid = $1 AND pcon.contype = 'f';`,
    GET_VIEW_DATA: `SELECT * FROM information_schema.views WHERE table_name = $1 AND table_schema = $2;`,
    GET_VIEW_OPTIONS: `
        SELECT reloptions AS view_options,
            relpersistence AS persistence 
        FROM pg_class 
        WHERE relname = $1 AND relnamespace = $2;`,
};

const getQueryName = query => {
    const queryEntry =
        Object.entries(queryConstants).find(([queryName, constantQuery]) => query === constantQuery) || [];

    return queryEntry[0];
};

module.exports = {
    getQueryName,
    ...queryConstants,
};
