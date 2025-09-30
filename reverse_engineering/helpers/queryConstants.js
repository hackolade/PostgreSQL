const getGET_TABLE_INDEXES = postgresVersion => {
	return `
        SELECT indexname,
               index_method,
               index_unique,
               index_indnullsnotdistinct,
               number_of_keys,
               where_expression,
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
                    ${postgresVersion === 15 ? 'indexes.indnullsnotdistinct' : 'FALSE'} AS index_indnullsnotdistinct,
                    indexes.ord,
                    attribute.attname,
                     c.reloptions,
                     tablespace_t.spcname AS tablespace_name,
                    indexes.${postgresVersion === 10 ? 'indnatts' : 'indnkeyatts'} AS number_of_keys,
                    pg_catalog.pg_get_expr(indpred, indrelid) AS where_expression,
                    CASE
                        WHEN collation_namespace.nspname is not null THEN format('%I.%I',collation_namespace.nspname,collation_t.collname)
                    END AS coll,
                    CASE
                        WHEN opclass_t.opcname is not null THEN format('%I.%I',opclas_namespace.nspname,opclass_t.opcname)
                    END AS opclass,
                    CASE
                        WHEN indexes.ord > 0 THEN pg_catalog.pg_index_column_has_property(indexes.indexrelid, indexes.ord, 'asc')
                    END AS ascending,
                    CASE
                        WHEN indexes.ord > 0 THEN pg_catalog.pg_index_column_has_property(indexes.indexrelid, indexes.ord, 'nulls_first')
                    END AS nulls_first,
                    pg_catalog.pg_get_indexdef(indexes.indexrelid, ord, false) AS expression
             FROM
                 (SELECT *,
                         generate_series(1,array_length(i.indkey,1)) AS ord,
                         unnest(i.indkey) AS key,
                         unnest(i.indcollation) AS coll,
                         unnest(i.indclass) AS class,
                         unnest(i.indoption) AS option
                  FROM pg_catalog.pg_index i) indexes
             JOIN pg_catalog.pg_class c ON (c.oid=indexes.indexrelid)
             JOIN pg_catalog.pg_class ct ON (ct.oid=indexes.indrelid)
             JOIN pg_catalog.pg_am m ON (m.oid=c.relam)
             LEFT JOIN pg_catalog.pg_attribute attribute ON (attribute.attrelid=indexes.indrelid
                                                  AND attribute.attnum=indexes.key)
             LEFT JOIN pg_catalog.pg_collation collation_t ON (collation_t.oid=indexes.coll)
             LEFT JOIN pg_catalog.pg_namespace collation_namespace ON (collation_namespace.oid=collation_t.collnamespace)
             LEFT JOIN pg_catalog.pg_opclass opclass_t ON (opclass_t.oid=indexes.class)
             LEFT JOIN pg_catalog.pg_namespace opclas_namespace ON (opclas_namespace.oid=opclass_t.opcnamespace)
             LEFT JOIN pg_catalog.pg_tablespace tablespace_t ON (tablespace_t.oid = c.reltablespace)) s2
        WHERE table_oid = $1
        GROUP BY indexname,
                 index_method,
                 index_unique,
                 index_indnullsnotdistinct,
                 reloptions,
                 number_of_keys,
                 where_expression,
                 tablespace_name;
        `;
};

const getGET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL = postgresVersion => {
	const kindQuery =
		postgresVersion === 10 ? `CASE WHEN proiswindow is true THEN 'w' ELSE '' END AS kind` : 'prokind AS kind';

	return `
        SELECT obj_description(oid, 'pg_proc') AS description,
            proname AS function_name,
            provolatile AS volatility,
            proparallel AS parallel,
            proisstrict AS strict,
            proretset AS returns_set,
            proleakproof AS leak_proof,
            procost AS estimated_cost,
            prorows AS estimated_rows,
            prosrc AS body,
            ${kindQuery}
        FROM pg_catalog.pg_proc WHERE pronamespace = $1;`;
};

const getGET_FUNCTIONS_WITH_PROCEDURES = ({ extensionsToExclude = [] }) => {
	const extensionsStatement = extensionsToExclude.length ? extensionsToExclude.map(ext => `'${ext}'`).join(', ') : '';

	return `
		SELECT
			specific_name,
			routine_name AS name,
			routine_type,
			routine_definition,
			external_language,
			security_type,
			type_udt_name AS return_data_type
		FROM information_schema.routines
		WHERE specific_schema = $1
			AND specific_name NOT IN (
				SELECT r.specific_name
				FROM information_schema.routines r
				JOIN pg_proc p
					ON r.routine_name = p.proname
					AND r.specific_schema = (
						SELECT n.nspname
						FROM pg_namespace n
						WHERE n.oid = p.pronamespace
					)
				JOIN pg_depend d
					ON d.objid = p.oid
				JOIN pg_extension e
					ON d.refobjid = e.oid
				WHERE e.extname IN (${extensionsStatement})
  		);
	`;
};

const queryConstants = {
	PING: 'SELECT schema_name FROM information_schema.schemata LIMIT 1;',
	GET_VERSION: 'SELECT version()',
	GET_VERSION_AS_NUM: 'SHOW server_version_num;',
	GET_SCHEMA_NAMES: 'SELECT schema_name FROM information_schema.schemata;',
	GET_TABLE_NAMES: `
        SELECT
               pg_catalog.pg_class.relname     AS table_name,
               pg_catalog.pg_class.relkind     AS table_type
        FROM   pg_catalog.pg_class
               INNER JOIN pg_catalog.pg_namespace
                       ON pg_catalog.pg_namespace.oid = pg_catalog.pg_class.relnamespace
               LEFT JOIN (SELECT relname AS child_name
                          FROM   pg_catalog.pg_inherits AS inherit
                                 LEFT JOIN pg_catalog.pg_class AS child
                                        ON child.oid = inherit.inhrelid) AS
                         inherited_tables
                      ON inherited_tables.child_name = pg_catalog.pg_class.relname
        WHERE  inherited_tables.child_name IS NULL
               AND pg_catalog.pg_class.relispartition = false
               AND pg_catalog.pg_class.relkind IN ( 'r', 'v', 't', 'm', 'p' )
               AND pg_catalog.pg_namespace.nspname = $1;`,
	GET_NAMESPACE_OID: 'SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = $1',
	GET_TABLE_LEVEL_DATA: `
        SELECT pc.oid, pc.relpersistence, pc.reloptions, pt.spcname, pg_get_expr(pc.relpartbound, pc.oid) AS partition_expr
            FROM pg_catalog.pg_class AS pc
            LEFT JOIN pg_catalog.pg_tablespace AS pt
            ON pc.reltablespace = pt.oid
            WHERE pc.relname = $1 AND pc.relnamespace = $2;`,
	GET_TABLE_TOAST_OPTIONS: `
        SELECT reloptions AS toast_options
        FROM pg_catalog.pg_class
        WHERE oid =
                (SELECT reltoastrelid
                 FROM pg_catalog.pg_class
                 WHERE relname=$1 AND relnamespace = $2
                 LIMIT 1)`,
	GET_TABLE_PARTITION_DATA: `
        SELECT partstrat as partition_method,
	            partattrs::int2[] as partition_attributes_positions,
	            pg_catalog.pg_get_expr(partexprs, partrelid) AS expressions
            FROM pg_catalog.pg_partitioned_table
            WHERE partrelid = $1;`,
	GET_TABLE_COLUMNS: `
        SELECT * FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = $2
            ORDER BY ordinal_position`,
	GET_TABLE_COLUMNS_ADDITIONAL_DATA: `
        SELECT pg_attribute.attname AS name,
            pg_attribute.attndims AS number_of_array_dimensions,
            pg_description.description,
            pg_attribute.atttypmod AS attribute_mode
        FROM pg_catalog.pg_attribute AS pg_attribute
        LEFT JOIN pg_catalog.pg_description AS pg_description ON (pg_description.objsubid=pg_attribute.attnum
                                                               AND pg_description.objoid = pg_attribute.attrelid)
        WHERE pg_attribute.attrelid = $1;`,
	GET_TABLE_COLUMNS_FROM_CATALOG: `
        SELECT 
            a.attname AS column_name,
            a.attnum AS ordinal_position,
            pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
            CASE 
                WHEN a.attnotnull THEN 'NO'
                ELSE 'YES'
            END AS is_nullable,
            CASE 
                WHEN t.typtype = 'd' THEN 
                    CASE 
                        WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN 'ARRAY'
                        ELSE 
                            CASE bt.typname
                                WHEN 'bpchar' THEN 'character'
                                WHEN 'varchar' THEN 'character varying'
                                WHEN 'varbit' THEN 'bit varying'
                                WHEN 'timestamptz' THEN 'timestamp with time zone'
                                WHEN 'timestamp' THEN 'timestamp without time zone'
                                WHEN 'timetz' THEN 'time with time zone'
                                WHEN 'time' THEN 'time without time zone'
                                WHEN 'int4' THEN 'integer'
                                WHEN 'int2' THEN 'smallint'
                                WHEN 'int8' THEN 'bigint'
                                WHEN 'float4' THEN 'real'
                                WHEN 'float8' THEN 'double precision'
                                WHEN 'bool' THEN 'boolean'
                                ELSE bt.typname
                            END
                    END
                WHEN a.attndims > 0 THEN 'ARRAY'
                ELSE 
                    CASE t.typname
                        WHEN 'bpchar' THEN 'character'
                        WHEN 'varchar' THEN 'character varying'
                        WHEN 'varbit' THEN 'bit varying'
                        WHEN 'timestamptz' THEN 'timestamp with time zone'
                        WHEN 'timestamp' THEN 'timestamp without time zone'
                        WHEN 'timetz' THEN 'time with time zone'
                        WHEN 'time' THEN 'time without time zone'
                        WHEN 'int4' THEN 'integer'
                        WHEN 'int2' THEN 'smallint'
                        WHEN 'int8' THEN 'bigint'
                        WHEN 'float4' THEN 'real'
                        WHEN 'float8' THEN 'double precision'
                        WHEN 'bool' THEN 'boolean'
                        ELSE t.typname
                    END
            END AS data_type,
            CASE 
                WHEN t.typtype = 'd' THEN 
                    CASE 
                        WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN NULL
                        ELSE 
                            CASE 
                                WHEN bt.typbasetype = ANY ('{int,int4,int2,int8,float4,float8,numeric,decimal}'::regtype[]) 
                                THEN CASE WHEN bt.typtypmod = -1 THEN NULL ELSE ((bt.typtypmod - 4) >> 16) & 65535 END
                                ELSE NULL
                            END
                    END
                WHEN a.atttypid = ANY ('{int,int4,int2,int8,float4,float8,numeric,decimal}'::regtype[]) 
                THEN 
                    CASE 
                        WHEN a.atttypid = ANY ('{int4,int}'::regtype[]) THEN 32
                        WHEN a.atttypid = 'int2'::regtype THEN 16
                        WHEN a.atttypid = 'int8'::regtype THEN 64
                        WHEN a.atttypid = 'float4'::regtype THEN 24
                        WHEN a.atttypid = 'float8'::regtype THEN 53
                        ELSE CASE WHEN a.atttypmod = -1 THEN NULL ELSE ((a.atttypmod - 4) >> 16) & 65535 END
                    END
                ELSE NULL
            END AS numeric_precision,
            CASE 
                WHEN t.typtype = 'd' THEN 
                    CASE 
                        WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN NULL
                        ELSE 
                            CASE 
                                WHEN bt.typbasetype = ANY ('{numeric,decimal}'::regtype[]) 
                                THEN CASE WHEN bt.typtypmod = -1 THEN NULL ELSE (bt.typtypmod - 4) & 65535 END
                                ELSE NULL
                            END
                    END
                WHEN a.atttypid = ANY ('{numeric,decimal}'::regtype[]) 
                THEN CASE WHEN a.atttypmod = -1 THEN NULL ELSE (a.atttypmod - 4) & 65535 END
                WHEN a.atttypid = ANY ('{int,int4,int2,int8}'::regtype[]) 
                THEN 0
                ELSE NULL
            END AS numeric_scale,
            CASE 
                WHEN t.typtype = 'd' THEN 
                    CASE 
                        WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN NULL
                        ELSE 
                            CASE 
                                WHEN bt.typbasetype = ANY ('{timestamp,timestamptz,time,timetz}'::regtype[]) 
                                THEN CASE WHEN bt.typtypmod = -1 THEN NULL ELSE bt.typtypmod END
                                ELSE NULL
                            END
                    END
                WHEN a.atttypid = ANY ('{timestamp,timestamptz,time,timetz}'::regtype[]) 
                THEN CASE WHEN a.atttypmod = -1 THEN NULL ELSE a.atttypmod END
                ELSE NULL
            END AS datetime_precision,
            a.atttypmod AS attribute_mode,
            CASE 
                WHEN t.typtype = 'd' THEN 
                    CASE 
                        WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN NULL
                        ELSE 
                            CASE 
                                WHEN bt.typbasetype = 'interval'::regtype 
                                THEN 
                                    CASE 
                                        WHEN bt.typtypmod = -1 THEN NULL
                                        ELSE
                                            CASE 
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'year' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'month' THEN 'YEAR TO MONTH'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'day' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'hour' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'minute' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'second' THEN 'DAY TO SECOND'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'day' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'hour' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'minute' THEN 'DAY TO MINUTE'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'day' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'hour' THEN 'DAY TO HOUR'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'hour' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'minute' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'second' THEN 'HOUR TO SECOND'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'hour' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'minute' THEN 'HOUR TO MINUTE'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'minute' AND format_type(bt.typbasetype, bt.typtypmod) ~ 'second' THEN 'MINUTE TO SECOND'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'year' THEN 'YEAR'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'month' THEN 'MONTH'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'day' THEN 'DAY'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'hour' THEN 'HOUR'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'minute' THEN 'MINUTE'
                                                WHEN format_type(bt.typbasetype, bt.typtypmod) ~ 'second' THEN 'SECOND'
                                                ELSE NULL
                                            END
                                    END
                                ELSE NULL
                            END
                    END
                WHEN a.atttypid = 'interval'::regtype 
                THEN 
                    CASE 
                        WHEN a.atttypmod = -1 THEN NULL
                        ELSE
                            CASE 
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'year' AND format_type(a.atttypid, a.atttypmod) ~ 'month' THEN 'YEAR TO MONTH'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'day' AND format_type(a.atttypid, a.atttypmod) ~ 'hour' AND format_type(a.atttypid, a.atttypmod) ~ 'minute' AND format_type(a.atttypid, a.atttypmod) ~ 'second' THEN 'DAY TO SECOND'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'day' AND format_type(a.atttypid, a.atttypmod) ~ 'hour' AND format_type(a.atttypid, a.atttypmod) ~ 'minute' THEN 'DAY TO MINUTE'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'day' AND format_type(a.atttypid, a.atttypmod) ~ 'hour' THEN 'DAY TO HOUR'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'hour' AND format_type(a.atttypid, a.atttypmod) ~ 'minute' AND format_type(a.atttypid, a.atttypmod) ~ 'second' THEN 'HOUR TO SECOND'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'hour' AND format_type(a.atttypid, a.atttypmod) ~ 'minute' THEN 'HOUR TO MINUTE'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'minute' AND format_type(a.atttypid, a.atttypmod) ~ 'second' THEN 'MINUTE TO SECOND'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'year' THEN 'YEAR'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'month' THEN 'MONTH'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'day' THEN 'DAY'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'hour' THEN 'HOUR'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'minute' THEN 'MINUTE'
                                WHEN format_type(a.atttypid, a.atttypmod) ~ 'second' THEN 'SECOND'
                                ELSE NULL
                            END
                    END
                ELSE NULL
            END AS interval_type,
            CASE 
                WHEN c.collname <> 'default' THEN c.collname
                ELSE NULL
            END AS collation_name,
            a.attndims AS number_of_array_dimensions,
            CASE 
                WHEN t.typtype = 'd' THEN 
                    CASE 
                        WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN bt.typname
                        ELSE bt.typname
                    END
                ELSE t.typname
            END AS udt_name,
            CASE 
                WHEN t.typtype = 'd' THEN 
                    CASE 
                        WHEN bt.typelem <> 0 AND bt.typlen = -1 THEN NULL
                        ELSE 
                            CASE 
                                WHEN bt.typbasetype = ANY ('{bpchar,varchar,char,text}'::regtype[]) 
                                THEN CASE WHEN bt.typtypmod = -1 THEN NULL ELSE bt.typtypmod - 4 END
                                WHEN bt.typbasetype = ANY ('{bit,varbit}'::regtype[])
                                THEN CASE WHEN bt.typtypmod = -1 THEN NULL ELSE bt.typtypmod END
                                ELSE NULL
                            END
                    END
                WHEN a.atttypid = ANY ('{bpchar,varchar,char,text}'::regtype[]) 
                THEN CASE WHEN a.atttypmod = -1 THEN NULL ELSE a.atttypmod - 4 END
                WHEN a.atttypid = ANY ('{bit,varbit}'::regtype[])
                THEN CASE WHEN a.atttypmod = -1 THEN NULL ELSE a.atttypmod END
                ELSE NULL
            END AS character_maximum_length,
            CASE 
                WHEN t.typtype = 'd' THEN t.typname
                ELSE NULL
            END AS domain_name,
            pg_description.description
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
        LEFT JOIN pg_catalog.pg_type bt ON t.typbasetype = bt.oid
        LEFT JOIN pg_catalog.pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
        LEFT JOIN pg_catalog.pg_collation c ON a.attcollation = c.oid
        LEFT JOIN pg_catalog.pg_description ON (pg_description.objsubid = a.attnum
                                               AND pg_description.objoid = a.attrelid)
        WHERE a.attrelid = $1 
          AND a.attnum > 0 
          AND NOT a.attisdropped
        ORDER BY a.attnum;`,
	GET_DESCRIPTION_BY_OID: `SELECT obj_description($1)`,
	GET_ROWS_COUNT: fullTableName => `SELECT COUNT(*) AS quantity FROM ${fullTableName};`,
	GET_SAMPLED_DATA: (fullTableName, jsonColumns) => `SELECT ${jsonColumns} FROM ${fullTableName} LIMIT $1;`,
	GET_SAMPLED_DATA_SIZE: (fullTableName, jsonColumns) => `
        SELECT sum(pg_column_size(_hackolade_tmp_sampling_tbl.*)) AS _hackolade_tmp_sampling_tbl_size
        FROM (SELECT ${jsonColumns} FROM ${fullTableName} LIMIT $1) AS _hackolade_tmp_sampling_tbl;`,
	GET_INHERITS_PARENT_TABLE_NAME: `
        SELECT pc.relname AS parent_table_name FROM pg_catalog.pg_inherits AS pi
	        INNER JOIN pg_catalog.pg_class AS pc
	        ON pc.oid = pi.inhparent
	        WHERE pi.inhrelid = $1;`,
	GET_TABLE_CONSTRAINTS: `
        SELECT pcon.conname AS constraint_name,
	            pcon.contype AS constraint_type,
	            pcon.connoinherit AS no_inherit,
	            pcon.conkey AS constraint_keys,
	            pg_catalog.pg_get_expr(pcon.conbin, pcon.conrelid) AS expression,
	            obj_description(pcon.oid, 'pg_constraint') AS description,
	            pc.reloptions AS storage_parameters,
	            pt.spcname AS tablespace
	        FROM pg_catalog.pg_constraint AS pcon
	        LEFT JOIN pg_catalog.pg_class AS pc
	        ON pcon.conindid = pc.oid
	        LEFT JOIN pg_catalog.pg_tablespace AS pt
	        ON pc.reltablespace = pt.oid
	        WHERE pcon.conrelid = $1;`,
	GET_TABLE_INDEXES: getGET_TABLE_INDEXES(),
	GET_TABLE_INDEXES_V_10: getGET_TABLE_INDEXES(10),
	GET_TABLE_INDEXES_V_15: getGET_TABLE_INDEXES(15),
	GET_TABLE_FOREIGN_KEYS: `
        SELECT pcon.conname AS relationship_name,
                pcon.conkey AS table_columns_positions,
                pcon.confdeltype AS relationship_on_delete,
                pcon.confupdtype AS relationship_on_update,
                pcon.confmatchtype AS relationship_match,
                pc_foreign_table.relname AS foreign_table_name,
                ARRAY(
                    SELECT pg_attribute.attname::text 
                    FROM unnest(pcon.confkey) AS column_position
                    JOIN pg_catalog.pg_attribute ON (pg_attribute.attnum = column_position AND pg_attribute.attrelid = pcon.confrelid)
                    WHERE NOT pg_attribute.attisdropped
                    ORDER BY array_position(pcon.confkey, column_position))::text[] AS foreign_columns,
                foreign_table_namespace.nspname AS foreign_table_schema
            FROM pg_catalog.pg_constraint AS pcon
            LEFT JOIN pg_catalog.pg_class AS pc ON pcon.conindid = pc.oid
            LEFT JOIN pg_catalog.pg_tablespace AS pt ON pc.reltablespace = pt.oid
            LEFT JOIN pg_catalog.pg_class AS pc_foreign_table ON (pcon.confrelid = pc_foreign_table.oid)
            JOIN pg_catalog.pg_namespace AS foreign_table_namespace ON (pc_foreign_table.relnamespace = foreign_table_namespace.oid)
            WHERE pcon.conrelid = $1 AND pcon.contype = 'f';`,
	GET_VIEW_DATA: `SELECT * FROM information_schema.views WHERE table_name = $1 AND table_schema = $2;`,
	GET_VIEW_SELECT_STMT_FALLBACK: `SELECT definition FROM pg_views WHERE viewname = $1 AND schemaname = $2;`,
	GET_VIEW_OPTIONS: `
        SELECT oid,
            reloptions AS view_options,
            relpersistence AS persistence,
            obj_description(oid, 'pg_class') AS description
        FROM pg_catalog.pg_class
        WHERE relname = $1 AND relnamespace = $2;`,
	GET_MATERIALIZED_VIEW_DATA: `
        SELECT 
            pg_catalog.pg_class.reltablespace as view_tablespace_name,
            pg_catalog.pg_class.relispopulated as is_populated,
            pg_catalog.pg_class.relkind as table_type,
            pg_catalog.pg_class.oid,
            pg_catalog.pg_get_viewdef(pg_catalog.pg_class.oid, true) AS view_definition
        FROM 
            pg_catalog.pg_class
        JOIN 
            pg_catalog.pg_namespace
        ON pg_catalog.pg_namespace.oid = pg_catalog.pg_class.relnamespace
        WHERE 
            pg_catalog.pg_class.relkind = 'm'
        AND pg_catalog.pg_class.relname = $1
        AND pg_catalog.pg_namespace.nspname = $2;`,
	GET_FUNCTIONS_WITH_PROCEDURES: getGET_FUNCTIONS_WITH_PROCEDURES({ extensionsToExclude: ['vector'] }),
	GET_FUNCTIONS_WITH_PROCEDURES_ARGS: `
        SELECT parameter_name,
            parameter_mode,
            parameter_default,
            data_type,
            udt_name
        FROM information_schema.parameters
        WHERE specific_name = $1
        ORDER BY ordinal_position;`,
	GET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL: getGET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL(),
	GET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL_V_10: getGET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL(10),
	GET_USER_DEFINED_TYPES: `
        SELECT pg_type.typrelid AS pg_class_oid,
            pg_type.typname AS name,
            pg_type.typtype AS type,
            pg_catalog.array_agg(pg_enum.enumlabel)::text[] AS enum_values,
            range_subtype_type.typname AS range_subtype,
            range_collation.collname AS range_collation_name,
            range_opclass.opcname AS range_opclass_name,
            range_canonical_proc.proname AS range_canonical_proc,
            range_diff_proc.proname AS range_diff_proc
        FROM pg_catalog.pg_type AS pg_type
        LEFT JOIN pg_catalog.pg_class AS pg_class ON (pg_class.oid = pg_type.typrelid)
        LEFT JOIN pg_catalog.pg_namespace AS pg_namespace ON (pg_namespace.oid = pg_type.typnamespace)
        LEFT JOIN pg_catalog.pg_enum AS pg_enum ON (pg_enum.enumtypid = pg_type.oid)
        LEFT JOIN pg_catalog.pg_range AS pg_range ON (pg_range.rngtypid = pg_type.oid)
        LEFT JOIN pg_catalog.pg_type AS range_subtype_type ON (range_subtype_type.oid = pg_range.rngsubtype)
        LEFT JOIN pg_catalog.pg_collation AS range_collation ON (range_collation.oid = pg_range.rngcollation)
        LEFT JOIN pg_catalog.pg_opclass AS range_opclass ON (range_opclass.oid = pg_range.rngsubopc)
        LEFT JOIN pg_catalog.pg_proc AS range_canonical_proc ON (range_canonical_proc.oid = pg_range.rngcanonical)
        LEFT JOIN pg_catalog.pg_proc AS range_diff_proc ON (range_diff_proc.oid = pg_range.rngsubdiff)
        WHERE pg_namespace.nspname = $1
         AND ((pg_type.typtype = 'c'
               AND pg_class.relkind = 'c')
              OR pg_type.typtype = 'e'
              OR pg_type.typtype = 'r')
        GROUP BY pg_class_oid,
              pg_type.typname,
              pg_type.typtype,
              pg_class.oid,
              range_subtype,
              range_collation_name,
              range_opclass_name,
              range_canonical_proc,
              range_diff_proc;`,
	GET_COMPOSITE_TYPE_COLUMNS: `
        SELECT pg_attribute.attname AS column_name,
           pg_type.typname AS data_type,
           pg_get_expr(pg_attrdef.adbin, pg_attrdef.adrelid) AS columns_default,
           pg_attribute.attnotnull AS not_null,
           pg_collation.collname AS collation_name,
           pg_attribute.attndims AS number_of_array_dimensions,
           pg_attribute.atttypmod AS character_maximum_length
        FROM pg_catalog.pg_attribute AS pg_attribute
        LEFT JOIN pg_catalog.pg_type AS pg_type ON (pg_type.oid = pg_attribute.atttypid)
        LEFT JOIN pg_catalog.pg_attrdef AS pg_attrdef ON (pg_attrdef.adrelid = pg_attribute.attrelid
                                                          AND pg_attrdef.adnum = pg_attribute.attnum)
        LEFT JOIN pg_catalog.pg_collation AS pg_collation ON (pg_collation.oid = pg_attribute.attcollation)
        WHERE pg_attribute.attrelid = $1`,
	GET_DB_NAME: 'SELECT current_database();',
	GET_DB_ENCODING: 'SHOW SERVER_ENCODING;',
	GET_DB_COLLATE_NAME: 'SELECT default_collate_name FROM information_schema.character_sets;',
	GET_DOMAIN_TYPES: 'SELECT * FROM information_schema.domains WHERE domain_schema = $1',
	GET_DOMAIN_TYPES_CONSTRAINTS: `
        SELECT pg_type.typname AS type_name,
        	pg_type.typnotnull AS not_null,
        	pg_constraint.conname AS constraint_name,
        	pg_catalog.pg_get_expr(pg_constraint.conbin, pg_constraint.conrelid) AS expression
        FROM pg_catalog.pg_type AS pg_type
        LEFT JOIN pg_catalog.pg_constraint AS pg_constraint ON (pg_constraint.contypid = pg_type.oid)
        LEFT JOIN pg_catalog.pg_namespace AS pg_namespace ON (pg_namespace.oid = pg_type.typnamespace)
        WHERE pg_type.typname = $1 AND pg_namespace.nspname = $2 AND pg_constraint.contype = 'c';`,
	GET_DATABASES:
		'SELECT datname AS database_name FROM pg_catalog.pg_database WHERE datistemplate != TRUE AND datallowconn = TRUE;',
	GET_TRIGGERS: `
        SELECT trigger_name,
                array_agg(event_manipulation::text) AS trigger_events,
                event_object_schema,
                event_object_table,
                action_orientation,
                action_timing,
                action_reference_old_table,
                action_reference_new_table,
                action_condition,
                action_statement
        FROM
            -- This is information_schema.triggers view but without permitions
            (SELECT (current_database())::information_schema.sql_identifier AS trigger_catalog,
                    (n.nspname)::information_schema.sql_identifier AS trigger_schema,
                    (t.tgname)::information_schema.sql_identifier AS trigger_name,
                    (em.text)::information_schema.character_data AS event_manipulation,
                    (current_database())::information_schema.sql_identifier AS event_object_catalog,
                    (n.nspname)::information_schema.sql_identifier AS event_object_schema,
                    (c.relname)::information_schema.sql_identifier AS event_object_table,
                    (rank() OVER (PARTITION BY (n.nspname)::information_schema.sql_identifier,
                                               (c.relname)::information_schema.sql_identifier,
                                               em.num, ((t.tgtype)::integer & 1), ((t.tgtype)::integer & 66)
                                  ORDER BY t.tgname))::information_schema.cardinal_number AS action_order,
                    (regexp_match(pg_get_triggerdef(t.oid), '.{35,} WHEN ((.+)) EXECUTE FUNCTION'::text))[1]::information_schema.character_data AS action_condition,
                    (SUBSTRING(pg_get_triggerdef(t.oid)
                               FROM (POSITION(('EXECUTE FUNCTION'::text) IN (SUBSTRING(pg_get_triggerdef(t.oid)
                                                                                       FROM 48))) + 47)))::information_schema.character_data AS action_statement,
                    (CASE ((t.tgtype)::integer & 1)
                         WHEN 1 THEN 'ROW'::text
                         ELSE 'STATEMENT'::text
                     END)::information_schema.character_data AS action_orientation,
                    (CASE ((t.tgtype)::integer & 66)
                         WHEN 2 THEN 'BEFORE'::text
                         WHEN 64 THEN 'INSTEAD OF'::text
                         ELSE 'AFTER'::text
                     END)::information_schema.character_data AS action_timing,
                    (t.tgoldtable)::information_schema.sql_identifier AS action_reference_old_table,
                    (t.tgnewtable)::information_schema.sql_identifier AS action_reference_new_table,
                    (NULL::timestamp with time zone)::information_schema.time_stamp AS created
                FROM pg_namespace n,
                        pg_class c,
                        pg_trigger t, (VALUES (4,'INSERT'::text), (8,'DELETE'::text), (16,'UPDATE'::text)) em(num, text)
                WHERE ((n.oid = c.relnamespace)
                        AND (c.oid = t.tgrelid)
                        AND (((t.tgtype)::integer & em.num) <> 0)
                        AND (NOT t.tgisinternal)
                        AND (NOT pg_is_other_temp_schema(n.oid)))) AS tmp_views
        WHERE event_object_schema = $1 AND event_object_table = $2
        GROUP BY
                trigger_schema,
                trigger_name,
                event_object_schema,
                event_object_table,
                action_orientation,
                action_timing,
                action_reference_old_table,
                action_reference_new_table,
                action_condition,
                action_statement;`,
	GET_TRIGGERS_ADDITIONAL_DATA: `
        SELECT
                pg_catalog.obj_description(pg_trigger.oid, 'pg_trigger') AS description,
        	pg_trigger.tgname AS trigger_name,
        	pg_proc.proname AS function_name,
        	CASE WHEN pg_trigger.tgconstraint != 0 THEN true ELSE false END AS "constraint",
        	array_agg(pg_attribute.attname)::text[] AS update_attributes,
        	tgdeferrable AS "deferrable",
        	tginitdeferred AS deferred,
                pg_class_referenced.relname AS referenced_table_name,
                pg_namespace_referenced.nspname AS referenced_table_schema
        FROM pg_catalog.pg_trigger as pg_trigger
        LEFT JOIN pg_catalog.pg_proc AS pg_proc
        	ON (pg_trigger.tgfoid = pg_proc.oid)
        LEFT JOIN pg_catalog.pg_attribute AS pg_attribute
        	ON (pg_attribute.attnum = ANY(pg_trigger.tgattr::int2[]) AND pg_trigger.tgrelid = pg_attribute.attrelid)
        INNER JOIN pg_catalog.pg_class AS pg_class
        	ON (pg_class.oid = pg_trigger.tgrelid)
        INNER JOIN pg_catalog.pg_namespace AS pg_namespace
        	ON (pg_class.relnamespace = pg_namespace.oid)
        LEFT JOIN pg_catalog.pg_class AS pg_class_referenced
                ON(pg_class_referenced.oid = pg_trigger.tgconstrrelid)
        LEFT JOIN pg_catalog.pg_namespace AS pg_namespace_referenced
                ON(pg_namespace_referenced.oid = pg_class_referenced.relnamespace)
        WHERE pg_class.relnamespace = $1 AND pg_class.oid = $2
        GROUP BY
        	trigger_name,
        	function_name,
        	"constraint",
        	"deferrable",
        	deferred,
                description,
                referenced_table_name,
                referenced_table_schema;`,
	GET_PARTITIONS: `
        SELECT
        	inher_child.relname AS child_name,
        	inher_parent.relname AS parent_name,
                CASE WHEN inher_parent.relkind = 'p' THEN TRUE ELSE FALSE END AS is_parent_partitioned
        FROM pg_inherits
        LEFT JOIN pg_class AS inher_child ON (inher_child.oid = pg_inherits.inhrelid)
        LEFT JOIN pg_class AS inher_parent ON (inher_parent.oid = pg_inherits.inhparent)
        WHERE inher_parent.relnamespace = $1;`,
	GET_SEQUENCES: `
        SELECT DISTINCT ON (sequence_name)
                information_schema."sequences".sequence_name,
                information_schema."sequences".data_type,
                information_schema."sequences".start_value,
                information_schema."sequences".minimum_value,
                information_schema."sequences".maximum_value,
                information_schema."sequences"."increment",
                information_schema."sequences".cycle_option,
                pg_catalog.pg_sequences.cache_size,
                pg_class.relpersistence as rel_persistance,
                inner_pg_class.relname AS table_name,
                pg_attribute.attname AS column_name
        FROM information_schema."sequences"
        JOIN pg_class ON pg_class.relname = information_schema."sequences".sequence_name
        JOIN pg_depend ON pg_depend.objid = pg_class.oid
        LEFT JOIN pg_catalog.pg_sequences ON (pg_catalog.pg_sequences.schemaname, pg_catalog.pg_sequences.sequencename) = (information_schema."sequences".sequence_schema, information_schema."sequences".sequence_name)
        LEFT JOIN pg_class AS inner_pg_class ON pg_depend.refobjid = inner_pg_class.oid
        LEFT JOIN pg_attribute ON (pg_depend.refobjid, pg_depend.refobjsubid) = (pg_attribute.attrelid, pg_attribute.attnum)
        WHERE pg_class.relkind = 'S'
        AND information_schema."sequences".sequence_schema = $1
        ORDER BY sequence_name, column_name;
        `,
};

const getQueryName = query => {
	const queryEntry =
		Object.entries(queryConstants).find(([queryName, constantQuery]) => query === constantQuery) || [];

	return queryEntry[0] || 'Custom query';
};

module.exports = {
	getQueryName,
	...queryConstants,
};
