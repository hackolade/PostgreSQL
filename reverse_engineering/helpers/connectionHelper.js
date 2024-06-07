const fs = require('fs');
const pg = require('pg');

const SSL_NOT_SUPPORTED_MESSAGE = 'The server does not support SSL connections';
const POSTGRES_SSL_REQUIRED_ERROR_CODE = '28000';

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

const createClient = async (connectionInfo, sshService, logger) => {
	let isSshTunnel = false;

	if (connectionInfo.ssh) {
		const { options } = await sshService.openTunnel({
			sshAuthMethod: connectionInfo.ssh_method === 'privateKey' ? 'IDENTITY_FILE' : 'USER_PASSWORD',
			sshTunnelHostname: connectionInfo.ssh_host,
			sshTunnelPort: connectionInfo.ssh_port,
			sshTunnelUsername: connectionInfo.ssh_user,
			sshTunnelPassword: connectionInfo.ssh_password,
			sshTunnelIdentityFile: connectionInfo.ssh_key_file,
			sshTunnelPassphrase: connectionInfo.ssh_key_passphrase,
			host: connectionInfo.host,
			port: connectionInfo.port,
		});

		connectionInfo = {
			...connectionInfo,
			...options,
		};
		isSshTunnel = true;
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
		sslType: connectionInfo.sslType,
	};

	const client = await createConnectionPool(config, logger);

	return { client, isSshTunnel };
};

const retryOnSslError = (config, logger, error) => {
	if (error.message === SSL_NOT_SUPPORTED_MESSAGE && config.sslType === 'prefer') {
		logger.info("Retry connection without SSL (SSL mode 'prefer')");
		logger.error(error);

		return createConnectionPool(
			{
				...config,
				isRetry: true,
				ssl: false,
			},
			logger,
		);
	}

	if (error.code?.toString() === POSTGRES_SSL_REQUIRED_ERROR_CODE && config.sslType === 'allow') {
		logger.info("Retry connection with SSL (SSL mode 'allow')");
		logger.error(error);

		return createConnectionPool(
			{
				...config,
				isRetry: true,
				ssl: { rejectUnauthorized: false },
			},
			logger,
		);
	}

	throw error;
};

const createConnectionPool = (config, logger) => {
	const pool = new pg.Pool(config);

	return pool
		.connect()
		.then(client => {
			client.release();

			return pool;
		})
		.catch(async error => {
			await pool.end();

			if (config.isRetry) {
				throw error;
			}

			return retryOnSslError(config, logger, error);
		});
};

module.exports = {
	createClient,
};
