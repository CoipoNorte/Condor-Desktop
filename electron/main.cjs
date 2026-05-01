const { app, BrowserWindow, ipcMain, dialog, clipboard, shell, Tray, Menu } = require("electron")
const path = require("path")
const fs = require("fs")
const { spawn, exec } = require("child_process")

let win = null
let tray = null
let proc = null
let projectPath = null
let backups = []

const defaultConfig = {
  buttons: {
    scan: { label: "", color: "#6366f1", visible: true },
    run: { label: "Run", color: "#10b981", visible: true },
    clean: { label: "Clean", color: "#f59e0b", visible: true },
    undo: { label: "Undo", color: "#f97316", visible: true },
    paste: { label: "Paste", color: "#8b5cf6", visible: true },
    cmd: { label: "CMD", color: "#0ea5e9", visible: true },
    prompt: { label: "Prompt", color: "#d946ef", visible: true },
    mini: { label: "", color: "#14b8a6", visible: true },
  },
  buttonOrder: ["scan", "run", "clean", "undo", "paste", "cmd", "prompt", "mini"],
  checkboxes: { autoRun: false, dryRun: false, backup: true, cmdSep: true },
}

const defaultIgnore = {
  ignored_folders: ["node_modules", ".git", "dist", "build", ".next", "__pycache__", "venv", ".vscode", ".idea", "logs", ".env"],
  ignored_files: [".DS_Store", "Thumbs.db", "desktop.ini", ".gitkeep"],
  ignored_extensions: [".pyc", ".pyo", ".exe", ".dll", ".so", ".o", ".class"],
  image_extensions: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico"],
  exceptions: { folders: [], files: [], extensions: [] },
  max_depth: -1,
  show_hidden_files: false,
  log_format: "log_{date}_{root}.txt",
}

function cfgPath() { return path.join(app.getPath("userData"), "condor-config.json") }
function ignPath() { return path.join(app.getPath("userData"), "condor-ignore.json") }

function loadJSON(p, def) {
  try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8")) } catch {}
  return JSON.parse(JSON.stringify(def))
}
function saveJSON(p, data) {
  try { fs.writeFileSync(p, JSON.stringify(data, null, 2)) } catch {}
}

function buildTree(dir, ign, depth) {
  depth = depth || 0
  if (ign.max_depth !== -1 && depth > ign.max_depth) return []
  var res = []
  try {
    var entries = fs.readdirSync(dir, { withFileTypes: true }).sort(function(a, b) {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i]
      if (!ign.show_hidden_files && e.name.startsWith(".") &&
          ign.exceptions.files.indexOf(e.name) === -1 &&
          ign.exceptions.folders.indexOf(e.name) === -1) continue
      var full = path.join(dir, e.name)
      var rel = path.relative(projectPath, full)
      if (e.isDirectory()) {
        if (ign.ignored_folders.indexOf(e.name) !== -1 && ign.exceptions.folders.indexOf(e.name) === -1) continue
        res.push({ name: e.name, path: rel, fullPath: full, type: "directory", children: buildTree(full, ign, depth + 1) })
      } else {
        if (ign.ignored_files.indexOf(e.name) !== -1 && ign.exceptions.files.indexOf(e.name) === -1) continue
        var ext = path.extname(e.name).toLowerCase()
        if (ign.ignored_extensions.indexOf(ext) !== -1 && ign.exceptions.extensions.indexOf(ext) === -1) continue
        res.push({ name: e.name, path: rel, fullPath: full, type: "file", extension: ext, isImage: ign.image_extensions.indexOf(ext) !== -1 })
      }
    }
  } catch (err) {}
  return res
}

function treeStr(dir, ign, prefix, depth) {
  prefix = prefix || ""
  depth = depth || 0
  if (ign.max_depth !== -1 && depth > ign.max_depth) return ""
  var r = ""
  try {
    var entries = fs.readdirSync(dir, { withFileTypes: true }).filter(function(e) {
      if (!ign.show_hidden_files && e.name.startsWith(".")) return false
      if (e.isDirectory()) return ign.ignored_folders.indexOf(e.name) === -1 || ign.exceptions.folders.indexOf(e.name) !== -1
      if (ign.ignored_files.indexOf(e.name) !== -1) return false
      var ext = path.extname(e.name).toLowerCase()
      return ign.ignored_extensions.indexOf(ext) === -1
    }).sort(function(a, b) {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })
    entries.forEach(function(e, i) {
      var last = i === entries.length - 1
      r += prefix + (last ? "└── " : "├── ") + e.name + "\n"
      if (e.isDirectory()) r += treeStr(path.join(dir, e.name), ign, prefix + (last ? "    " : "│   "), depth + 1)
    })
  } catch (err) {}
  return r
}

function parseCondor(text) {
  var insts = []
  var lines = text.split("\n")
  var i = 0
  while (i < lines.length) {
    var m = lines[i].trim().match(/^ETIQUETA\[([^,]*),([^,]*),([^,]*),([^\]]*)\]$/)
    if (m) {
      var ub = m[1], nm = m[2], ext = m[3], ac = m[4]
      var content = "", collecting = false, started = false
      i++
      while (i < lines.length) {
        var cl = lines[i].trim()
        if (cl === "INICIO_BLOQUE") { started = true; i++; continue }
        if (cl === "FIN_BLOQUE") { i++; break }
        if (started) {
          if (cl.startsWith("```") && !collecting) { collecting = true; i++; continue }
          if (cl.startsWith("```") && collecting) { collecting = false; i++; continue }
          if (collecting) content += (content ? "\n" : "") + lines[i]
        }
        i++
      }
      insts.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        ubicacion: ub.trim(), nombre: nm.trim(), extension: ext.trim(),
        accion: ac.trim().toUpperCase(), content: content, status: "pending", enabled: true,
      })
      continue
    }
    i++
  }
  return insts
}

function instToCmd(inst) {
  if (!projectPath) return null
  var loc = inst.ubicacion === "." ? projectPath : path.join(projectPath, inst.ubicacion)
  var fn = inst.nombre === "nan" ? "" : inst.nombre + (inst.extension ? "." + inst.extension : "")
  var fp = fn ? path.join(loc, fn) : loc
  switch (inst.accion) {
    case "EJECUTAR": return { type: "exec", command: inst.content, cwd: projectPath }
    case "EJECUTAR_EXTERNO": return { type: "exec-external", command: inst.content, cwd: projectPath }
    case "CREAR": case "MODIFICAR": return { type: "write", filePath: fp, content: inst.content, dir: loc }
    case "ELIMINAR": return { type: "delete", filePath: fp }
    case "REEMPLAZAR":
      var p = inst.content.split("\n>>>\n")
      return p.length === 2
        ? { type: "replace", filePath: fp, search: p[0], replacement: p[1] }
        : { type: "replace", filePath: fp, error: "Bad REEMPLAZAR format" }
    default: return null
  }
}

function doBackup(fp) {
  try {
    if (fs.existsSync(fp)) backups.push({ fp: fp, content: fs.readFileSync(fp, "utf-8"), existed: true })
    else backups.push({ fp: fp, content: null, existed: false })
  } catch (e) {}
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  var entries = fs.readdirSync(src, { withFileTypes: true })
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i]
    var srcPath = path.join(src, e.name)
    var destPath = path.join(dest, e.name)
    if (e.isDirectory()) copyDirSync(srcPath, destPath)
    else fs.copyFileSync(srcPath, destPath)
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 720, minWidth: 800, minHeight: 550,
        frame: false, backgroundColor: "#0a0a0c",
    icon: path.join(__dirname, "..", "public", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  if (process.env.NODE_ENV === "development") win.loadURL("http://localhost:5173")
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"))

      win.webContents.on("will-navigate", function(e) { e.preventDefault() })

  // Handle external drops: intercept at protocol level
  var { session } = require("electron")
  win.webContents.on("did-finish-load", function() {
    // Use IPC to handle drops since file.path doesn't work with sandbox
    win.webContents.on("ipc-message", function(event, channel) {
      // fallback channel if needed
    })
  })
}

app.whenReady().then(createWindow)
app.on("window-all-closed", function() {
  // Don't quit when window is closed - stay in tray
})

ipcMain.handle("window:minimize", function() { win.minimize() })
ipcMain.handle("window:minimizeToTray", function() {
  // Create tray icon only when minimizing
  if (!tray) {
    var iconPath = path.join(__dirname, "..", "public", "icon.ico")
    if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, "..", "public", "icon.png")
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath)
      tray.setToolTip("CONDOR")
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: "Show CONDOR", click: function() { win.show(); win.focus(); if (tray) { tray.destroy(); tray = null } } },
        { type: "separator" },
        { label: "Quit", click: function() { app.quit() } },
      ]))
      tray.on("click", function() { win.show(); win.focus(); if (tray) { tray.destroy(); tray = null } })
    }
  }
  win.hide()
})
ipcMain.handle("window:maximize", function() { if (win.isMaximized()) win.unmaximize(); else win.maximize() })
ipcMain.handle("window:close", function() { app.quit() })
ipcMain.handle("window:isMaximized", function() { return win.isMaximized() })

ipcMain.handle("dialog:openFolder", async function() {
  var r = await dialog.showOpenDialog(win, { properties: ["openDirectory"] })
  if (!r.canceled && r.filePaths[0]) { projectPath = r.filePaths[0]; return projectPath }
  return null
})

ipcMain.handle("dialog:openFile", async function(_, filters) {
  var r = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: filters || [
      { name: "Markdown", extensions: ["md", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  })
  if (!r.canceled && r.filePaths[0]) {
    try {
      var content = fs.readFileSync(r.filePaths[0], "utf-8")
      return { path: r.filePaths[0], content: content }
    } catch(e) { return null }
  }
  return null
})

ipcMain.handle("project:setPath", function(_, p) { projectPath = p; return true })
ipcMain.handle("project:getPath", function() { return projectPath })
ipcMain.handle("project:getFileTree", function() {
  if (!projectPath) return []
  return buildTree(projectPath, loadJSON(ignPath(), defaultIgnore))
})
ipcMain.handle("project:copyTreeString", function() {
  if (!projectPath) return ""
  var ign = loadJSON(ignPath(), defaultIgnore)
  var t = path.basename(projectPath) + "/\n" + treeStr(projectPath, ign)
  clipboard.writeText(t)
  return t
})

var watcher = null
ipcMain.handle("project:watchStart", function() {
  if (!projectPath) return false
  if (watcher) clearInterval(watcher)
  watcher = setInterval(function() {
    if (win && !win.isDestroyed()) win.webContents.send("project:fileChanged")
  }, 3000)
  return true
})
ipcMain.handle("project:watchStop", function() {
  if (watcher) { clearInterval(watcher); watcher = null }
  return true
})

ipcMain.handle("project:createFile", function(_, dir, name) {
  try { fs.writeFileSync(path.join(dir, name), ""); return { success: true } }
  catch (e) { return { success: false, message: e.message } }
})
ipcMain.handle("project:createFolder", function(_, dir, name) {
  try { fs.mkdirSync(path.join(dir, name), { recursive: true }); return { success: true } }
  catch (e) { return { success: false, message: e.message } }
})

ipcMain.handle("file:move", function(_, srcPath, destDir) {
  try {
    var fileName = path.basename(srcPath)
    var destPath = path.join(destDir, fileName)
    if (srcPath === destPath) return { success: false, message: "Same location" }
    if (fs.existsSync(destPath)) return { success: false, message: "Already exists: " + fileName }
    fs.renameSync(srcPath, destPath)
    return { success: true }
  } catch (e) { return { success: false, message: e.message } }
})

var copiedFilePath = null
ipcMain.handle("file:copy", function(_, srcPath) {
  copiedFilePath = srcPath
  return { success: true }
})

ipcMain.handle("file:paste", function(_, destDir) {
  if (!copiedFilePath) return { success: false, message: "Nothing copied" }
  try {
    var fileName = path.basename(copiedFilePath)
    var destPath = path.join(destDir, fileName)
    var ext = path.extname(fileName)
    var base = path.basename(fileName, ext)
    var count = 0
    while (fs.existsSync(destPath)) {
      count++
      destPath = path.join(destDir, base + " (" + count + ")" + ext)
    }
    var stat = fs.statSync(copiedFilePath)
    if (stat.isDirectory()) {
      copyDirSync(copiedFilePath, destPath)
    } else {
      fs.copyFileSync(copiedFilePath, destPath)
    }
    return { success: true }
  } catch (e) { return { success: false, message: e.message } }
})

ipcMain.handle("clipboard:read", function() { return clipboard.readText() })
ipcMain.handle("condor:parse", function(_, text) { return parseCondor(text) })

ipcMain.handle("condor:execute", function(_, inst, opts) {
  var cmd = instToCmd(inst)
  if (!cmd) return { success: false, message: "Invalid instruction" }
  if (opts.dryRun) return { success: true, message: "[DRY] " + JSON.stringify(cmd) }
  switch (cmd.type) {
    case "exec":
      return new Promise(function(resolve) {
        var p = spawn("cmd.exe", ["/c", cmd.command], { cwd: cmd.cwd, shell: true })
        var out = ""
        p.stdout.on("data", function(d) { out += d; win.webContents.send("terminal:data", d.toString()) })
        p.stderr.on("data", function(d) { out += d; win.webContents.send("terminal:data", d.toString()) })
        p.on("close", function(code) { resolve({ success: code === 0, message: out, exitCode: code }) })
        p.on("error", function(e) { resolve({ success: false, message: e.message }) })
        proc = p
      })
    case "exec-external":
      return new Promise(function(resolve) {
        var p = spawn("cmd.exe", ["/c", "start", "cmd.exe", "/k", cmd.command], { cwd: cmd.cwd, shell: true })
        p.on("close", function() { resolve({ success: true, message: "Opened in external CMD" }) })
        p.on("error", function(e) { resolve({ success: false, message: e.message }) })
      })
    case "write":
      try {
        if (opts.backup) doBackup(cmd.filePath)
        if (!fs.existsSync(cmd.dir)) fs.mkdirSync(cmd.dir, { recursive: true })
        fs.writeFileSync(cmd.filePath, cmd.content, "utf-8")
        win.webContents.send("terminal:data", "✓ Written: " + cmd.filePath + "\r\n")
        return { success: true, message: "Written: " + cmd.filePath }
      } catch (e) { return { success: false, message: e.message } }
    case "delete":
      try {
        if (opts.backup) doBackup(cmd.filePath)
        if (fs.existsSync(cmd.filePath)) {
          fs.unlinkSync(cmd.filePath)
          win.webContents.send("terminal:data", "✓ Deleted: " + cmd.filePath + "\r\n")
          return { success: true, message: "Deleted" }
        }
        return { success: false, message: "File not found" }
      } catch (e) { return { success: false, message: e.message } }
    case "replace":
      try {
        if (cmd.error) return { success: false, message: cmd.error }
        if (opts.backup) doBackup(cmd.filePath)
        if (!fs.existsSync(cmd.filePath)) return { success: false, message: "File not found" }
        var fc = fs.readFileSync(cmd.filePath, "utf-8")
        if (fc.indexOf(cmd.search) === -1) return { success: false, message: "Search text not found" }
        fc = fc.replace(cmd.search, cmd.replacement)
        fs.writeFileSync(cmd.filePath, fc, "utf-8")
        win.webContents.send("terminal:data", "✓ Replaced in: " + cmd.filePath + "\r\n")
        return { success: true, message: "Replaced" }
      } catch (e) { return { success: false, message: e.message } }
    default: return { success: false, message: "Unknown type" }
  }
})

ipcMain.handle("condor:stop", function() { if (proc) { proc.kill(); proc = null }; return { success: true } })
ipcMain.handle("condor:undo", function() {
  if (!backups.length) return { success: false, message: "No backups" }
  var b = backups.pop()
  try {
    if (b.existed) fs.writeFileSync(b.fp, b.content)
    else if (fs.existsSync(b.fp)) fs.unlinkSync(b.fp)
    return { success: true, message: "Restored: " + b.fp }
  } catch (e) { return { success: false, message: e.message } }
})

ipcMain.handle("config:load", function() { return loadJSON(cfgPath(), defaultConfig) })
ipcMain.handle("config:save", function(_, c) { saveJSON(cfgPath(), c); return true })
ipcMain.handle("config:loadIgnore", function() { return loadJSON(ignPath(), defaultIgnore) })
ipcMain.handle("config:saveIgnore", function(_, c) { saveJSON(ignPath(), c); return true })

ipcMain.handle("terminal:spawn", function() {
  if (proc) { try { process.kill(proc.pid) } catch(e) {} }
  proc = null
  var cwd = projectPath || process.env.USERPROFILE || "C:\\"
  proc = spawn("powershell.exe", ["-NoLogo", "-NoProfile"], { cwd: cwd })
  proc.stdout.on("data", function(d) {
    if (win && !win.isDestroyed()) win.webContents.send("terminal:data", d.toString())
  })
  proc.stderr.on("data", function(d) {
    if (win && !win.isDestroyed()) win.webContents.send("terminal:data", d.toString())
  })
  proc.on("close", function(code) {
    proc = null
    if (win && !win.isDestroyed()) win.webContents.send("terminal:closed")
  })
  proc.on("error", function(e) {
    proc = null
    if (win && !win.isDestroyed()) win.webContents.send("terminal:data", "Error: " + e.message + "\r\n")
  })
  return true
})
ipcMain.handle("terminal:write", function(_, d) {
  if (proc && proc.stdin && !proc.stdin.destroyed) {
    try { proc.stdin.write(d); return true } catch(e) { return false }
  }
  return false
})
ipcMain.handle("terminal:kill", function() {
  if (proc) {
    try {
      // Kill the process tree on Windows
      spawn("taskkill", ["/pid", proc.pid.toString(), "/f", "/t"], { windowsHide: true })
    } catch(e) {
      try { proc.kill("SIGKILL") } catch(e2) {}
    }
    proc = null
  }
  return true
})
ipcMain.handle("terminal:sendCtrlC", function() {
  if (!proc) return true
  // Send Ctrl+C to powershell stdin
  try {
    if (proc.stdin && !proc.stdin.destroyed) {
      proc.stdin.write("\x03")
    }
  } catch(e) {}
  // Also kill child processes
  try {
    var pid = proc.pid
    var result = require("child_process").execSync(
      "powershell -Command \"Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq " + pid + " } | Select-Object -ExpandProperty ProcessId\"",
      { windowsHide: true, encoding: "utf-8", timeout: 3000 }
    )
    var pids = result.trim().split("\n").map(function(s) { return s.trim() }).filter(function(s) { return /^\d+$/.test(s) })
    pids.forEach(function(cpid) {
      try { require("child_process").execSync("taskkill /pid " + cpid + " /f /t", { windowsHide: true, timeout: 3000 }) } catch(e) {}
    })
  } catch(e) {}
  return true
})

ipcMain.handle("terminal:killTree", function() {
  // Kill the terminal process and ALL its children
  if (proc) {
    var pid = proc.pid
    try {
      require("child_process").execSync("taskkill /pid " + pid + " /f /t", { windowsHide: true, timeout: 5000 })
    } catch(e) {}
    proc = null
  }
  
  if (win && !win.isDestroyed()) {
    win.webContents.send("terminal:data", "[killed all processes]\r\n")
    win.webContents.send("terminal:closed")
  }
  return true
})

ipcMain.handle("terminal:runExternal", function(_, command) {
  var cwd = projectPath || process.env.USERPROFILE || "C:\\"
  spawn("cmd.exe", ["/c", "start", "", "/D", cwd, "cmd.exe", "/k", command], { shell: true, detached: true, stdio: "ignore" })
  return { success: true }
})

ipcMain.handle("system:checkNode", function() {
  return new Promise(function(r) { exec("node --version", function(e, o) { r(e ? null : o.trim()) }) })
})
ipcMain.handle("system:checkPython", function() {
  return new Promise(function(r) {
    exec("python --version", function(e, o) {
      if (!e) r(o.trim())
      else exec("python3 --version", function(e2, o2) { r(e2 ? null : o2.trim()) })
    })
  })
})
ipcMain.handle("shell:openExternal", function(_, url) { shell.openExternal(url) })

ipcMain.handle("project:getScripts", function() {
  if (!projectPath) return {}
  try {
    var pkgPath = path.join(projectPath, "package.json")
    if (!fs.existsSync(pkgPath)) return {}
    var pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    return pkg.scripts || {}
  } catch (e) { return {} }
})

ipcMain.handle("project:saveScripts", function(_, newScripts) {
  if (!projectPath) return { success: false }
  try {
    var pkgPath = path.join(projectPath, "package.json")
    if (!fs.existsSync(pkgPath)) return { success: false, message: "No package.json" }
    var pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    pkg.scripts = newScripts
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
    return { success: true }
  } catch (e) { return { success: false, message: e.message } }
})

ipcMain.handle("file:read", function(_, p) { try { return fs.readFileSync(p, "utf-8") } catch (e) { return null } })

// Prompt configs
function promptPath() { return path.join(app.getPath("userData"), "condor-prompt.txt") }
function miniPromptPath() { return path.join(app.getPath("userData"), "condor-miniprompt.txt") }

ipcMain.handle("prompt:load", function() {
  try { if (fs.existsSync(promptPath())) return fs.readFileSync(promptPath(), "utf-8") } catch(e) {}
  return ""
})
ipcMain.handle("prompt:save", function(_, text) {
  try { fs.writeFileSync(promptPath(), text, "utf-8"); return true } catch(e) { return false }
})
ipcMain.handle("miniprompt:load", function() {
  try { if (fs.existsSync(miniPromptPath())) return fs.readFileSync(miniPromptPath(), "utf-8") } catch(e) {}
  return ""
})
ipcMain.handle("miniprompt:save", function(_, text) {
  try { fs.writeFileSync(miniPromptPath(), text, "utf-8"); return true } catch(e) { return false }
})

ipcMain.handle("file:delete", function(_, filePath) {
  try {
    var stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(filePath)
    }
    return { success: true }
  } catch(e) {
    return { success: false, message: e.message }
  }
})
