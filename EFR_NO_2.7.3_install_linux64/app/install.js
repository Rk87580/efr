const path = require('path'), fs = require('fs')
const { execSync } = require('child_process')

const { ValidArgConfigList, LibraryConfig, ServiceConfig } = require('./install.json')

const HelpArgs = ['--help', '-h', '/?']
const ValidArgs = [...ValidArgConfigList, ...HelpArgs]

const args = {
    service: {
        install: false,
        user: 'efr',
        path: 'run.sh',
        manual: false,
    }
}

const rootPath = path.resolve(path.join(__dirname, '..'))

const {
    ServiceSystem,
    ServiceControlCommand,
    ServiceSystemDir,
    ServiceFile,
    ServiceExec,
    ServiceDefaultUser,
    ServiceReplacerList,
} = ServiceConfig

const ServiceDefaultPath = ServiceExec || path.join(rootPath, 'run.sh')

args.service.user = ServiceDefaultUser
args.service.path = verifyServiceExecValue(ServiceDefaultPath)

install()

/**
 * Main function.
 */
function install() {
    checkArguments()

    // Service installation
    if (args.service.install) {
        installService()
        return exit()
    }

    // Library processing
    try {
        // do required installs
        if (LibraryConfig.LibUDev) installLibudev()
    } catch(ex) { return exit(ex, 1) }

    exit('Successfully finished!')
}

/**
 * Updates the default service file to include correct data.
 * @param {string} fileContent service file content
 * @returns {string} updated fileContent
 */
function updateServiceFileValues(fileContent) {
    if (typeof fileContent !== 'string') throw new TypeError('fileContent must be string')
    if (Array.isArray(ServiceReplacerList) && ServiceReplacerList.length > 0) { // install.json replace infos
        for (let { searchRegex, regexFlags, replaceValue } of ServiceReplacerList) {
            replaceValue = replaceValue || ''
            if (searchRegex) {
                let regex = new RegExp(searchRegex, regexFlags || undefined)
                fileContent = fileContent.replace(regex, replaceValue)
            } else console.error('Error: Missing install config `searchRegex`')
        }
    } else if (ServiceSystem === 'systemd') { // compatibility missing install.json debian
        if (args.service.user) fileContent = fileContent.replace(/^(\s*)User=.*\s*$/m, '$1User=' + args.service.user)
        if (args.service.path) fileContent = fileContent.replace(/^(\s*)ExecStart=.*\s*$/m, '$1ExecStart=/bin/bash ' + args.service.path)
    }
    return fileContent
}

/**
 * Installs EFR as system service.
 */
function installService() {
    // check arguments
    if (!args.service.user) {
        let currentUser = getOsUsername()
        console.log('Current user:', currentUser || '<N/A>')
        return exit(`service-user required: e.g. --service-user="${ServiceDefaultUser}"`, 1, true)
    }
    if (!args.service.path) {
        return exit(`service-path required: e.g. --service-path="${ServiceDefaultPath}"`, 1, true)
    }

    // process service file
    let targetFilepath = path.join(ServiceSystemDir, ServiceFile)
    try {
        let fileContent = fs.readFileSync(path.join(rootPath, ServiceFile)).toString('utf8')
        fileContent = updateServiceFileValues(fileContent)
        fileContent = replacePlaceholder(fileContent)

        if (args.service.manual) throw 'Manual installation required'
        if (!fs.statSync(ServiceSystemDir).isDirectory()) throw 'Not a directory: ' + ServiceSystemDir
    
        // save service file to system directory
        fs.writeFileSync(targetFilepath, fileContent)

        console.log(`Service file successfully installed to ${targetFilepath}`)
        if (ServiceControlCommand) {
            console.log('Control service with:')
            console.log('    \`' + ServiceControlCommand + '\`')
        }

        // reload, start and enable the service
        startService({ targetFilepath })
    } catch(ex) {
        if (ex.code === 'EPERM' || ex.code === 'EACCES') console.error(`Error: Insufficient permissions in '${ServiceSystemDir}', try running \`sudo ./install.sh\` or use \`--service-manual\``)
        console.log('Service NOT installed:', ex)
        if (args.service.manual) {
            console.log(`Service file content '${targetFilepath}' for manual use:`)
            process.stdout.write('\n')
            console.log(fileContent)
            process.stdout.write('\n')
        }
    }
}

/**
 * Starts the service and by default also reloads service config and enables the service.
 * @param {({ targetFilepath: string|undefined, enable: boolean, reload: boolean })} options start options
 * @returns {boolean} success
 */
function startService({ targetFilepath, enable, reload } = {}) {
    let success = false
    enable = (enable === undefined ? true : !!enable)
    reload = (reload === undefined ? true : !!reload)
    try {
        if (ServiceSystem === 'systemd') {
            let serviceName = ServiceFile.replace(/\.service$/, '')
            try {
                execAndLogSync(`systemctl stop ${serviceName}`, { stdio: 'ignore' })
            } catch(ex) {}
            
            if (reload) {
                execAndLogSync('systemctl daemon-reload', { stdio: 'inherit' })
            }
            
            execAndLogSync(`systemctl start ${serviceName}`, { stdio: 'inherit' })
            
            if (enable) {
                execAndLogSync(`systemctl enable ${serviceName}`, { stdio: 'inherit' })
            }
        } else if (ServiceSystem === 'launchd') {
            if (!targetFilepath || typeof targetFilepath !== 'string') throw new TypeError('startService: targetFilepath required')
            let serviceName = ServiceFile.replace(/\.plist$/, '')
            try {
                if (reload) {
                    execAndLogSync(`launchctl unload -w ${targetFilepath}`, { stdio: 'ignore' })
                } else {
                    execAndLogSync(`launchctl stop system/${serviceName}`, { stdio: 'ignore' })
                }
            } catch(ex) {}
            
            if (reload) {
                execAndLogSync(`launchctl load -w ${targetFilepath}`, { stdio: 'inherit' })
            } else {
                execAndLogSync(`launchctl start system/${serviceName}`, { stdio: 'inherit' })
            }
            
            if (enable) {
                execAndLogSync(`launchctl enable system/${serviceName}`, { stdio: 'inherit' })
            }
        }
        success = true
    } catch(ex) {
        console.error('Error: Starting service:', ex)
    }
    return success
}

/**
 * Checks `/lib` for libudev libraries and creates a symlink if necessary (only for linux32).
 */
function installLibudev() {
    const lnCmd = 'ln -sf {LIBFILE} {SYMFILE}'
    console.log('searching for libudev.so.0')
    let files = execSync('find /lib -name "libudev.so*"').toString('utf8')
    if (!files) throw 'No libudev.so found'
    files = files.split('\n').map(f => f.trim())
    
    if (hasLibudev0(files)) return console.log('libudev.so.0 found')

    console.log('No libudev.so.0 found, other candidates:')
    console.log(files.join('\n'))

    // filter and sort candidates
    files = files.filter(f => /\blibudev\.so\.[01](\.\d+)*$/.test(f)).map(f => { return { name: path.basename(f), path: f } })
    files.sort((a, b) => a.name < b.name ? -1 : 1)
    if (!files.length) throw 'No candidate found'

    console.log('installing', files[0].path)
    let symFile = path.join(path.dirname(files[0].path), 'libudev.so.0')
    let cmd = lnCmd.replace('{LIBFILE}', files[0].path).replace('{SYMFILE}', symFile)
    let cmdStdout = execSync(cmd).toString('utf8')
    console.log(cmdStdout)

    console.log('installed', symFile)
}

function hasLibudev0(arr) {
    let file = arr.filter(f => /\blibudev\.so\.0$/.test(f))[0]
    if (file) {
        console.log('libudev found:', file)
        return file
    }
    return false
}

/**
 * Logs and executes the given command
 * @param {string} cmd command
 * @param {import('child_process').ExecSyncOptionsWithBufferEncoding} [options] execSync options
 * @returns {Buffer}
 */
function execAndLogSync(cmd, options) {
    if (!cmd) return Buffer.alloc(0)
    console.log('Executing:', cmd)
    return execSync(cmd, options)
}

/**
 * Process command line arguments.
 */
function checkArguments() {
    // check invalid args
    let argv = process.argv.map(arg => arg.trim())
    let argStartI = argv.findIndex(arg => /install(\.js)?$/i.test(arg))
    if (argStartI >= 0) {
        argv = argv.slice(argStartI + 1)
    }
    let invalidArgs = argv.filter(arg => {
        return ValidArgs.find(validArg => arg.startsWith(validArg)) ? false : true
    })
    if (invalidArgs.length > 0) {
        return exit(`Error: Invalid arguments: ${invalidArgs.join(', ')}`, 1, true)
    }

    // check help arg
    let helpArgRegex = new RegExp(`^(${HelpArgs.join('|')})`.replace(/(\/|\?)/g, '\\$1'), 'm')
    if (helpArgRegex.test(argv.join('\n'))) {
        printHelp()
        return exit()
    }

    // process args
    argv.forEach(arg => {
        if (arg === '--service') args.service.install = true
        if (arg === '--service-manual') args.service.manual = true
        if (arg.startsWith('--service-user=')) args.service.user = arg.replace('--service-user=', '')
        if (arg.startsWith('--service-path=')) args.service.path = verifyServiceExecValue(arg.replace('--service-path=', ''))
    })
}

/**
 * Verifies and resolves the give path. 
 * @param {string} value ServiceExec file path
 * @returns {string} resolved path
 */
function verifyServiceExecValue(value) {
    let resolvedValue = ''
    try {
        if (!value || typeof value !== 'string') throw 'Error: service-path is empty or invalid: ' + (typeof value)
        resolvedValue = path.resolve(replacePlaceholder(value))
        if (!fs.existsSync(resolvedValue)) throw `Error: ${resolvedValue} does not exist.`
        if (!fs.statSync(resolvedValue).isFile()) throw `Error: ${resolvedValue} is not a file.`
    } catch(ex) {
        if (ex.code === 'EPERM' || ex.code === 'EACCES') console.error(`Error: Insufficient permissions for '${resolvedValue}'`)
        console.error(ex)
    }
    return resolvedValue
}

/**
 * Tries to get the current OS username.
 * @returns {string}
 */
function getOsUsername() {
    const { env } = process
    // environment vars
    let username = (
        env.SUDO_USER
        || env.C9_USER // Cloud9
        || env.LOGNAME
        || env.USER
        || env.LNAME
        || env.USERNAME
    )
    if (!username) {
        // os.userInfo()
        try { username = require('os').userInfo().username }
        catch(ex) { console.error('Error: fetching userInfo:', ex) }
    }
    if (!username) {
        // `id` command
        try {
            const userId = execSync('id -u').toString()
            username = execSync(`id -un ${userId}`).toString()
        } catch(ex) { console.error('Error: fetching username:', ex) }
    }
    return username || ''
}

function printHelp() {
    process.stdout.write('\n')
    console.log('Help:')
    console.log('./install.sh [--service] [--service-user=USER]')
    console.log('Arguments:')
    console.log(`  --service                only install ${ServiceSystem} service`)
    console.log(`  --service-user="USER"    start service as 'USER'`)
    console.log(`                               default: '${ServiceDefaultUser}'`)
    console.log(`  --service-path="PATH"    (optional) path to 'run.sh' file`)
    console.log(`                               default: '${ServiceDefaultPath}'`)
    console.log(`  --service-manual         (optional) only generate service file content on stdout`)
    process.stdout.write('\n')
}

/**
 * Replaces all %EFR-...% placeholders in a string.
 * @param {string} value 
 * @returns {string}
 */
function replacePlaceholder(value) {
    if (!value || typeof value !== 'string') return ''
    const replaceMap = {
        '%EFR-INSTALL-ROOT-PATH%': rootPath,
        '%EFR-SERVICE-USER%': args.service.user,
        '%EFR-SERVICE-PATH%': args.service.path,
        '%EFR-SERVICE-DIR%': path.dirname(args.service.path || ''),
    }

    return value.replace(/%EFR(-[A-Z]+)+%/g, (subvalue) => replaceMap[subvalue] || '')
}

/**
 * Exit process.
 * @param {string|Error} [msg] log/error message to echo before exiting
 * @param {number} [code=0] process return code
 * @param {boolean} [needHelpInfo=false] process return code
 */
function exit(msg, code, needHelpInfo) {
    if (code === undefined && typeof msg === 'number') {
        code = msg
        msg = null
    }
    if (msg && code) console.error(msg + '\n')
    else if (msg) console.log(msg + '\n')
    if (needHelpInfo) printHelp()
    process.exit(code)
}
