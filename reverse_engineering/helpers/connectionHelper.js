const mariadb = require('mariadb');
const fs = require('fs');
const ssh = require('tunnel-ssh');

let connection;
let sshTunnel;

const getSshConfig = (info) => {
	const config = {
		username: info.ssh_user,
		host: info.ssh_host,
		port: info.ssh_port,
		dstHost: info.host,
		dstPort: info.port,
		localHost: '127.0.0.1',
		localPort: info.port,
		keepAlive: true
	};

	if (info.ssh_method === 'privateKey') {
		return Object.assign({}, config, {
			privateKey: fs.readFileSync(info.ssh_key_file),
			passphrase: info.ssh_key_passphrase
		});
	} else {
		return Object.assign({}, config, {
			password: info.ssh_password
		});
	}
};

const connectViaSsh = (info) => new Promise((resolve, reject) => {
	ssh(getSshConfig(info), (err, tunnel) => {
		if (err) {
			reject(err);
		} else {
			resolve({
				tunnel,
				info: Object.assign({}, info, {
					host: '127.0.0.1',
				})
			});
		}
	});
});

const getSslOptions = (connectionInfo) => {
	if (connectionInfo.sslType === 'Off') {
		return false;
	}

	if (connectionInfo.sslType === 'Unvalidated') {
		return {
			rejectUnauthorized: false
		};
	}

	if (connectionInfo.sslType === 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES') {
		return {
			ca: fs.readFileSync(connectionInfo.certAuthority),
		};
	}

	if (connectionInfo.sslType === 'TRUST_SERVER_CLIENT_CERTIFICATES') {
		return {
			ca: fs.readFileSync(connectionInfo.certAuthority),
			cert: fs.readFileSync(connectionInfo.clientCert),
			key: fs.readFileSync(connectionInfo.clientPrivateKey),
		};
	}
};

const createConnection = async (connectionInfo) => {
	if (connectionInfo.ssh) {
		const { info, tunnel } = await connectViaSsh(connectionInfo);
		sshTunnel = tunnel;
		connectionInfo = info;
	}

	return await mariadb.createConnection({ 
		host: connectionInfo.host,
		user: connectionInfo.userName, 
		password: connectionInfo.userPassword, 
		port: connectionInfo.port,
		metaAsArray: false,
		ssl: getSslOptions(connectionInfo),
		dateStrings: true ,
		supportBigInt: true,
		autoJsonMap: false,
		connectTimeout: Number(connectionInfo.queryRequestTimeout) || 60000,
		database: connectionInfo.databaseName,
	});
};

const connect = async (connectionInfo) => {
	if (connection) {
		return connection;
	}
 
	connection = await createConnection(connectionInfo);

	return connection;
};

const getDatabases = async (connection, systemDatabases) => {
	const databases = await connection.query('show databases;');

	return databases.map(item => item.Database).filter(dbName => !systemDatabases.includes(dbName));
};

const getTables = async (connection, dbName) => {
	const tables = await connection.query(`show full tables from \`${dbName}\`;`);

	return tables;
};

const createInstance = (connection, logger) => {
	const getCount = async (dbName, tableName) => {
		const count = await connection.query(`SELECT COUNT(*) as count FROM \`${dbName}\`.\`${tableName}\`;`);

		return Number(count[0]?.count || 0);
	};
	
	const getRecords = async (dbName, tableName, limit) => {
		const result = await connection.query({
			sql: `SELECT * FROM \`${dbName}\`.\`${tableName}\` LIMIT ${limit};`
		});

		return result;
	};

	const getVersion = async () => {
		const version = await connection.query('select version() as version;');

		return version[0].version;
	};

	const describeDatabase = async (dbName) => {
		const data = await connection.query(`show create database \`${dbName}\`;`);

		return data[0]['Create Database'];
	}; 

	const getFunctions = async (dbName) => {
		const functions = await connection.query(`show function status WHERE Db = '${dbName}'`);

		return Promise.all(
			functions.map(
				f => connection.query(`show create function \`${dbName}\`.\`${f.Name}\`;`).then(functionCode => ({
					meta: f,
					data: functionCode,
				}))
			)
		);
	};

	const getProcedures = async (dbName) => {
		const functions = await connection.query(`show procedure status WHERE Db = '${dbName}'`);

		return Promise.all(
			functions.map(
				f => connection.query(`show create procedure \`${dbName}\`.\`${f.Name}\`;`).then(functionCode => ({
					meta: f,
					data: functionCode,
				}))
			)
		);
	};

	const showCreateTable = async (dbName, tableName) => {
		const result = await connection.query(`show create table \`${dbName}\`.\`${tableName}\`;`);

		return result[0]?.['Create Table'];
	};

	const getConstraints = async (dbName, tableName) => {
		try {
			const result = await connection.query(`select * from information_schema.check_constraints where CONSTRAINT_SCHEMA='${dbName}' AND TABLE_NAME='${tableName}';`);
	
			return result;
		} catch (error) {
			logger.log('error', {
				message: '[Warning] ' + error.message,
				stack: error.stack,
			});
			return [];
		}
	};

	const getColumns = async (dbName, tableName) => {
		const result = await connection.query(`show fields from \`${dbName}\`.\`${tableName}\`;`);

		return result;
	};

	const getIndexes = async (dbName, tableName) => {
		const result = await connection.query(`show index from \`${tableName}\` from \`${dbName}\`;`);

		return result;
	};

	const showCreateView = async (dbName, viewName) => {
		const result = await connection.query(`show create view \`${dbName}\`.\`${viewName}\`;`);

		return result[0]?.['Create View'];
	};

	const query = (sql) => {
		return connection.query(sql);
	};

	return {
		getCount,
		getRecords,
		getVersion,
		describeDatabase,
		getFunctions,
		getProcedures,
		showCreateTable,
		getConstraints,
		getColumns,
		getIndexes,
		showCreateView,
		query,
	};
};

const close = () => {
	if (connection) {
		connection.end();
		connection = null;
	}

	if (sshTunnel) {
		sshTunnel.close();
		sshTunnel = null;
	}
};

module.exports = {
	connect,
	getDatabases,
	getTables,
	createInstance,
	close,
};
