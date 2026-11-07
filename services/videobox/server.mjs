import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT || 8787);
const ytdlp = process.env.YTDLP_PATH || 'yt-dlp';
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
const supportedHosts = {
  bilibili: ['bilibili.com', 'b23.tv'],
  douyin: ['douyin.com', 'iesdouyin.com'],
  kuaishou: ['kuaishou.com', 'kwai.com'],
  xigua: ['ixigua.com'],
  tencent: ['v.qq.com'],
  iqiyi: ['iqiyi.com'],
  youku: ['youku.com']
};

function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin' });
  response.end(JSON.stringify(data));
}

function platformFor(urlString) {
  let hostname;
  try { hostname = new URL(urlString).hostname.toLowerCase(); } catch { return null; }
  for (const [platform, domains] of Object.entries(supportedHosts)) {
    if (domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) return platform;
  }
  return null;
}

function normalizeSourceUrl(urlString) {
  const url = new URL(urlString);
  // Bilibili's language-prefixed web routes (for example /zh-Hans/video/...)
  // display normally in a browser, but are not accepted consistently by yt-dlp.
  if (platformFor(urlString) === 'bilibili') {
    const match = url.pathname.match(/\/video\/(BV[\w]+)/i);
    if (match) return `https://www.bilibili.com/video/${match[1]}`;
  }
  return url.toString();
}

function publicArgs(url) {
  // Do not pass cookies, credentials, or a browser profile to yt-dlp.
  return ['--no-playlist', '--no-warnings', '--no-call-home', '--socket-timeout', '20', url];
}

function runYtDlp(args, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlp, args, { windowsHide: true });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes <= maxBytes) stdout.push(chunk); else child.kill(); });
    child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', error => reject(new Error(`无法启动 yt-dlp：${error.message}`)));
    child.on('close', code => code === 0 ? resolve(Buffer.concat(stdout).toString('utf8')) : reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || '视频服务未能读取该公开链接。')));
  });
}

function formatsFor(info) {
  return (info.formats || [])
    // Bilibili and several other platforms commonly expose video and audio as
    // separate public streams. Keep video-only formats; download() pairs them
    // with the best public audio stream and merges them into an MP4.
    .filter(format => format.format_id && format.vcodec && format.vcodec !== 'none' && !format.has_drm)
    .map(format => ({
      id: String(format.format_id),
      label: [format.height ? `${format.height}p` : '', format.fps ? `${format.fps}fps` : '', format.acodec && format.acodec !== 'none' ? '音视频' : '视频＋音频'].filter(Boolean).join(' · '),
      ext: format.ext,
      filesize: format.filesize || format.filesize_approx || null,
      note: format.format_note || ''
    }))
    .sort((a, b) => (b.filesize || 0) - (a.filesize || 0));
}

function safeFilename(text) {
  return String(text || 'video').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
}

async function getInfo(url) {
  const sourceUrl = normalizeSourceUrl(url);
  const output = await runYtDlp(['--dump-single-json', '--skip-download', ...publicArgs(sourceUrl)]);
  const info = JSON.parse(output);
  if (info._type === 'playlist' || info.is_live) throw new Error('仅支持单个非直播公开视频。');
  if (info.availability && !['public', 'unlisted', 'unknown'].includes(info.availability)) throw new Error('该内容需要权限或不公开，无法下载。');
  return info;
}

function parseRequestUrl(request) { return new URL(request.url, `http://${request.headers.host}`); }

const server = createServer(async (request, response) => {
  const requestUrl = parseRequestUrl(request);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' });
    return response.end();
  }
  if (requestUrl.pathname === '/health') return send(response, 200, { ok: true });

  if (request.method === 'POST' && requestUrl.pathname === '/api/v1/resolve') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; if (body.length > 16_384) request.destroy(); });
    request.on('end', async () => {
      try {
        const { url } = JSON.parse(body || '{}');
        const platform = platformFor(url);
        if (!platform) return send(response, 400, { error: '暂不支持此链接。请使用已列出的平台官网链接。' });
        const info = await getInfo(url);
        const formats = formatsFor(info);
        if (!formats.length) return send(response, 422, { error: '没有发现可下载的公开视频格式。' });
        send(response, 200, { platform, title: info.title, thumbnail: info.thumbnail, duration: info.duration, uploader: info.uploader || info.channel, viewCount: info.view_count, formats });
      } catch (error) { send(response, 422, { error: error.message || '解析失败。' }); }
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/v1/download') {
    const url = requestUrl.searchParams.get('url');
    const formatId = requestUrl.searchParams.get('format');
    const platform = platformFor(url);
    if (!platform || !/^[A-Za-z0-9._+-]+$/.test(formatId || '')) return send(response, 400, { error: '下载参数无效。' });
    try {
      const sourceUrl = normalizeSourceUrl(url);
      const info = await getInfo(sourceUrl);
      if (!formatsFor(info).some(format => format.id === formatId)) return send(response, 403, { error: '所选格式不可用。' });
      const selectedFormat = (info.formats || []).find(format => String(format.format_id) === formatId);
      const extension = selectedFormat?.ext || 'mp4';
      const formatSelector = selectedFormat?.acodec && selectedFormat.acodec !== 'none'
        ? formatId
        : `${formatId}+bestaudio/best`;
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${safeFilename(info.title)}.${extension}`)}`,
        'Access-Control-Allow-Origin': allowedOrigin,
        'Cache-Control': 'no-store'
      });
      const child = spawn(ytdlp, ['-f', formatSelector, '--merge-output-format', 'mp4', '-o', '-', ...publicArgs(sourceUrl)], { windowsHide: true });
      child.stdout.pipe(response);
      child.stderr.on('data', () => {});
      child.on('error', () => response.destroy());
      child.on('close', code => { if (code !== 0 && !response.writableEnded) response.end(); });
    } catch (error) { send(response, 422, { error: error.message || '无法开始下载。' }); }
    return;
  }
  send(response, 404, { error: 'Not found' });
});

server.listen(port, () => console.log(`VideoBox service listening on :${port}`));
