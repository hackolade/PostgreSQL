const fs = require('fs');
const ssh = require('tunnel-ssh');
const pg = require('pg');

const SSL_NOT_SUPPORTED_MESSAGE = 'The server does not support SSL connections';
const POSTGRES_SSL_REQUIRED_ERROR_CODE = '28000';

const getSshConfig = info => {
	const config = {
		username: info.ssh_user,
		host: info.ssh_host,
		port: info.ssh_port,
		dstHost: info.host,
		dstPort: info.port,
		localHost: '127.0.0.1',
		localPort: info.port,
		keepAlive: true,
	};

	if (info.ssh_method === 'privateKey') {
		return Object.assign({}, config, {
			privateKey: fs.readFileSync(info.ssh_key_file),
			passphrase: info.ssh_key_passphrase,
		});
	} else {
		return Object.assign({}, config, {
			password: info.ssh_password,
		});
	}
};

const connectViaSsh = info =>
	new Promise((resolve, reject) => {
		ssh(getSshConfig(info), (err, tunnel) => {
			if (err) {
				reject(err);
			} else {
				resolve({
					tunnel,
					info: Object.assign({}, info, {
						host: '127.0.0.1',
					}),
				});
			}
		});
	});

const getSslOptions = (connectionInfo, logger) => {
	const sslType = connectionInfo.sslType;

	if (!sslType || sslType === 'disable' || sslType === 'allow') {
		return false;
	}

	if (['require', 'prefer'].includes(sslType) && !connectionInfo.certAuthority) {
		return {
			rejectUnauthorized: false,
		};
	}

	let sslOptions = {
		checkServerIdentity(hostname, cert) {
			logger.info('Certificate', {
				hostname,
				cert: {
					subject: cert.subject,
					issuer: cert.issuer,
					valid_from: cert.valid_from,
					valid_to: cert.valid_to,
				},
			});
		},
	};

	if (fs.existsSync(connectionInfo.certAuthority)) {
		sslOptions.ca = fs.readFileSync(connectionInfo.certAuthority).toString();
	}

	if (fs.existsSync(connectionInfo.clientCert)) {
		sslOptions.cert = fs.readFileSync(connectionInfo.clientCert).toString();
	}

	if (fs.existsSync(connectionInfo.clientPrivateKey)) {
		sslOptions.key = fs.readFileSync(connectionInfo.clientPrivateKey).toString();
	}

	return sslOptions;
};

const mapSslType = sslType => {
	const oldToNewSslType = {
		Off: 'disable',
		TRUST_ALL_CERTIFICATES: 'allow',
		TRUST_CUSTOM_CA_SIGNED_CERTIFICATES: 'prefer',
		TRUST_SERVER_CLIENT_CERTIFICATES: 'verify-full',
	};

	return oldToNewSslType[sslType] || sslType;
};

const createClient = async (connectionInfo, logger) => {
	let sshTunnel = null;

	if (connectionInfo.ssh) {
		const { info, tunnel } = await connectViaSsh(connectionInfo);
		sshTunnel = tunnel;
		connectionInfo = info;
	}

	connectionInfo = Object.assign({}, connectionInfo, { sslType: mapSslType(connectionInfo.sslType) });

	const config = {
		host: connectionInfo.host,
		user: connectionInfo.userName,
		password: connectionInfo.userPassword,
		port: connectionInfo.port,
		keepAlive: true,
		ssl: getSslOptions(connectionInfo, logger),
		connectionTimeoutMillis: Number(connectionInfo.queryRequestTimeout) || 60000,
		query_timeout: Number(connectionInfo.queryRequestTimeout) || 60000,
		statement_timeout: Number(connectionInfo.queryRequestTimeout) || 60000,
		database: connectionInfo.database || connectionInfo.maintenanceDatabase,
		application_name: 'Hackolade',
		idleTimeoutMillis: Number(connectionInfo.queryRequestTimeout) || 10000,
	};

	const client = await connectClient(config).catch(retryOnSslError(connectionInfo, config, logger));

	return { client, sshTunnel };
};

const retryOnSslError = (connectionInfo, config, logger) => async error => {
	if (error.message === SSL_NOT_SUPPORTED_MESSAGE && connectionInfo.sslType === 'prefer') {
		logger.info("Retry connection without SSL (SSL mode 'prefer')");
		logger.error(error);

		return await connectClient({
			...config,
			ssl: false,
		});
	}

	if (error.code?.toString() === POSTGRES_SSL_REQUIRED_ERROR_CODE && connectionInfo.sslType === 'allow') {
		logger.info("Retry connection with SSL (SSL mode 'allow')");
		logger.error(error);

		return await connectClient({
			...config,
			ssl: { rejectUnauthorized: false },
		});
	}

	throw error;
};

const connectClient = async config => {
	const client = new pg.Pool(config);

	return client;
};

module.exports = {
	createClient,
};
