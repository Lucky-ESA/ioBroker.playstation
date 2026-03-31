const EventEmitter = require("node:events");
const path = require("node:path");
const fs = require("node:fs");
const { homedir } = require("node:os");
const { Device } = require(`${path.join(__dirname, "../../")}/playactor-iobroker/dist/device`);
const { DeviceOptions } = require(`${path.join(__dirname, "../../")}/playactor-iobroker/dist/cli/options`);
const { Discovery } = require(`${path.join(__dirname, "../../")}/playactor-iobroker/dist/discovery`);
const { DeviceStatus } = require(`${path.join(__dirname, "../../")}/playactor-iobroker/dist/discovery/model`);

class ps4 extends EventEmitter {
    constructor(api, adapter) {
        super();
        this.adapter = adapter;
        this.mdns = null;
        this.api = api;
        this.ip = api.ip;
        this.dp = `${api.dp}.device.`;
        this.timeout = null;
        this.stateValue = {};
        this.check();
    }

    async check() {
        this.adapter.log.debug(`Credentials: ${JSON.stringify(await this.readCredentials())}`);
        let status = "OFFLINE";
        try {
            const device = Device.withAddress(this.ip);
            if (device && device.credentials && device.credentials.storage && device.credentials.storage.filePath) {
                await this.setStates("credentials", device.credentials.storage.filePath, true);
            }
            this.adapter.log.debug(`devices: ${JSON.stringify(device)}`);
            const deviceInformation = await device.discover();
            if (deviceInformation && deviceInformation.address && deviceInformation.address.address) {
                await this.setStates("ip", deviceInformation.address.address, true);
            } else {
                await this.setStates("ip", this.ip, true);
            }
            if (deviceInformation && deviceInformation.id) {
                await this.setStates("id", deviceInformation.id, true);
            }
            if (deviceInformation && deviceInformation.name) {
                await this.setStates("name", deviceInformation.name, true);
            }
            if (deviceInformation && deviceInformation.status) {
                await this.setStates("status", deviceInformation.status, true);
                status = deviceInformation.status;
            }
            if (deviceInformation && deviceInformation.type) {
                await this.setStates(
                    "type",
                    this.remotePlayVersionFor(deviceInformation.type, deviceInformation.systemVersion),
                    true,
                );
            }
            if (deviceInformation && deviceInformation.hostRequestPort) {
                const hostRequestPort =
                    typeof deviceInformation.hostRequestPort !== "number"
                        ? parseInt(deviceInformation.hostRequestPort)
                        : deviceInformation.hostRequestPort;
                await this.setStates("port", hostRequestPort, true);
            }
            if (deviceInformation && deviceInformation.systemVersion) {
                const systemVersion =
                    typeof deviceInformation.systemVersion !== "number"
                        ? parseInt(deviceInformation.systemVersion)
                        : deviceInformation.systemVersion;
                await this.setStates("systemVersion", systemVersion, true);
            }
            if (deviceInformation && deviceInformation.extras && deviceInformation.extras["running-app-name"]) {
                await this.setStates("running_app_name", deviceInformation.extras["running-app-name"], true);
            }
            if (deviceInformation && deviceInformation.extras && deviceInformation.extras["running-app-titleid"]) {
                await this.setStates("running_app_titleId", deviceInformation.extras["running-app-titleid"], true);
            }
            this.adapter.log.debug(`deviceInformation: ${JSON.stringify(deviceInformation)}`);
        } catch (e) {
            this.adapter.log.debug(`Error check device: ${e}`);
        }
        if (status === "AWAKE") {
            await this.setStatesOnline(true);
            this.adapter.setStatus(this.api.dp, true);
            this.checkInterval(true);
        } else if (status === "STANDBY") {
            await this.setStatesOnline(false);
            this.adapter.setStatus(this.api.dp, false);
            this.checkInterval(true);
        } else {
            await this.setStatesOnline(false);
            this.adapter.setStatus(this.api.dp, false);
            this.checkInterval(false);
        }
    }

    readCredentials() {
        this.adapter.log.debug(homedir());
        const credentials = path.join(homedir(), ".config", "playactor-iobroker", "credentials.json");
        try {
            const contents = fs.readFileSync(credentials);
            return JSON.parse(contents.toString());
        } catch {
            return {};
        }
    }

    remotePlayVersionFor(type, systemVersion) {
        if (type === "PS5") {
            return "PS5_1";
        }
        const versionInt = parseInt(systemVersion, 10);
        if (versionInt >= 8000000) {
            return "PS4_10";
        }
        if (versionInt >= 7000000) {
            return "PS4_9";
        }
        return "PS4_8";
    }

    async dummyInfo() {
        this.adapter.log.debug(`DeviceStatus: ${JSON.stringify(DeviceStatus)}`);
        const deviceId = "TEST"; // deviceInformation.id
        const opt = new DeviceOptions();
        opt.dontAutoOpenUrls = true;
        opt.deviceHostId = deviceId;
        this.adapter.log.debug(`opt: ${JSON.stringify(opt)}`);
        const finddevice = await opt.findDevice();
        this.adapter.log.debug(`finddevice: ${JSON.stringify(finddevice)}`);
        const discovery = new Discovery();
        const discoveryDevices = discovery.discover();
        this.adapter.log.debug(`discoveryDevices: ${JSON.stringify(discoveryDevices)}`);
        const conn = await finddevice.openConnection();
        await conn.close();
    }

    async setStates(id, val, ack) {
        const obj = `${this.dp}${id}`;
        if (this.stateValue[obj] === undefined || this.stateValue[obj] != val) {
            this.stateValue[obj] = val;
            await this.adapter.setState(obj, { val: val, ack: ack });
        }
    }

    async setStatesOnline(val) {
        const obj = `${this.api.dp}.online`;
        if (this.stateValue[obj] === undefined || this.stateValue[obj] != val) {
            this.stateValue[obj] = val;
            await this.adapter.setState(obj, { val: val, ack: true });
        }
    }

    startMulticast() {
        this.adapter.log.debug(`Start Multicast`);
        if (!this.mdns) {
            this.adapter.log.debug(`Load Multicast`);
            this.mdns = require("multicast-dns")();
        }
        this.mdns.on("response", response => {
            if (response.answers) {
                const isfind = response.answers.find(ip => ip.data === this.ip);
                if (isfind) {
                    this.adapter.log.info(`Device ${this.ip} is online`);
                    this.check();
                }
            }
        });
    }

    async checkInterval(state) {
        this.adapter.log.debug(`checkInterval: ${state}`);
        await this.destroy();
        if (state) {
            this.setNewTimeout();
        } else {
            this.startMulticast();
        }
    }

    setNewTimeout() {
        this.adapter.log.debug(`Start timeout with ${this.api.interval} seconds`);
        this.timeout = this.adapter.setTimeout(() => {
            this.check();
        }, this.api.interval * 1000);
    }

    async destroy() {
        this.timeout && this.adapter.clearTimeout(this.timeout);
        this.timeout = null;
        if (this.mdns) {
            this.mdns.destroy();
        }
        this.mdns = null;
    }
}

module.exports = ps4;
