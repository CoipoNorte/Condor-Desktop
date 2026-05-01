const { contextBridge, ipcRenderer, webUtils } = require("electron")

// Test if file.path works
window.addEventListener("DOMContentLoaded", function() {
  // Create a hidden drop zone that captures EVERYTHING
  var dropZone = document.createElement("div")
  dropZone.id = "condor-drop-zone"
  dropZone.style.cssText = "position:fixed;inset:0;z-index:999999;display:none;"
  document.body.appendChild(dropZone)

  var showTimer = null

  // Show drop zone when dragging files over window
  window.addEventListener("dragenter", function(e) {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf("Files") !== -1) {
      dropZone.style.display = "block"
      dropZone.style.background = "rgba(99,102,241,0.06)"
      dropZone.style.border = "2px dashed rgba(99,102,241,0.3)"
    }
  })

  // The drop zone handles everything
  dropZone.addEventListener("dragover", function(e) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  })

  dropZone.addEventListener("dragleave", function(e) {
    // Only hide if leaving the window entirely
    var rect = dropZone.getBoundingClientRect()
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
      dropZone.style.display = "none"
    }
  })

  dropZone.addEventListener("drop", function(e) {
    e.preventDefault()
    e.stopPropagation()
    dropZone.style.display = "none"

    var files = e.dataTransfer.files
    if (!files || files.length === 0) return

        var filePath = ""
    try {
      filePath = webUtils.getPathForFile(files[0])
    } catch(err) {
      try { filePath = files[0].path } catch(e) {}
    }
    console.log("PRELOAD DROP - path:", filePath)

        if (filePath) {
      // Check if it's a file (md, txt) or a folder
      var ext = filePath.split(".").pop().toLowerCase()
      if (ext === "md" || ext === "txt" || ext === "markdown") {
        // It's an instruction file - read and parse
        ipcRenderer.invoke("file:read", filePath).then(function(content) {
          if (content) {
            window.postMessage({ type: "condor-instruction-file", path: filePath, content: content }, "*")
          }
        })
      } else {
        // It's a folder or other file - open as project
        ipcRenderer.invoke("project:setPath", filePath).then(function() {
          window.postMessage({ type: "condor-project-opened", path: filePath }, "*")
        })
      }
    }
  })
})

contextBridge.exposeInMainWorld("electronAPI", {
    minimize: function() { return ipcRenderer.invoke("window:minimize") },
  minimizeToTray: function() { return ipcRenderer.invoke("window:minimizeToTray") },
  maximize: function() { return ipcRenderer.invoke("window:maximize") },
  close: function() { return ipcRenderer.invoke("window:close") },
  isMaximized: function() { return ipcRenderer.invoke("window:isMaximized") },
    openFolder: function() { return ipcRenderer.invoke("dialog:openFolder") },
  openFile: function(filters) { return ipcRenderer.invoke("dialog:openFile", filters) },
  setProjectPath: function(p) { return ipcRenderer.invoke("project:setPath", p) },
  getProjectPath: function() { return ipcRenderer.invoke("project:getPath") },
  getFileTree: function() { return ipcRenderer.invoke("project:getFileTree") },
  copyTreeString: function() { return ipcRenderer.invoke("project:copyTreeString") },
  watchStart: function() { return ipcRenderer.invoke("project:watchStart") },
  watchStop: function() { return ipcRenderer.invoke("project:watchStop") },
  createFile: function(d, n) { return ipcRenderer.invoke("project:createFile", d, n) },
  createFolder: function(d, n) { return ipcRenderer.invoke("project:createFolder", d, n) },
  onFileChanged: function(cb) { ipcRenderer.on("project:fileChanged", cb); return function() { ipcRenderer.removeListener("project:fileChanged", cb) } },
  readClipboard: function() { return ipcRenderer.invoke("clipboard:read") },
  parseInstructions: function(t) { return ipcRenderer.invoke("condor:parse", t) },
  executeInstruction: function(i, o) { return ipcRenderer.invoke("condor:execute", i, o) },
  stopExecution: function() { return ipcRenderer.invoke("condor:stop") },
  undo: function() { return ipcRenderer.invoke("condor:undo") },
  loadConfig: function() { return ipcRenderer.invoke("config:load") },
  saveConfig: function(c) { return ipcRenderer.invoke("config:save", c) },
  loadIgnoreConfig: function() { return ipcRenderer.invoke("config:loadIgnore") },
  saveIgnoreConfig: function(c) { return ipcRenderer.invoke("config:saveIgnore", c) },
  spawnTerminal: function() { return ipcRenderer.invoke("terminal:spawn") },
  writeTerminal: function(d) { return ipcRenderer.invoke("terminal:write", d) },
      killTerminal: function() { return ipcRenderer.invoke("terminal:kill") },
  killTree: function() { return ipcRenderer.invoke("terminal:killTree") },
  sendCtrlC: function() { return ipcRenderer.invoke("terminal:sendCtrlC") },
  onTerminalClosed: function(cb) { ipcRenderer.on("terminal:closed", cb); return function() { ipcRenderer.removeListener("terminal:closed", cb) } },
  onTerminalData: function(cb) { var h = function(_, d) { cb(d) }; ipcRenderer.on("terminal:data", h); return function() { ipcRenderer.removeListener("terminal:data", h) } },
  checkNode: function() { return ipcRenderer.invoke("system:checkNode") },
  checkPython: function() { return ipcRenderer.invoke("system:checkPython") },
  openExternal: function(u) { return ipcRenderer.invoke("shell:openExternal", u) },
    readFile: function(p) { return ipcRenderer.invoke("file:read", p) },
  deleteFile: function(p) { return ipcRenderer.invoke("file:delete", p) },
  moveFile: function(src, destDir) { return ipcRenderer.invoke("file:move", src, destDir) },
  copyFile: function(src) { return ipcRenderer.invoke("file:copy", src) },
  pasteFile: function(destDir) { return ipcRenderer.invoke("file:paste", destDir) },
      getScripts: function() { return ipcRenderer.invoke("project:getScripts") },
  saveScripts: function(s) { return ipcRenderer.invoke("project:saveScripts", s) },
  loadPrompt: function() { return ipcRenderer.invoke("prompt:load") },
  savePrompt: function(t) { return ipcRenderer.invoke("prompt:save", t) },
  loadMiniPrompt: function() { return ipcRenderer.invoke("miniprompt:load") },
  saveMiniPrompt: function(t) { return ipcRenderer.invoke("miniprompt:save", t) },
  runExternal: function(cmd) { return ipcRenderer.invoke("terminal:runExternal", cmd) },
})
