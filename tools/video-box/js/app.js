(() => {
  'use strict';

  const API_BASE = window.VIDEOBOX_API_BASE || '/api/v1';
  const form = document.querySelector('#resolve-form');
  const input = document.querySelector('#video-url');
  const pasteButton = document.querySelector('#paste-button');
  const resolveButton = document.querySelector('#resolve-button');
  const status = document.querySelector('#status');
  const result = document.querySelector('#result');
  const formatList = document.querySelector('#format-list');
  const downloadButton = document.querySelector('#download-button');
  const downloadHint = document.querySelector('#download-hint');
  let currentVideo = null;

  const platformNames = { bilibili: 'B 站', douyin: '抖音', kuaishou: '快手', xigua: '西瓜视频', tencent: '腾讯视频', iqiyi: '爱奇艺', youku: '优酷' };

  function setStatus(message, type = '') {
    status.hidden = !message;
    status.textContent = message || '';
    status.className = `status ${type}`;
  }

  function durationText(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '时长未知';
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remain = Math.floor(seconds % 60).toString().padStart(2, '0');
    return hours ? `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${remain}` : `${minutes}:${remain}`;
  }

  function sizeText(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '大小未知';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
  }

  function isHttpUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
  }

  function renderVideo(video) {
    document.querySelector('#cover').src = video.thumbnail || '';
    document.querySelector('#cover').hidden = !video.thumbnail;
    document.querySelector('#platform').textContent = platformNames[video.platform] || '公开视频';
    document.querySelector('#video-title').textContent = video.title || '未命名视频';
    document.querySelector('#video-meta').textContent = `${durationText(video.duration)}${video.viewCount ? ` · ${video.viewCount.toLocaleString()} 次播放` : ''}`;
    document.querySelector('#uploader').textContent = video.uploader ? `发布者：${video.uploader}` : '';
    formatList.replaceChildren();
    video.formats.forEach((format, index) => {
      const label = document.createElement('label');
      label.className = 'format-option';
      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'format'; radio.value = format.id; radio.checked = index === 0;
      const copy = document.createElement('span');
      const name = document.createElement('span'); name.className = 'format-name'; name.textContent = format.label || format.ext?.toUpperCase() || '可用格式';
      const detail = document.createElement('span'); detail.className = 'format-detail'; detail.textContent = [format.ext?.toUpperCase(), format.filesize ? sizeText(format.filesize) : '', format.note].filter(Boolean).join(' · ');
      copy.append(name, detail); label.append(radio, copy); formatList.append(label);
    });
    result.hidden = false;
    downloadButton.disabled = !video.formats.length;
    downloadHint.textContent = video.formats.length ? '文件将由浏览器保存到默认下载目录。' : '该视频没有可下载的公开格式。';
  }

  async function resolve(url) {
    setStatus('正在识别平台并读取公开视频信息…', 'working');
    result.hidden = true; currentVideo = null; resolveButton.disabled = true;
    try {
      const response = await fetch(`${API_BASE}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '无法解析该链接。');
      if (!Array.isArray(payload.formats) || !payload.formats.length) throw new Error('没有找到可下载的公开视频格式。');
      currentVideo = { ...payload, sourceUrl: url };
      renderVideo(currentVideo);
      setStatus('解析完成，请选择清晰度后下载。');
    } catch (error) {
      setStatus(error.message || '解析失败，请检查链接后重试。', 'error');
    } finally { resolveButton.disabled = false; }
  }

  form.addEventListener('submit', event => { event.preventDefault(); const url = input.value.trim(); if (!isHttpUrl(url)) { setStatus('请输入完整的视频网页链接。', 'error'); return; } resolve(url); });
  pasteButton.addEventListener('click', async () => { try { input.value = await navigator.clipboard.readText(); input.focus(); } catch { setStatus('无法读取剪贴板，请手动粘贴链接。', 'error'); } });
  downloadButton.addEventListener('click', () => {
    const format = document.querySelector('input[name="format"]:checked');
    if (!currentVideo || !format) return;
    const params = new URLSearchParams({ url: currentVideo.sourceUrl, format: format.value });
    downloadButton.disabled = true;
    downloadHint.textContent = '正在将下载任务交给浏览器…';
    setStatus('下载已开始。可在浏览器下载列表查看真实进度。', 'working');
    window.location.assign(`${API_BASE}/download?${params}`);
    window.setTimeout(() => { downloadButton.disabled = false; downloadHint.textContent = '若浏览器未开始下载，请检查下载列表或重试。'; }, 2500);
  });
})();
