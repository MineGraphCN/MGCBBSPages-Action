import core from "@actions/core";
import {HttpClient} from "@actions/http-client";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import archiver from "archiver";

async function main() {
    const server = core.getInput("server", {required: true})
    const appId = core.getInput("app-id", {required: true})
    const appKey = core.getInput("app-secret", {required: true})

    let target = core.getInput("target", {required: true})

    let stat = await fs.promises.stat(target)
    if (stat.isDirectory()) {
        target = await zipFolder(target)
        stat = await fs.promises.stat(target)
    }

    if (!stat.isFile()) throw new Error("目标文件不是文件！")
    await upload(server, appId, appKey, target)
}

async function zipFolder(dir: string) {
    const zipFile = dir + ".zip"
    const output = fs.createWriteStream(zipFile)

    const archive = archiver('zip', {zlib: {level: 9}})

    archive.on('error', err => {
        throw err
    })
    archive.pipe(output)

    archive.directory(dir, false)

    await archive.finalize()
    return zipFile
}

async function upload(server: string, app: string, key: string, target: string) {
    const hash = await sha2File(target)
    const time = Date.now()

    const sign = sha2Text(`${app}${hash}${time}${key}`)

    const http = new HttpClient('MgcPagesGithubAction/0.0.0')
    const response = await http.sendStream(
        'POST',
        server,
        fs.createReadStream(target), {
            app,
            hash,
            time,
            sign
        })

    if (response.message.statusCode !== 200) new Error("上传失败！错误码：" + response.message.statusCode + "，错误信息：" + await response.readBody())
    const body = JSON.parse(await response.readBody())
    if (!body.isSuccess) throw new Error(`上传失败！请求ID: ${body.requestId}, 错误信息: ${body.message}`)
    console.log(body)
}

function sha2File(file: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const sha2 = crypto.createHash('sha256')
        const stream = fs.createReadStream(file)
        stream.on('data', it => sha2.update(it))
        stream.on('end', () => resolve(sha2.digest('hex')))
        stream.on('error', reject)
    })
}

function sha2Text(text: string) {
    return crypto.createHash('sha256').update(text).digest('hex')
}

main().catch(e => core.setFailed(e.message))
