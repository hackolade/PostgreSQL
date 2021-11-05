const fs = require('fs');
const ssh = require('tunnel-ssh');
const pg = require('pg');

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
    const sslType = mapSslType(connectionInfo.sslType);

    if (sslType === 'disable') {
        return false;
    }

    if (sslType === 'allow') {
        true;
    }

    if (['prefer', 'require', 'verify-ca', 'verify-full'].includes(sslType)) {
        return {
            ca: fs.existsSync(connectionInfo.certAuthority)
                ? fs.readFileSync(connectionInfo.certAuthority).toString()
                : '',
            cert: fs.existsSync(connectionInfo.clientCert) ? fs.readFileSync(connectionInfo.clientCert).toString() : '',
            key: fs.existsSync(connectionInfo.clientPrivateKey)
                ? fs.readFileSync(connectionInfo.clientPrivateKey).toString()
                : '',
        };
    }
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

const createClient = async connectionInfo => {
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
        application_name: 'Hackolade',
    };

    const client = new pg.Client(config);
    await client.connect();

    return { client, sshTunnel };
};

module.exports = {
    createClient,
};
