"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importDefault(require("@actions/core"));
const http_client_1 = require("@actions/http-client");
const fs = __importStar(require("node:fs"));
const crypto = __importStar(require("node:crypto"));
const archiver_1 = __importDefault(require("archiver"));
async function main() {
    // const appId = core.getInput("app-id", {required: true})
    // const appKey = core.getInput("app-secret", {required: true})
    //
    // let target = core.getInput("target", {required: true})
    const appId = "5436e46aae8111efb8fea983e8cc21a9";
    const appKey = "d21c350252b77a515385b21bf5c54c8b07b2d5115c35feb74cd9c6b15b1e8b7b";
    let target = "test_deploy/dist.zip";
    let stat = await fs.promises.stat(target);
    if (stat.isDirectory()) {
        target = await zipFolder(target);
        stat = await fs.promises.stat(target);
    }
    if (!stat.isFile())
        throw new Error("目标文件不是文件！");
    await upload(appId, appKey, target);
}
async function zipFolder(dir) {
    const zipFile = dir + ".zip";
    const output = fs.createWriteStream(zipFile);
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
    archive.on('error', err => {
        throw err;
    });
    archive.pipe(output);
    archive.directory(dir, false);
    await archive.finalize();
    return zipFile;
}
async function upload(app, key, target) {
    const hash = await sha2File(target);
    const time = Date.now();
    const sign = sha2Text(`${app}${hash}${time}${key}`);
    const http = new http_client_1.HttpClient('MgcPagesGithubAction/0.0.0');
    const response = await http.sendStream('POST', 'http://control.minegraph.cn/deploy', fs.createReadStream(target), {
        app,
        hash,
        time,
        sign
    });
    if (response.message.statusCode !== 200)
        new Error("上传失败！错误码：" + response.message.statusCode + "，错误信息：" + await response.readBody());
    const body = JSON.parse(await response.readBody());
    if (!body.isSuccess)
        throw new Error(`上传失败！请求ID: ${body.requestId}, 错误信息: ${body.message}`);
    console.log(body);
}
function sha2File(file) {
    return new Promise((resolve, reject) => {
        const sha2 = crypto.createHash('sha256');
        const stream = fs.createReadStream(file);
        stream.on('data', it => sha2.update(it));
        stream.on('end', () => resolve(sha2.digest('hex')));
        stream.on('error', reject);
    });
}
function sha2Text(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}
main().catch(e => core_1.default.setFailed(e.message));
