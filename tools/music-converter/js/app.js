(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const fileInput = $("file-input");
  const dropZone = $("drop-zone");
  const taskList = $("task-list");
  const emptyState = $("empty-state");
  const countBadge = $("task-count");
  const convertAllBtn = $("convert-all");
  const downloadZipBtn = $("download-zip");
  const tasks = [];
  let ffmpeg = null;
  let ffmpegLoading = null;
  let busy = false;
  let activeTask = null;

  const encryptedExtensions = new Set([
    "ncm", "qmc0", "qmc3", "qmcflac", "mgg", "mgg1", "mflac",
    "kgm", "kgma", "kgg", "kwm"
  ]);
  const ordinaryExtensions = new Set([
    "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "aiff", "aif", "wma"
  ]);

  function extOf(name) {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
  }
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  function platformFor(ext) {
    if (["ncm"].includes(ext)) return "网易云音乐";
    if (["qmc0", "qmc3", "qmcflac", "mgg", "mgg1", "mflac"].includes(ext)) return "QQ 音乐";
    if (["kgm", "kgma", "kgg"].includes(ext)) return "酷狗音乐";
    if (ext === "kwm") return "酷我音乐";
    return "普通音频";
  }
  function isEncrypted(ext) { return encryptedExtensions.has(ext); }

  function addFiles(fileList) {
    [...fileList].forEach(file => {
      const ext = extOf(file.name);
      if (tasks.some(t => t.file.name === file.name && t.file.size === file.size && t.file.lastModified === file.lastModified)) return;
      const supported = ordinaryExtensions.has(ext);
      const encrypted = isEncrypted(ext);
      tasks.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        file, ext, platform: platformFor(ext),
        state: encrypted ? "unsupported" : supported ? "ready" : "unknown",
        progress: 0, output: null, error: encrypted
          ? "检测到平台专有格式。当前版本只识别文件类型，不绕过 DRM 或版权访问保护；请使用平台允许的导出方式。"
          : supported ? "" : "暂不确认该文件是否为可读取的音频格式。"
      });
    });
    render();
  }

  function render() {
    countBadge.textContent = tasks.length;
    emptyState.hidden = tasks.length > 0;
    taskList.innerHTML = "";
    tasks.forEach(task => {
      const card = document.createElement("article");
      card.className = "task-card";
      const statusText = {
        ready: "待转换", working: "转换中", success: "已完成",
        error: "转换失败", unsupported: "暂不支持", unknown: "待检查"
      }[task.state] || "待处理";
      const statusClass = task.state === "success" ? "success" :
        task.state === "error" || task.state === "unsupported" ? "error" :
        task.state === "working" ? "working" : "";
      card.innerHTML = `
        <div class="task-main">
          <div class="task-title-row">
            <div class="task-name" title=""></div>
            <span class="task-status ${statusClass}">${statusText}</span>
          </div>
          <div class="task-meta">${task.platform} · ${task.ext.toUpperCase() || "未知格式"} · ${formatBytes(task.file.size)}</div>
          <div class="task-progress"><div style="width:${task.progress}%"></div></div>
        </div>
        <div class="task-actions">
          ${task.output ? '<button class="small-button download-one">下载 MP3</button>' : ""}
          <button class="small-button remove-one">移除</button>
        </div>
        ${task.error ? '<div class="task-error"></div>' : ""}
      `;
      card.querySelector(".task-name").textContent = task.file.name;
      card.querySelector(".task-name").title = task.file.name;
      if (task.error) card.querySelector(".task-error").textContent = task.error;
      const dl = card.querySelector(".download-one");
      if (dl) dl.addEventListener("click", () => downloadTask(task));
      card.querySelector(".remove-one").addEventListener("click", () => {
        const i = tasks.findIndex(t => t.id === task.id);
        if (i >= 0) tasks.splice(i, 1);
        render();
      });
      taskList.appendChild(card);
    });
    convertAllBtn.disabled = busy || !tasks.some(t => t.state === "ready" || t.state === "unknown");
    downloadZipBtn.disabled = busy || !tasks.some(t => t.output);
  }

  async function loadFFmpeg() {
    if (ffmpeg) return ffmpeg;
    if (ffmpegLoading) return ffmpegLoading;
    ffmpegLoading = (async () => {
      if (!window.FFmpeg || !window.FFmpeg.createFFmpeg) {
        throw new Error("FFmpeg.wasm 库加载失败。请检查网络连接，或稍后重试。");
      }
      const instance = window.FFmpeg.createFFmpeg({
        log: false,
        corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
        progress: ({ ratio }) => {
          if (activeTask && Number.isFinite(ratio)) {
            activeTask.progress = Math.max(12, Math.min(90, Math.round(12 + ratio * 78)));
            render();
          }
        }
      });
      await instance.load();
      ffmpeg = instance;
      return instance;
    })();
    try { return await ffmpegLoading; }
    finally { ffmpegLoading = null; }
  }

  function safeOutputName(name) {
    const base = name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_").trim() || "audio";
    return `${base}.mp3`;
  }

  async function convertTask(task) {
    if (task.state === "unsupported") return;
    if (!ordinaryExtensions.has(task.ext)) {
      task.state = "unsupported";
      task.error = "当前版本尚未验证此格式的解码能力。";
      render();
      return;
    }
    task.state = "working";
    activeTask = task;
    task.progress = 3;
    task.error = "";
    render();

    try {
      const engine = await loadFFmpeg();
      const inputName = `input_${Date.now()}_${Math.floor(Math.random()*1e6)}.${task.ext}`;
      const outputName = `output_${Date.now()}_${Math.floor(Math.random()*1e6)}.mp3`;
      engine.FS("writeFile", inputName, new Uint8Array(await task.file.arrayBuffer()));
      task.progress = 12;
      render();

      // MP3 input is stream-copied to avoid another lossy encode.
      if (task.ext === "mp3") {
        await engine.run("-i", inputName, "-map", "0:a:0", "-c:a", "copy", "-map_metadata", "0", "-id3v2_version", "3", outputName);
      } else {
        // Preserve source sample rate and channel layout by not forcing -ar/-ac.
        // LAME quality setting is fixed to a high-quality VBR target, not an upsampled bitrate.
        await engine.run("-i", inputName, "-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-q:a", "2", "-map_metadata", "0", "-id3v2_version", "3", outputName);
      }
      task.progress = 92;
      render();
      const data = engine.FS("readFile", outputName);
      task.output = new Blob([data.buffer], { type: "audio/mpeg" });
      task.outputName = safeOutputName(task.file.name);
      task.state = "success";
      task.progress = 100;
      try { engine.FS("unlink", inputName); engine.FS("unlink", outputName); } catch (_) {}
    } catch (err) {
      task.state = "error";
      task.error = (err && err.message ? err.message : String(err)).slice(0, 350);
      task.progress = 0;
    }
    activeTask = null;
    render();
  }

  async function convertAll() {
    if (busy) return;
    const pending = tasks.filter(t => t.state === "ready" || t.state === "unknown");
    if (!pending.length) return;
    busy = true;
    $("overall-wrap").hidden = false;
    convertAllBtn.disabled = true;
    for (let i = 0; i < pending.length; i++) {
      $("overall-text").textContent = `正在处理 ${i + 1} / ${pending.length}`;
      $("overall-percent").textContent = `${Math.round(i / pending.length * 100)}%`;
      $("overall-bar").style.width = `${i / pending.length * 100}%`;
      await convertTask(pending[i]);
    }
    $("overall-text").textContent = "处理完成";
    $("overall-percent").textContent = "100%";
    $("overall-bar").style.width = "100%";
    busy = false;
    render();
  }

  function downloadTask(task) {
    if (!task.output) return;
    const url = URL.createObjectURL(task.output);
    const a = document.createElement("a");
    a.href = url; a.download = task.outputName || "audio.mp3";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function downloadZip() {
    const completed = tasks.filter(t => t.output);
    if (!completed.length || !window.JSZip) return;
    downloadZipBtn.disabled = true;
    try {
      const zip = new JSZip();
      completed.forEach((task, i) => {
        let name = task.outputName || `audio-${i + 1}.mp3`;
        if (completed.filter(t => (t.outputName || "") === name).length > 1) {
          name = name.replace(/\.mp3$/i, `-${i + 1}.mp3`);
        }
        zip.file(name, task.output);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "music-converted.zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      alert(`ZIP 打包失败：${err.message || err}`);
    } finally { render(); }
  }

  $("choose-files").addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
  dropZone.addEventListener("click", e => { if (e.target.id !== "choose-files") fileInput.click(); });
  dropZone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }});
  fileInput.addEventListener("change", e => { addFiles(e.target.files); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, e => {
    e.preventDefault(); dropZone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, e => {
    e.preventDefault(); dropZone.classList.remove("dragover");
  }));
  dropZone.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  $("clear-all").addEventListener("click", () => {
    if (busy) return;
    tasks.splice(0, tasks.length);
    $("overall-wrap").hidden = true;
    render();
  });
  convertAllBtn.addEventListener("click", convertAll);
  downloadZipBtn.addEventListener("click", downloadZip);

  render();
})();
