const fs = require('fs');
const ssh = require('tunnel-ssh');

let Client = null;

const setConnectionHelperDependencies = app => {
    Client = app.require('pg-native');
};

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
        return {};
    }

    if (sslType === 'allow') {
        return {
            rejectUnauthorized: false,
        };
    }

    if (['prefer', 'require', 'verify-ca', 'verify-full'].includes(sslType)) {
        return {
            sslrootcert: connectionInfo.certAuthority,
            sslcert: connectionInfo.clientCert,
            sslkey: connectionInfo.clientPrivateKey,
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
        port: connectionInfo.port,
        dbname: connectionInfo.database || connectionInfo.maintenanceDatabase,
        user: connectionInfo.userName,
        password: connectionInfo.userPassword,
        connect_timeout: Number(connectionInfo.queryRequestTimeout) || 60000,
        application_name: 'hackolade',
        keepalives: 1,
        sslmode: connectionInfo.sslType,
        ...getSslOptions(connectionInfo),
    };

    const client = await connectClient(config);

    return { client, sshTunnel };
};

const connectClient = config => {
    return new Promise((resolve, reject) => {
        const paramsString = Object.entries(config)
            .map(([key, value]) => getParameter(key, value))
            .join(' ');

        const client = new Client();

        client.connect(paramsString, error => {
            if (error) {
                return reject(error);
            }

            resolve(client);
        });
    });
};

const getParameter = (key, value) => {
    if (value?.toString()) {
        return `${key}=${value}`;
    }

    return '';
};

module.exports = {
    createClient,
    setConnectionHelperDependencies,
};
