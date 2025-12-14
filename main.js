"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require("@iobroker/adapter-core");
const util = require("node:util");
const udp = require("node:dgram");
const axios = require("axios");
const Json2iob = require("./lib/extractKeys");
const tough = require("tough-cookie");
const constants = require("./lib/constants");
const requests_trophy = require("./lib/requests_trophy");
const requests_profile = require("./lib/requests_profile");
const requests_group = require("./lib/requests_group");
const requests_star = require("./lib/requests_star");
const requests_store = require("./lib/requests_store");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const exec = util.promisify(require("node:child_process").exec);
const path = require("node:path");
const fs = require("node:fs");
const { mkdir } = require("node:fs/promises");
const { homedir } = require("node:os");
const PS4 = require("./lib/connection");
const helper = require("./lib/helper");
const { createHash } = require("node:crypto");
const http = require("node:http");
let status = {
    countRequest: 0,
    maxRequest: 600,
    periode: 900000,
    timestamp: 0,
    timeISO: new Date(),
    request: "",
    lastRequest: new Date(),
    npssoExired: 0,
    npssoNew: 0,
    error: "NoError",
    lastError: new Date(),
};
class Playstation extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "playstation",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.createObjects = helper.createObjects;
        this.createDataPoint = helper.createDataPoint;
        this.createProfile = helper.createProfile;
        this.createStar = helper.createStar;
        this.createStore = helper.createStore;
        this.gameList = requests_profile.gameList;
        this.updateProfile = requests_profile.updateProfile;
        this.loadAccount_id = requests_profile.loadAccount_id;
        this.loadOnline_id = requests_profile.loadOnline_id;
        this.loadTrophy_id = requests_trophy.loadTrophy_id;
        this.loadRequest = requests_profile.loadRequest;
        this.trophyTitleGroup = requests_profile.trophyTitleGroup;
        this.trophyTitle = requests_trophy.trophyTitle;
        this.trophyTitleUserGroup = requests_trophy.trophyTitleUserGroup;
        this.trophiesTitle = requests_trophy.trophiesTitle;
        this.trophiesEarnedTitle = requests_trophy.trophiesEarnedTitle;
        this.gameTitle = requests_profile.gameTitle;
        this.loadReceivedRequests = requests_profile.loadReceivedRequests;
        this.getUniversalSearch = requests_profile.getUniversalSearch;
        this.getUniversalSearchPagination = requests_profile.getUniversalSearchPagination;
        this.getHintAvailability = requests_trophy.getHintAvailability;
        this.getTips = requests_trophy.getTips;
        this.getStoreWishlist = requests_profile.getStoreWishlist;
        this.getDeviceInfo = requests_profile.getDeviceInfo;
        this.presencesUser = requests_profile.presencesUser;
        this.allDocuments = requests_profile.allDocuments;
        this.shareProfile = requests_profile.shareProfile;
        this.leaveGroup = requests_group.leaveGroup;
        this.loadGroups = requests_group.loadGroups;
        this.loadMessages = requests_group.loadMessages;
        this.settingGroup = requests_group.settingGroup;
        this.inviteMembers = requests_group.inviteMembers;
        this.createGroup = requests_group.createGroup;
        this.kickMember = requests_group.kickMember;
        this.sendGroupMessage = requests_group.sendGroupMessage;
        this.loadFileData = requests_group.loadFileData;
        this.receivedRequestsAccept = requests_profile.receivedRequestsAccept;
        this.receivedRequestsReject = requests_profile.receivedRequestsReject;
        this.starRequest = requests_star.starRequest;
        this.featuresRetrieve = requests_store.getFeaturesRetrieve;
        this.getWithProductId = requests_store.getWithProductId;
        this.getProducts = requests_store.getProducts;
        this.getWithConceptId = requests_store.getWithConceptId;
        this.getWithTitleId = requests_store.getWithTitleId;
        this.lang = "us";
        this.app_agent = "";
        this.double_call = {};
        this.clients = {};
        this.session = {};
        this.getHeader = {};
        this.accountId = null;
        this.onlineId = null;
        this.intervalToken = null;
        this.timeoutToken = null;
        this.timeoutUDP = null;
        this.resultMessage = {};
        this.countDelete = 0;
        this.deviceData = {};
        this.port = 987;
        this.server = null;
        this.countLogin = 0;
        this.countRefreshLogin = 0;
        this.cookieJar = new tough.CookieJar();
        this.requestClient = axios.create({
            withCredentials: true,
            timeout: 5000,
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new HttpsCookieAgent({
                cookies: {
                    jar: this.cookieJar,
                },
                keepAlive: true,
                rejectUnauthorized: false,
            }),
        });
        this.json2iob = new Json2iob(this);
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     *
     */
    async onReady() {
        await this.setCredential();
        const loadStatus = await this.getStateAsync("status");
        if (loadStatus && typeof loadStatus.val === "string" && loadStatus.val.includes("countRequest")) {
            status = JSON.parse(loadStatus.val);
        }
        let isOnline = true;
        this.app_agent = constants.APP_AGENT[Math.floor(Math.random() * constants.APP_AGENT.length)];
        const lang = this.config.langPSN.split("-");
        this.lang = lang[0] ? lang[0] : this.lang;
        this.getHeader = {
            headers: {
                "User-Agent": this.app_agent,
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept-Encoding": "gzip, deflate",
                Accept: "*/*",
                Connection: "keep-alive",
                Authorization: "",
                "Accept-Language": `${this.config.langPSN},${lang[0]};q=0.9`,
                Country: lang[1],
            },
        };
        if (this.config.npsso && this.config.npsso != "") {
            this.log.info(`NPSSO is available`);
            this.log.info(`Create profile objects`);
            await this.createProfile();
            const nextStep = await this.sessionCheck();
            this.log.debug(`nextStep ${nextStep}`);
            if (nextStep === 0) {
                const login = await this.login();
                if (login) {
                    this.setRefreshTokenInterval();
                    await this.updateProfile(constants, true);
                } else {
                    isOnline = false;
                }
            } else if (nextStep === 1) {
                this.refreshNewToken();
            } else {
                this.timeoutToken = this.setTimeout(() => {
                    this.timeoutToken = null;
                    this.refreshNewToken();
                }, nextStep);
                await this.updateProfile(constants, true);
            }
            this.log.info(`Create store objects`);
            await this.createStore();
            if (this.config.star) {
                this.log.info(`Create stars objects`);
                this.createStar();
            } else {
                await this.delObjectAsync(`profile_remote_stars`, { recursive: true });
            }
        } else {
            this.log.info(`No NPSSO available`);
        }
        await this.setState("info.connection", { val: false, ack: true });
        if (!this.config.psn) {
            const accountId = await this.getStateAsync(`playstation.0.profile.account.accountId`);
            if (accountId && accountId.val) {
                this.log.info(`Found Accound-ID - Adapter restart!`);
                await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, {
                    native: {
                        psn: true,
                    },
                });
            }
        }
        const devices = this.config.ps;
        for (const dev of devices) {
            if (!dev) {
                continue;
            }
            if (!dev.active) {
                this.log.info(`Device is ${dev.ps4name} disabled`);
                continue;
            }
            if (dev.interval < 5 || dev.interval > 3600) {
                this.log.info(`Interval changed to 60 seconds!`);
                dev.interval = 60;
            }
            dev.dp = this.forbidden_ip(dev.ip);
            this.log.info(`Create Obejcts for ${dev.ip}`);
            this.clients[dev.dp] = {};
            this.clients[dev.dp].online = false;
            await this.createObjects(dev);
            this.clients[dev.dp].api = new PS4(dev, this);
            this.clients[dev.dp].dev = dev;
        }
        this.subscribeStates("*");
        await this.checkDeviceFolder();
        if (isOnline) {
            this.setState("info.connection", { val: true, ack: true });
        }
    }

    forbidden_ip(ip) {
        return ip.replace(/[.]/g, "_").replace(this.FORBIDDEN_CHARS, "_");
    }

    setRefreshTokenInterval() {
        this.log.debug(`Start refreshTokenInterval!`);
        this.intervalToken = this.setInterval(
            () => {
                this.refreshNewToken();
            },
            (this.session.access.expires_in - 100) * 1000,
        );
    }

    async refreshNewToken() {
        this.log.debug(`Start refreshToken - ${JSON.stringify(this.session)}`);
        if (!this.session || !this.session.access || !this.session.access.refresh_token) {
            this.log.error("Missing refreshToken");
            ++this.countLogin;
            return false;
        }
        const actual = new Date().getTime();
        if (this.session.access.next_refresh < actual) {
            this.log.debug(`Refresh token is expired! - ${JSON.stringify(this.session)}`);
            if (this.countLogin > 5) {
                this.log.warn("Refresh login limit reached!! Stop all intervals");
                this.unloadAllTimer();
                this.setState("info.connection", { val: false, ack: true });
                return false;
            }
            this.login();
            ++this.countRefreshLogin;
            return false;
        }
        this.countRefreshLogin = 0;
        await this.status(`${constants.BASE_PATH.base_uri}${constants.API_PATH.access_token}`);
        const requestToken = await this.requestClient({
            method: "post",
            url: `${constants.BASE_PATH.base_uri}${constants.API_PATH.access_token}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${constants.BASIC_AUTH}`,
            },
            data: {
                refresh_token: this.session.access.refresh_token,
                grant_type: "refresh_token",
                token_format: "jwt",
                scope: "psn:mobile.v2.core psn:clientapp",
            },
        })
            .then(res => {
                if (res.data) {
                    return res.data;
                }
                return null;
            })
            .catch(error => {
                this.log.error(error);
                error.response && this.log.error(JSON.stringify(error.response.message));
                status.error = JSON.stringify(error);
                status.lastError = new Date();
                this.setCounterStatus();
                return null;
            });
        if (requestToken && requestToken.access_token) {
            this.log.debug(`requestToken: ${JSON.stringify(requestToken)}`);
            this.session.access = requestToken;
            this.session.next = new Date().getTime() + parseInt(this.session.access.expires_in) * 1000;
            this.intervalToken && this.clearInterval(this.intervalToken);
            this.getHeader.headers.Authorization = `Bearer ${this.session.access.access_token}`;
            this.setRefreshTokenInterval();
            this.log.debug(`this.session: ${JSON.stringify(this.session)}`);
            await this.setState("session", { val: this.encrypt(JSON.stringify(this.session)), ack: true });
            this.log.info("Refresh token successful");
            this.updateProfile(constants, false);
            this.countLogin = 0;
            return true;
        }
        this.log.error(`Request token is invalid`);
        ++this.countLogin;
        if (this.countLogin > 3) {
            this.log.warn("Relogin limit reached!! Stop all intervals");
            this.unloadAllTimer();
            this.setState("info.connection", { val: false, ack: true });
            return false;
        }
        this.login();
        return false;
    }

    /**
     * setCredential
     */
    async setCredential() {
        if (this.config.selectPS4 && this.config.selectPS4 != "" && Object.keys(this.config.ps).length > 0) {
            const ps = this.config.ps;
            const foundIP = ps.find(t => t.ip === this.config.selectPS4);
            let credential = {};
            try {
                if (fs.existsSync(`${this.adapterDir}/lib/credentials.json`)) {
                    const data_credentials = fs.readFileSync(`${this.adapterDir}/lib/credentials.json`, "utf-8");
                    if (data_credentials.startsWith("{") && data_credentials.length > 10) {
                        credential = JSON.parse(data_credentials);
                    }
                }
            } catch {
                this.log.debug(`No found credential!`);
            }
            if (credential[this.config.selectPS4]) {
                if (foundIP) {
                    foundIP.credential = JSON.stringify(credential[this.config.selectPS4]);
                }
                const credentials = path.join(homedir(), ".config", "playactor-iobroker");
                this.log.debug(credentials);
                let contents;
                if (fs.lstatSync(credentials).isDirectory().toString()) {
                    try {
                        contents = fs.readFileSync(`credentials}/credentials.json`);
                        contents = JSON.parse(contents.toString());
                    } catch {
                        contents = {};
                    }
                    if (JSON.stringify(contents) != JSON.stringify(credential[this.config.selectPS4])) {
                        fs.writeFile(
                            `${credentials}/credentials.json`,
                            JSON.stringify(credential[this.config.selectPS4]),
                            err => {
                                if (err) {
                                    this.log.error(err.message);
                                }
                            },
                        );
                    }
                }
                this.log.info(`Set new config - Adapter restart!`);
                await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, {
                    native: {
                        ps: this.config.ps,
                        selectPS4: "",
                    },
                });
            } else {
                this.log.info(`No found credentials for device ${this.config.selectPS4}`);
            }
        }
    }

    async login() {
        const queryString = new URLSearchParams({
            access_type: "offline",
            client_id: constants.UUID,
            redirect_uri: constants.REDIRECT,
            response_type: "code",
            scope: "psn:mobile.v2.core psn:clientapp",
        }).toString();
        await this.status(`${constants.BASE_PATH.base_uri}${constants.API_PATH.oauth_code}?${queryString}`);
        const requestCode = await this.requestClient({
            method: "get",
            url: `${constants.BASE_PATH.base_uri}${constants.API_PATH.oauth_code}?${queryString}`,
            headers: {
                Cookie: `npsso=${this.config.npsso}`,
            },
            maxRedirects: 0,
        })
            .then(res => {
                return res;
            })
            .catch(error => {
                this.log.debug(error);
                status.error = JSON.stringify(error);
                status.lastError = new Date();
                this.setCounterStatus();
                if (error.response) {
                    return error.response.headers;
                }
                return null;
            });
        this.log.debug(`requestCode: ${JSON.stringify(requestCode)}`);
        if (!requestCode || !requestCode["location"] || !requestCode["location"].includes("?code=")) {
            this.log.error(`
              There was a problem retrieving your PSN access code. Is your NPSSO code valid?
              To get a new NPSSO code, visit https://ca.account.sony.com/api/v1/ssocookie.
            `);
            return false;
        }
        const redirectLocation = requestCode["location"];
        const redirectParams = new URLSearchParams(redirectLocation.split("redirect/")[1]);
        const code = redirectParams.get("code");
        if (code) {
            await this.status(`${constants.BASE_PATH.base_uri}${constants.API_PATH.access_token}`);
            const requestToken = await this.requestClient({
                method: "post",
                url: `${constants.BASE_PATH.base_uri}${constants.API_PATH.access_token}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${constants.BASIC_AUTH}`,
                },
                data: {
                    code: code,
                    redirect_uri: constants.REDIRECT,
                    grant_type: "authorization_code",
                    token_format: "jwt",
                },
            })
                .then(res => {
                    if (res.data) {
                        return res.data;
                    }
                    return null;
                })
                .catch(error => {
                    this.log.error(error);
                    error.response && this.log.error(JSON.stringify(error.response.message));
                    status.error = JSON.stringify(error);
                    status.lastError = new Date();
                    this.setCounterStatus();
                    return null;
                });
            if (requestToken && requestToken.access_token) {
                this.log.debug(`requestToken: ${JSON.stringify(requestToken)}`);
                this.session.access = requestToken;
                this.getHeader.headers.Authorization = `Bearer ${this.session.access.access_token}`;
                this.session.next = new Date().getTime() + parseInt(this.session.access.expires_in) * 1000;
                this.session.next_refresh =
                    new Date().getTime() + parseInt(this.session.access.refresh_token_expires_in) * 1000;
                this.session.acual = new Date().getTime();
                this.session.code = code;
                this.log.debug(`this.session: ${JSON.stringify(this.session)}`);
                await this.setState("session", { val: this.encrypt(JSON.stringify(this.session)), ack: true });
                this.setNPSSO();
                this.log.info("Login successful");
                return true;
            }
            this.log.error(`Request token is invalid`);
            return false;
        }
        this.log.error(`Code is invalid`);
        return false;
    }

    async requestPSN(methode, url, header, data, viewError) {
        if (!(await this.status(url))) {
            return;
        }
        return await this.requestClient({
            method: methode,
            url: url,
            ...header,
            ...data,
        })
            .then(res => {
                return res;
            })
            .catch(error => {
                if (viewError) {
                    this.log.error(error);
                    error.response && this.log.error(JSON.stringify(error.response.message));
                    const err = constants.STATUS_CODES[error.response];
                    if (err) {
                        this.log.error(err);
                    } else {
                        this.log.error(error.response.status);
                    }
                }
                status.error = JSON.stringify(error);
                status.lastError = new Date();
                this.setCounterStatus();
                return error;
            });
    }

    /**
     * setNPSSO
     */
    setNPSSO() {
        this.extendObject("session", {
            native: {
                npsso: this.config.npsso,
            },
        });
    }

    /**
     * sessionCheck
     */
    async sessionCheck() {
        const obj = await this.getObjectAsync("session");
        if (obj) {
            if (obj.native && obj.native.npsso != "") {
                if (obj.native.npsso != this.config.npsso) {
                    this.log.debug(`NPSSO has been changed!`);
                    status.npssoNew = Date.now();
                    this.setCounterStatus();
                    return 0;
                }
            }
            const check_key = await this.getStateAsync("session");
            if (
                check_key != null &&
                check_key.val != null &&
                check_key.val.toString().indexOf("aes-192-cbc") !== -1 &&
                typeof check_key.val === "string" &&
                check_key.val != ""
            ) {
                check_key.val = this.decrypt(check_key.val);
                const actual = new Date().getTime();
                if (typeof check_key.val === "string") {
                    this.log.debug(`Old session ${check_key.val}`);
                    const val = JSON.parse(check_key.val);
                    if (val && val.next > actual && val.next_refresh > actual) {
                        this.log.debug(`Use old session! - ${JSON.stringify(val)}`);
                        this.session = val;
                        this.getHeader.headers.Authorization = `Bearer ${this.session.access.access_token}`;
                        return val.next - actual;
                    } else if (val && val.next_refresh < actual) {
                        this.log.debug(`Refresh token is expired! - ${JSON.stringify(val)}`);
                        this.session = val;
                        return 0;
                    } else if (val && val.access.refresh_token) {
                        this.log.debug(`Use old session for refresh token! - ${JSON.stringify(val)}`);
                        this.session = val;
                        return 1;
                    }
                }
                return 0;
            }
            return 0;
        }
        await this.setState("session", { val: "", ack: true });
        return 0;
    }

    /**
     * checkDeviceFolder
     */
    async checkDeviceFolder() {
        try {
            this.log.info(`Start check devices object!`);
            const devices = await this.getDevicesAsync();
            for (const element of devices) {
                const id = element["_id"].split(".").pop();
                if (this.clients[id]) {
                    this.log.debug(`Found device ${element["_id"]}`);
                } else {
                    this.log.info(`Delete device ${element["_id"]}`);
                    await this.delObjectAsync(`${id}`, { recursive: true });
                }
            }
        } catch (e) {
            this.log.error(`checkDeviceFolder: ${e}`);
        }
    }

    unloadAllTimer() {
        this.intervalToken && this.clearInterval(this.intervalToken);
        this.timeoutToken && this.clearTimeout(this.timeoutToken);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.json2iob.destroy();
            this.intervalToken && this.clearInterval(this.intervalToken);
            this.timeoutToken && this.clearTimeout(this.timeoutToken);
            this.timeoutUDP && this.clearTimeout(this.timeoutUDP);
            for (const id in this.clients) {
                this.clients[id].api.destroy();
            }
            this.server && this.server.close();
            callback();
        } catch {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state && !state.ack) {
            const remote = id.split(".")[3];
            const lastsplit = id.split(".").pop();
            if (remote === "remote") {
                const device = id.split(".")[2];
                if (this.clients[device] == null) {
                    return;
                }
                switch (lastsplit) {
                    case "up":
                    case "down":
                    case "left":
                    case "right":
                    case "enter":
                    case "option":
                    case "back":
                    case "ps":
                    case "square":
                    case "x":
                    case "circle":
                    case "triangle":
                        if (this.clients[device].online) {
                            this.sendCommand(device, "send-keys", lastsplit);
                            this.setAckFlag(id, { val: false });
                        }
                        return;
                    case "wakeup":
                        if (!this.clients[device].online && state.val) {
                            this.sendCommand(device, "wake", null);
                            this.setAckFlag(id, { val: false });
                        }
                        return;
                    case "standby":
                        if (this.clients[device].online && state.val) {
                            this.sendCommand(device, "standby", null);
                            this.setAckFlag(id, { val: false });
                        }
                        return;
                    case "ownCommand":
                        if (this.clients[device].online && state.val != "") {
                            this.sendCommand(device, "send-keys", state.val);
                            this.setAckFlag(id, { val: "" });
                        }
                        return;
                    case "osk":
                        if (this.clients[device].online && state.val != "") {
                            this.sendCommand(device, "osk-submit", null);
                            this.setAckFlag(id, { val: "" });
                        }
                        return;
                    case "startGame":
                        if (this.clients[device].online && state.val != "") {
                            this.sendCommand(device, "start-id", state.val);
                            this.setAckFlag(id, { val: "" });
                        }
                        return;
                    default:
                        this.log.warn(`Command ${lastsplit} unknown`);
                        return;
                }
            }
            if (lastsplit === "limit" || lastsplit === "offset") {
                this.setAckFlag(id);
                return;
            }
            const profile_remote = id.split(".")[2];
            if (profile_remote === "profile_remote_groups") {
                switch (lastsplit) {
                    case "loadGroups":
                        this.loadGroups(constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "loadGroups_with_message":
                        this.loadGroups(constants, true);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "selectGroup":
                        this.loadMessages(state.val, constants, false);
                        this.setAckFlag(id);
                        break;
                    case "groupSettings":
                        this.settingGroup(state, constants);
                        this.setAckFlag(id, { val: JSON.stringify({ groupName: { value: "group_name" } }) });
                        break;
                    case "inviteMembers":
                        this.inviteMembers(state, constants);
                        this.setAckFlag(id, { val: JSON.stringify(["0000000000000001", "0000000000000002"]) });
                        break;
                    case "createGroup":
                        this.createGroup(state, constants);
                        this.setAckFlag(id, { val: JSON.stringify(["0000000000000001", "0000000000000002"]) });
                        break;
                    case "loadFileData":
                        this.loadFileData(state.val, constants);
                        this.setAckFlag(id, {
                            val: JSON.stringify(["<groupId>", "<resourceId>", "<messageType>", "<saveInMeta>"]),
                        });
                        break;
                    case "kickMember":
                        this.kickMember(state, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "sendGroupMessage":
                        this.sendGroupMessage(state, constants);
                        this.setAckFlag(id, { val: "" });
                        break;
                    default:
                        this.log.warn(`Command ${lastsplit} unknown`);
                        break;
                }
            } else if (profile_remote === "profile_remote_trophies") {
                switch (lastsplit) {
                    case "trophy_all":
                        this.loadTrophy_id(state.val, constants);
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "trophy_title":
                        this.trophyTitle(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "trophy_title_group":
                        this.trophyTitleGroup(state.val, constants);
                        this.setAckFlag(id, { val: JSON.stringify(["<npCommunicationId>", "<platform>"]) });
                        break;
                    case "trophy_title_group_user":
                        this.trophyTitleUserGroup(state.val, constants);
                        this.setAckFlag(id, {
                            val: JSON.stringify(["<accountId>", "<npCommunicationId>", "<platform>"]),
                        });
                        break;
                    case "trophies_for_title":
                        this.trophiesTitle(state.val, constants);
                        this.setAckFlag(id, {
                            val: JSON.stringify(["<npCommunicationId>", "<groupId>", "<platform>"]),
                        });
                        break;
                    case "trophies_earned_for_title":
                        this.trophiesEarnedTitle(state.val, constants);
                        this.setAckFlag(id, {
                            val: JSON.stringify(["<accountId>", "<npCommunicationId>", "<groupId>", "<platform>"]),
                        });
                        break;
                    case "trophies_game_help_available_for_title":
                        this.getHintAvailability(state.val, constants);
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "trophies_game_help_for_title":
                        this.getTips(state.val, constants);
                        this.setAckFlag(id, {
                            val: JSON.stringify(["<npCommunicationId>", "<trophyId>", "<udsObjectId>", "<helpType>"]),
                        });
                        break;
                    default:
                        this.log.warn(`Command ${lastsplit} unknown`);
                        break;
                }
            } else if (profile_remote === "profile_remote_profile") {
                const lastsplit = id.split(".").pop();
                switch (lastsplit) {
                    case "update_profile":
                        this.updateProfile(constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "leaveGroup":
                        this.leaveGroup(constants);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "presencesUser":
                        this.presencesUser(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "online_with_name":
                        this.loadRequest("online", true, constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "online_without_name":
                        this.loadRequest("online", false, constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "blocked_with_name":
                        this.loadRequest("block", true, constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "blocked_without_name":
                        this.loadRequest("block", false, constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "friends_with_name":
                        this.loadRequest("friend", true, constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "friends_without_name":
                        this.loadRequest("friend", false, constants, false);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "friends_with_name_status":
                        this.loadRequest("friend", true, constants, true);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "received_requests_without_name":
                        this.loadReceivedRequests(false, constants);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "received_requests_with_name":
                        this.loadReceivedRequests(true, constants);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "received_requests_accept":
                        this.receivedRequestsAccept(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "received_requests_reject":
                        this.receivedRequestsReject(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "account_id":
                        this.loadAccount_id(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "online_id":
                        this.loadOnline_id(state.val, constants);
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "gameList":
                        this.gameList(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "gameTitle":
                        this.gameTitle(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    case "search_user":
                        this.getUniversalSearch(state.val, "MobileUniversalSearchSocial", constants);
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "search_game":
                        this.getUniversalSearch(state.val, "MobileUniversalSearchGame", constants);
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "search_result_pagination":
                        this.getUniversalSearchPagination(state.val, constants);
                        this.setAckFlag(id);
                        break;
                    case "storeWishlist":
                        this.getStoreWishlist(constants);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "shareProfile":
                        this.shareProfile(state.val, constants);
                        this.setAckFlag(id, { val: 0 });
                        break;
                    default:
                        this.log.warn(`Command ${lastsplit} unknown`);
                        break;
                }
            } else if (profile_remote === "profile_remote_stars") {
                const lastsplit = id.split(".").pop();
                switch (lastsplit) {
                    case "user_earned_collectibles":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            { includeDisplayItems: false },
                            constants.hashMap.metGetUserCollectibles,
                            constants.API_PATH.getUserCollectibles,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    case "user_display_case":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            { accountId: "me" },
                            constants.hashMap.metGetCollectibleDisplay,
                            constants.API_PATH.getCollectibleDisplay,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    case "user_history":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            null,
                            constants.hashMap.metGetPointsHistory,
                            constants.API_PATH.getPointsHistory,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    case "user_summary":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            { accountId: "me" },
                            constants.hashMap.metGetAccount,
                            constants.API_PATH.getAccount,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    case "rewards_tiers":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            null,
                            constants.hashMap.metGetStatusLevels,
                            constants.API_PATH.getStatusLevels,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    case "display_cases":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            null,
                            constants.hashMap.metGetCollectibleScenes,
                            constants.API_PATH.getCollectibleScenes,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    case "collectible_detail":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            { collectibleId: state.val, accountId: "me" },
                            constants.hashMap.metLoyaltyGetOwnedCollectibleById,
                            constants.API_PATH.getLoyaltyGetOwnedCollectibleById,
                        );
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "rewards_detail":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            { id: state.val },
                            constants.hashMap.metLoyaltyRewardbyId,
                            constants.API_PATH.getLoyaltyRewardbyId,
                        );
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "rewards":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            null,
                            constants.hashMap.metGetRewardGroup,
                            constants.API_PATH.getRewardGroup,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    case "campaigns_detail":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            { campaignId: state.val },
                            constants.hashMap.metLoyaltyCampaignByIdRetrieve,
                            constants.API_PATH.getLoyaltyCampaignByIdRetrieve,
                        );
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "campaigns":
                        this.starRequest(
                            constants.BASE_PATH.graph_ql,
                            null,
                            constants.hashMap.metGetCampaignGroup,
                            constants.API_PATH.getCampaignGroup,
                        );
                        this.setAckFlag(id, { val: false });
                        break;
                    default:
                        this.log.warn(`Command ${lastsplit} unknown`);
                        break;
                }
            } else if (profile_remote === "profile_remote_store") {
                const lastsplit = id.split(".").pop();
                switch (lastsplit) {
                    case "addons_with_titleId":
                        this.getWithTitleId(
                            state,
                            constants.hashMap.metGetAddOnsByTitleId,
                            constants.API_PATH.getAddOnsByTitleId,
                            constants.BASE_PATH.graph1_ql,
                        );
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "rating_with_conceptId":
                        this.getWithConceptId(
                            state,
                            constants.hashMap.wcaConceptStarRatingRetrive,
                            constants.API_PATH.getWcaConceptStarRatingRetrive,
                            constants.BASE_PATH.graph1_ql,
                        );
                        this.setAckFlag(id, { val: "0" });
                        break;
                    case "rating_with_productId":
                        this.getWithProductId(
                            state,
                            constants.hashMap.wcaProductStarRatingRetrive,
                            constants.API_PATH.getWcaProductStarRatingRetrive,
                            constants.BASE_PATH.graph1_ql,
                        );
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "pricing_with_conceptId":
                        this.getWithConceptId(
                            state,
                            constants.hashMap.metGetPricingDataByConceptId,
                            constants.API_PATH.getPricingDataByConceptId,
                            constants.BASE_PATH.graph1_ql,
                        );
                        this.setAckFlag(id, { val: "0" });
                        break;
                    case "concept_with_productId":
                        this.getWithProductId(
                            state,
                            constants.hashMap.metGetConceptByProductIdQuery,
                            constants.API_PATH.getConceptByProductIdQuery,
                            constants.BASE_PATH.graph1_ql,
                        );
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "concept_with_conceptId":
                        this.getWithConceptId(
                            state,
                            constants.hashMap.metGetConceptById,
                            constants.API_PATH.getConceptById,
                            constants.BASE_PATH.graph1_ql,
                        );
                        this.setAckFlag(id, { val: "0" });
                        break;
                    case "products":
                        this.getProducts(state, constants);
                        this.setAckFlag(id, { val: false });
                        break;
                    case "product_with_productId":
                        this.getWithProductId(
                            state,
                            constants.hashMap.metGetProductById,
                            constants.API_PATH.getProductById,
                            constants.BASE_PATH.graph1_ql,
                        );
                        this.setAckFlag(id, { val: "" });
                        break;
                    case "param":
                        this.setAckFlag(id);
                        break;
                    case "featuresRetrieve":
                        this.featuresRetrieve(state, constants);
                        this.setAckFlag(id);
                        break;
                    default:
                        this.log.warn(`Command ${lastsplit} unknown`);
                        break;
                }
            }
        }
    }

    async sendCommand(device, func, command) {
        const ip = device.replace("_", ".");
        const res = await this.ps4Requests(func, `${command} --timeout 2000 --bind-address ${ip}`);
        this.log.debug(typeof res);
        this.log.debug(JSON.stringify(res));
        if (res && res.error) {
            this.log.warn(`Send key response: ${JSON.stringify(res.error)}`);
        } else if (res && res.errorCatch) {
            this.log.warn(`Send key response: ${JSON.stringify(res.errorCatch)}`);
        } else if (res && res.errorExec) {
            this.log.warn(`Send key response: ${JSON.stringify(res.errorExec)}`);
        } else {
            this.log.info(`Send command ${func} - Response OK`);
        }
    }

    setStatus(id, val) {
        if (this.clients[id].online) {
            this.clients[id].online = val;
            let online = false;
            for (const id in this.clients) {
                if (this.clients[id].online) {
                    online = true;
                }
            }
            this.setState("info.connection", { val: online, ack: true });
        }
    }

    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.messagebox" property to be set to true in io-package.json
     *
     * @param obj {ioBroker.Message}
     */
    async onMessage(obj) {
        if (this.double_call[obj._id] != null) {
            return;
        }
        this.double_call[obj._id] = true;
        if (typeof obj === "object" && obj.message) {
            if (obj.command === "textCheck") {
                this.resultMessage = obj;
            } else if (obj.command === "checkPS") {
                this.checkPS(obj);
            } else if (obj.command === "startUDP") {
                this.startUDPServer(obj);
            } else if (obj.command === "credential") {
                ++this.countDelete;
                this.deleteCredential(obj);
            } else if (obj.command === "submitPin") {
                this.loginWithPin(obj);
            } else if (obj.command === "getTV") {
                if (obj && obj.message && obj.message.ps4) {
                    if (Object.keys(obj.message.ps4).length > 0) {
                        const ps4s = [];
                        for (const ps4 of obj.message.ps4) {
                            if (ps4 && typeof ps4.ip === "string" && ps4.ip.length > 9) {
                                const label = ps4.ip;
                                ps4s.push({ label: label, value: ps4.ip });
                            }
                        }
                        if (ps4s.length > 0) {
                            ps4s.sort((a, b) => (a.label > b.label ? 1 : b.label > a.label ? -1 : 0));
                            this.sendTo(obj.from, obj.command, ps4s, obj.callback);
                        } else {
                            this.sendTo(obj.from, obj.command, null, obj.callback);
                        }
                    } else {
                        this.sendTo(obj.from, obj.command, null, obj.callback);
                    }
                } else {
                    this.sendTo(obj.from, obj.command, null, obj.callback);
                }
            }
            this.log.debug(`onMessage: ${JSON.stringify(obj)}`);
        }
        delete this.double_call[obj._id];
    }

    /**
     * @param obj {ioBroker.Message}
     */
    async deleteCredential(obj) {
        if (this.countDelete === 1) {
            this.sendTo(obj.from, obj.command, { result: `Please press the delete button again` }, obj.callback);
            return;
        }
        this.countDelete = 0;
        const credentials = path.join(homedir(), ".config", "playactor-iobroker");
        this.log.debug(credentials);
        if (fs.lstatSync(credentials).isDirectory().toString()) {
            fs.rmSync(credentials, { recursive: true });
            this.sendTo(obj.from, obj.command, { result: `Folder ${credentials} was deleted` }, obj.callback);
        } else {
            this.sendTo(obj.from, obj.command, { error: `Folder ${credentials} was not deleted` }, obj.callback);
        }
    }

    /**
     * @param obj {ioBroker.Message}
     */
    async checkPS(obj) {
        if (obj.message.check) {
            const res = await this.ps4Requests("check", ` --timeout 5000 --ip ${obj.message.check} --machine-friendly`);
            this.log.debug(typeof res);
            this.log.debug(JSON.stringify(res));
            if (res && res.error) {
                this.sendTo(obj.from, obj.command, { error: JSON.stringify(res.error) }, obj.callback);
            } else if (res && res.errorCatch) {
                this.sendTo(obj.from, obj.command, { error: JSON.stringify(res.errorCatch) }, obj.callback);
            } else if (res && res.errorExec) {
                this.sendTo(obj.from, obj.command, { error: JSON.stringify(res.errorExec) }, obj.callback);
            } else {
                if (res.type === "PS4") {
                    this.port = 987;
                } else {
                    this.port = 9302;
                }
                this.deviceData = res;
                const accountId = await this.getStateAsync(`playstation.0.profile.account.accountId`);
                const val = {};
                const new_credential = constants.SecondScreenCredentials;
                if (accountId && accountId.val) {
                    new_credential["user-credential"] = this.userCredential(accountId.val);
                    new_credential["device-discovery-protocol-version"] = this.deviceData.discoveryVersion;
                    val[this.deviceData.id] = new_credential;
                    const dir = path.join(homedir(), ".config");
                    if (!fs.existsSync(dir)) {
                        const dirCreation = await mkdir(dir, { recursive: true });
                        if (dirCreation == null) {
                            this.sendTo(
                                obj.from,
                                obj.command,
                                { error: `Cannot create folder - ${dir}` },
                                obj.callback,
                            );
                            return;
                        }
                    }
                    if (!fs.existsSync(path.join(dir, "/playactor-iobroker"))) {
                        const dirCreation = await mkdir(path.join(dir, "/playactor-iobroker"), { recursive: true });
                        if (dirCreation == null) {
                            this.sendTo(
                                obj.from,
                                obj.command,
                                { error: `Cannot create folder - ${dir}` },
                                obj.callback,
                            );
                            return;
                        }
                    }
                    const credentials = path.join(homedir(), ".config", "playactor-iobroker", "credentials.json");
                    fs.writeFile(credentials, JSON.stringify(val), err => {
                        if (err) {
                            this.sendTo(
                                obj.from,
                                obj.command,
                                { error: `Cannot write device data - ${JSON.stringify(err)}` },
                                obj.callback,
                            );
                        } else {
                            this.sendTo(obj.from, obj.command, { result: `Write successful` }, obj.callback);
                            this.sendTo(
                                obj.from,
                                obj.command,
                                {
                                    result: `1 device found. Please request access data using the PS4 Second-Screen APP.`,
                                },
                                obj.callback,
                            );
                            this.sendTo(
                                this.resultMessage.from,
                                this.resultMessage.command,
                                `1 device found. Please request access data using the PS4 Second-Screen APP.`,
                                this.resultMessage.callback,
                            );
                            let credential = {};
                            try {
                                if (fs.existsSync(`${this.adapterDir}/lib/credentials.json`)) {
                                    const data_credentials = fs.readFileSync(
                                        `${this.adapterDir}/lib/credentials.json`,
                                        "utf-8",
                                    );
                                    if (data_credentials.startsWith("{") && data_credentials.length > 10) {
                                        credential = JSON.parse(data_credentials);
                                    } else {
                                        credential[this.deviceData.address.address] = {};
                                    }
                                } else {
                                    credential[this.deviceData.address.address] = {};
                                }
                            } catch {
                                credential[this.deviceData.address.address] = {};
                            }
                            credential[this.deviceData.address.address] = val;
                            fs.writeFile(`${this.adapterDir}/lib/credentials.json`, JSON.stringify(credential), err => {
                                if (err) {
                                    this.log.info(`Write file error: ${err}`);
                                } else {
                                    this.log.info(
                                        `File written successfully > ${this.adapterDir}/lib/credentials.json`,
                                    );
                                }
                            });
                        }
                    });
                } else {
                    this.sendTo(obj.from, obj.command, { error: `No account ID found` }, obj.callback);
                }
            }
        } else {
            this.sendTo(obj.from, obj.command, { error: "Missing IP" }, obj.callback);
        }
    }

    /**
     * @param obj {ioBroker.Message}
     */
    async loginWithPin(obj) {
        if (obj.message && (obj.message.pair == "" || obj.message.pair == null)) {
            this.sendTo(obj.from, obj.command, { error: "Missing IP" }, obj.callback);
            return;
        }
        if (obj.message && (obj.message.pin == "" || obj.message.pin == null)) {
            this.sendTo(obj.from, obj.command, { error: "Missing PIN" }, obj.callback);
            return;
        }
        if (obj.message.pin.length != 8) {
            this.sendTo(obj.from, obj.command, { error: `Pin must have 8 digits - ${obj.message.pin}` }, obj.callback);
            return;
        }
        const res = await this.ps4Requests(
            "login",
            `--pin-code ${obj.message.pin} --timeout 2000 --ip ${obj.message.pair}`,
        );
        this.log.debug(typeof res);
        this.log.debug(JSON.stringify(res));
        if (res && res.error) {
            this.sendTo(obj.from, obj.command, { error: JSON.stringify(res.error) }, obj.callback);
        } else if (res && res.errorCatch) {
            this.sendTo(obj.from, obj.command, { error: JSON.stringify(res.errorCatch) }, obj.callback);
        } else if (res && res.errorExec) {
            this.sendTo(obj.from, obj.command, { error: JSON.stringify(res.errorExec) }, obj.callback);
        } else {
            this.sendTo(obj.from, obj.command, { result: `Pairing OK! Please save your settings!!!!!` }, obj.callback);
        }
    }

    /**
     * @param command command for playactor
     * @param arg Arguments
     */
    async ps4Requests(command, arg) {
        let ps4_path = `${path.join(__dirname, "..")}/playactor-iobroker/dist/cli/index.js ${command}`;
        if (arg) {
            ps4_path += ` ${arg}`;
        }
        return await exec(ps4_path).then(
            out => {
                this.log.debug(`OUT: ${out.stdout} - ${out.stderr}`);
                try {
                    if (out.stdout) {
                        return JSON.parse(out.stdout);
                    }
                    return out.stdout;
                } catch (e) {
                    this.log.debug(`catch exec: ${JSON.stringify(e)}`);
                    return { errorCatch: e };
                }
            },
            err => {
                if (command === "check") {
                    if (err && err.stdout && err.stdout.toString().length > 1) {
                        try {
                            return JSON.parse(err.stdout);
                        } catch (e) {
                            return { errorExec: err, e: e };
                        }
                    }
                }
                this.log.debug(`requests: ${JSON.stringify(err)}`);
                return { errorExec: err };
            },
        );
    }

    /**
     * Can be deleted
     *
     * @param obj {ioBroker.Message}
     */
    startUDPServer(obj) {
        if (!this.deviceData.type || !this.deviceData.discoveryVersion) {
            this.log.error(`Cannot found device data - ${JSON.stringify(this.deviceData)}`);
            this.sendTo(
                obj.from,
                obj.command,
                { error: `Cannot found device data - ${JSON.stringify(this.deviceData)}` },
                obj.callback,
            );
            return;
        }
        this.server = udp.createSocket("udp4");
        this.server.on("error", error => {
            this.log.warn(`Error: ${error}`);
            this.server && this.server.close();
            this.timeoutUDP && this.clearTimeout(this.timeoutUDP);
            this.timeoutUDP = null;
        });
        this.server.on("message", (msg, info) => {
            this.log.debug(`Data received ko client : ${msg.toString()}`);
            this.log.debug(`Received ${msg.length} bytes from ${info.address}:${info.port}\n`);
            this.messageUDP(msg, info, obj);
        });
        this.server.on("listening", () => {
            if (this.server) {
                const address = this.server.address();
                const port = this.port;
                const family = address.family;
                const ipaddr = address.address;
                this.log.info(`Server is listening at port${port}`);
                this.log.info(`Server ip :${ipaddr}`);
                this.log.info(`Server is IP4/IP6 : ${family}`);
            }
        });
        this.server.on("close", () => {
            this.log.info("Socket is closed !");
            this.timeoutUDP && this.clearTimeout(this.timeoutUDP);
            this.timeoutUDP = null;
        });
        this.server.bind(this.port);
        this.timeoutUDP = this.setTimeout(() => {
            this.server && this.server.close();
            this.timeoutUDP = null;
        }, 60 * 1000);
    }

    /**
     * Can be deleted
     *
     * @param msg string message
     * @param info network data
     * @param obj {ioBroker.Message}
     */
    async messageUDP(msg, info, obj) {
        const lines = msg.toString().split("\n");
        const method = lines[0].substring(0, lines[0].indexOf(" "));
        this.log.debug(`method: ${method}`);
        let result = {};
        result["type"] = "WAKEUP";
        for (let i = 1; i < lines.length; ++i) {
            const line = lines[i];
            this.log.debug(`LINE: ${line}`);
            const [key, value] = line.split(/:[ ]*/);
            if (value) {
                result[key.toLowerCase()] = value;
            }
        }
        this.log.debug(`LINEARRAY: ${lines[0]}`);
        this.log.debug(`RESULT: ${JSON.stringify(result)}`);
        if (method === "WAKEUP") {
            const val = {};
            val[this.deviceData.id] = result;
            const dir = path.join(homedir(), ".config");
            fs.mkdir(path.join(dir, "/playactor-iobroker"), err => {
                if (err) {
                    this.sendTo(
                        obj.from,
                        obj.command,
                        { error: `Cannot create folder - ${JSON.stringify(err)}` },
                        obj.callback,
                    );
                    return;
                }
                const credentials = path.join(homedir(), ".config", "playactor-iobroker", "credentials.json");
                fs.writeFile(credentials, JSON.stringify(val), err => {
                    if (err) {
                        this.sendTo(
                            obj.from,
                            obj.command,
                            { error: `Cannot write device data - ${JSON.stringify(err)}` },
                            obj.callback,
                        );
                    } else {
                        this.sendTo(obj.from, obj.command, { result: `Write successful` }, obj.callback);
                        let credential = {};
                        try {
                            if (fs.existsSync(`${this.adapterDir}/lib/credentials.json`)) {
                                const data_credentials = fs.readFileSync(
                                    `${this.adapterDir}/lib/credentials.json`,
                                    "utf-8",
                                );
                                if (data_credentials.startsWith("{") && data_credentials.length > 10) {
                                    credential = JSON.parse(data_credentials);
                                } else {
                                    credential[this.deviceData.address.address] = {};
                                }
                            } else {
                                credential[this.deviceData.address.address] = {};
                            }
                        } catch {
                            credential[this.deviceData.address.address] = {};
                        }
                        credential[this.deviceData.address.address] = val;
                        fs.writeFile(`${this.adapterDir}/lib/credentials.json`, JSON.stringify(credential), err => {
                            if (err) {
                                this.log.info(`Write file error: ${err}`);
                            } else {
                                this.log.info(`File written successfully > ${this.adapterDir}/lib/credentials.json`);
                            }
                        });
                    }
                });
            });
        }
        const command = `HTTP/1.1 620 Server Standby * HTTP/1.1\nhost-id:1234567890AB\nhost-name:playactor-iobroker\nhost-request-port:987\nhost-type:${this.deviceData.type}\ndevice-discovery-protocol-version:${this.deviceData.discoveryVersion}`;
        if (this.server) {
            this.server.send(command, info.port, info.address, error => {
                if (error) {
                    this.log.info(`Data sent ${error}!!!`);
                    this.server && this.server.close();
                } else {
                    this.log.info("Data sent !!!");
                }
            });
        }
    }

    /**
     * @param {string} id
     * @param {object} [value=null]
     */
    async setAckFlag(id, value) {
        try {
            if (id) {
                await this.setState(id, {
                    ack: true,
                    ...value,
                });
            }
        } catch (e) {
            this.log.error(`setAckFlag: ${e}`);
        }
    }

    /**
     * Credential for the palystation
     *
     * @param accountId PSN accountId
     */
    userCredential(accountId) {
        return createHash("sha256").update(accountId).digest("hex");
    }

    /**
     * @param code npId
     */
    npIdDecode(code) {
        return Buffer.from(code, "base64").toString("utf8");
    }

    /**
     * @param request url request
     */
    async status(request) {
        const check_time = Date.now() - status.timestamp;
        status.request = request;
        status.lastRequest = new Date();
        if (check_time < status.periode && status.countRequest > status.maxRequest) {
            this.setCounterStatus();
            return false;
        }
        if (check_time > status.periode) {
            status.timestamp = Date.now();
            status.timeISO = new Date();
            status.countRequest = 1;
            this.setCounterStatus();
            return true;
        }
        ++status.countRequest;
        this.setCounterStatus();
        return true;
    }

    /**
     * Save status JSON
     */
    async setCounterStatus() {
        await this.setState("status", { val: JSON.stringify(status), ack: true });
    }

    async getParameter() {
        const parameter = await this.getStateAsync(`profile_remote_store.param`);
        if (!parameter || !parameter.val) {
            return {
                pageArgs: { size: 24, offset: 0 },
                sortBy: null,
                filterBy: [],
                facetOptions: [],
            };
        }
        return typeof parameter.val === "string" ? JSON.parse(parameter.val) : parameter.val;
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = options => new Playstation(options);
} else {
    // otherwise start the instance directly
    new Playstation();
}
