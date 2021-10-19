const Pool = require('pg').Pool;
const fs = require('fs');
const ssh = require('tunnel-ssh');

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

const getSslOptions = connectionInfo => {
    if (connectionInfo.sslType === 'Off') {
        return false;
    }

    if (connectionInfo.sslType === 'Unvalidated') {
        return {
            rejectUnauthorized: false,
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

const createConnectionPool = async connectionInfo => {
    let sshTunnel = null;

    if (connectionInfo.ssh) {
        const { info, tunnel } = await connectViaSsh(connectionInfo);
        sshTunnel = tunnel;
        connectionInfo = info;
    }

    const config = {
        host: connectionInfo.host,
        user: connectionInfo.userName,
        password: connectionInfo.userPassword,
        port: connectionInfo.port,
        keepAlive: true,
        ssl: getSslOptions(connectionInfo),
        connectionTimeoutMillis: Number(connectionInfo.queryRequestTimeout) || 60000,
        query_timeout: Number(connectionInfo.queryRequestTimeout) || 60000,
        statement_timeout: Number(connectionInfo.queryRequestTimeout) || 60000,
        database: connectionInfo.database || connectionInfo.maintenanceDatabase,
    };

    const pool = await new Pool(config);

    return { pool, sshTunnel };
};

module.exports = {
    createConnectionPool,
};
