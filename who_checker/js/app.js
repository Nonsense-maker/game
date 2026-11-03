const $ = (id) => document.getElementById(id);
const state = { data: {}, worker: null, audioFp: "不可用" };

const WORKER_URL = "https://api.wscldyr.com"; // 部署前改成你的 Cloudflare Worker 地址

function getWorkerUrl() {
  return WORKER_URL.trim().replace(/\/+$/, "");
}

function safe(v, fallback = "—") {
  return v === undefined || v === null || v === "" ? fallback : String(v);
}

function escapeHtml(v) {
  return safe(v).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  str = String(str);
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
        Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>> 0;
  h2 = (Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
        Math.imul(h1 ^ (h1 >>> 13), 3266489909)) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function addRows(id, items) {
  const box = $(id);
  if (!box) return;
  box.innerHTML = "";
  for (const [k, v] of items) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span class="k">${escapeHtml(k)}</span><span class="v" title="${escapeHtml(v)}">${escapeHtml(v)}</span>`;
    box.appendChild(row);
  }
}

function browserInfo() {
  const ua = navigator.userAgent;
  const platform = navigator.userAgentData?.platform || navigator.platform || "未知";
  let browser = "未知浏览器";
  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Google Chrome";
  else if (/Firefox\//.test(ua)) browser = "Mozilla Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Apple Safari";
  const m = ua.match(/(?:Edg|Chrome|Firefox|Version|OPR)\/([\d.]+)/);
  return { ua, browser, version: m?.[1] || "未知", platform };
}

function canvasFingerprint() {
  try {
    const c = document.createElement("canvas");
    c.width = 520; c.height = 120;
    const x = c.getContext("2d");
    x.textBaseline = "top";
    x.font = "16px Arial";
    x.fillStyle = "#f60";
    x.fillRect(5, 5, 120, 20);
    x.fillStyle = "#069";
    x.font = "18px 'Times New Roman'";
    x.fillText("Browser fingerprint 你好", 10, 35);
    x.globalCompositeOperation = "multiply";
    x.fillStyle = "rgb(255,0,255)";
    x.beginPath();
    x.arc(90, 80, 35, 0, Math.PI * 2);
    x.fill();
    return hash(c.toDataURL());
  } catch {
    return "不可用";
  }
}

function webglFingerprint() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return { fp: "不可用", renderer: "不支持 WebGL" };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const fp = hash([
      vendor, renderer, gl.getParameter(gl.VERSION),
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    ].join("|"));
    return { fp, renderer };
  } catch {
    return { fp: "不可用", renderer: "读取失败" };
  }
}

async function audioFingerprint() {
  try {
    const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!C) return "不支持";
    const ctx = new C(1, 44100, 44100);
    const osc = ctx.createOscillator();
    const comp = ctx.createDynamicsCompressor();
    osc.type = "triangle";
    osc.frequency.value = 10000;
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    const buf = await ctx.startRendering();
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(buf.getChannelData(0)[i] || 0);
    return hash(sum.toFixed(12));
  } catch {
    return "被浏览器限制";
  }
}

function detectFonts() {
  const fonts = [
    "Arial","Times New Roman","Courier New","Georgia","Verdana","Tahoma",
    "Trebuchet MS","Comic Sans MS","Microsoft YaHei","SimSun","SimHei",
    "PingFang SC","Noto Sans CJK SC","Helvetica Neue"
  ];
  const base = "monospace";
  const test = "mmmmmmmmmmlli";
  const c = document.createElement("canvas");
  const x = c.getContext("2d");
  x.font = `72px ${base}`;
  const baseW = x.measureText(test).width;
  const found = fonts.filter(f => {
    x.font = `72px '${f}',${base}`;
    return x.measureText(test).width !== baseW;
  });
  return { count: found.length, list: found };
}

function classifyAddress(address) {
  if (!address) return "未知";
  const a = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (a.endsWith(".local")) return "mDNS 主机名（已隐藏本地 IP）";
  if (a.includes(":")) {
    if (a === "::1") return "IPv6 回环地址";
    if (a.startsWith("fe80:")) return "IPv6 链路本地地址";
    if (/^(fc|fd)/.test(a)) return "IPv6 ULA 私有地址";
    return "IPv6 公网候选地址";
  }
  const parts = a.split(".").map(Number);
  if (parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [x,y] = parts;
    if (x === 10 || x === 127 || (x === 172 && y >= 16 && y <= 31) ||
        (x === 192 && y === 168) || (x === 169 && y === 254) ||
        (x === 100 && y >= 64 && y <= 127)) return "IPv4 私有 / 保留地址";
    return "IPv4 公网候选地址";
  }
  return "主机名 / 未识别地址";
}

async function webrtcDetect() {
  if (!window.RTCPeerConnection) {
    return { state:"不支持", info:"当前浏览器没有 RTCPeerConnection", ips:[], candidates:[], parsed:[], stunUsed:false };
  }

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" }
  ];
  let pc;
  const raw = new Map();
  try {
    pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 0 });
    pc.createDataChannel("who-checker-probe");
    pc.onicecandidate = event => {
      const candidate = event.candidate;
      if (!candidate) return;
      const line = candidate.candidate || "";
      if (!line) return;
      raw.set(line, {
        line,
        address: candidate.address || "",
        port: candidate.port || "",
        protocol: candidate.protocol || "",
        type: candidate.type || "",
        foundation: candidate.foundation || "",
        relatedAddress: candidate.relatedAddress || "",
        relatedPort: candidate.relatedPort || "",
        tcpType: candidate.tcpType || ""
      });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await Promise.race([
      new Promise(resolve => {
        if (pc.iceGatheringState === "complete") return resolve();
        pc.addEventListener("icegatheringstatechange", () => {
          if (pc.iceGatheringState === "complete") resolve();
        });
      }),
      new Promise(resolve => setTimeout(resolve, 6500))
    ]);

    const parsed = [...raw.values()].map(item => ({
      ...item,
      classification: classifyAddress(item.address)
    }));
    const ips = [...new Set(parsed.map(x => x.address).filter(Boolean))];
    const types = [...new Set(parsed.map(x => x.type).filter(Boolean))];
    const host = parsed.filter(x => x.type === "host");
    const srflx = parsed.filter(x => x.type === "srflx");
    const relay = parsed.filter(x => x.type === "relay");
    const state = parsed.length ? "已完成" : "未收集到候选地址";

    return {
      state,
      info: `ICE ${parsed.length} 条 · host ${host.length} / srflx ${srflx.length} / relay ${relay.length}`,
      ips, candidates: parsed.map(x => x.line), parsed, types,
      hostCount: host.length, srflxCount: srflx.length, relayCount: relay.length,
      stunUsed: true,
      gatheringState: pc.iceGatheringState
    };
  } catch (error) {
    return {
      state:"受限",
      info:`STUN / ICE 收集失败：${error?.message || "浏览器或网络限制"}`,
      ips:[], candidates:[], parsed:[], stunUsed:true, error:String(error)
    };
  } finally {
    try { pc?.close(); } catch {}
  }
}

async function fetchWorker() {
  const url = getWorkerUrl();
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch(`${url}/api/info`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.ok ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getPublicIp() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const r = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: controller.signal
    });
    if (r.ok) {
      const j = await r.json();
      if (j.ip && /^\d+\./.test(j.ip)) return j.ip;
    }
  } catch {}
  finally {
    clearTimeout(timer);
  }
  return state.data.workerIp && /^\d+\./.test(state.data.workerIp) ? state.data.workerIp : null;
}


async function lookupIp(ip) {
  if (!ip) return { ok:false, error:"没有可查询的 IP 地址" };
  const isV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip);
  const isV6 = ip.includes(":");
  if (!isV4 && !isV6) return { ok:false, error:"IP 地址格式无法识别" };

  let workerData = null;
  let workerError = "";
  try {
    const response = await fetch(`${getWorkerUrl()}/api/lookup?ip=${encodeURIComponent(ip)}`, {
      cache:"no-store", signal:AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (response.ok && data?.ok) workerData = data;
    else workerError = data?.error || `Worker 查询失败（HTTP ${response.status}）`;
  } catch (error) {
    workerError = error?.message || "Worker 请求失败";
  }

  // Worker 端查询不可用或没有归属字段时，浏览器直接请求 ipapi.co 作为兜底。
  let directGeo = null;
  const existingGeo = workerData?.geo || {};
  const hasGeo = ["country","region","city","postal","timezone","asn","org","isp"]
    .some(key => existingGeo[key] !== null && existingGeo[key] !== undefined && existingGeo[key] !== "");
  if (!hasGeo) {
    try {
      const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        cache:"no-store", signal:AbortSignal.timeout(8000),
        headers:{Accept:"application/json"}
      });
      const raw = await response.json();
      const returnedIp = String(raw?.ip || "");
      const sameFamily = isV4 ? /^\d{1,3}(?:\.\d{1,3}){3}$/.test(returnedIp) : returnedIp.includes(":");
      if (response.ok && !raw?.error && sameFamily) {
        directGeo = {
          country:raw.country_name || raw.country || null,
          region:raw.region || null,
          city:raw.city || null,
          postal:raw.postal || null,
          timezone:raw.timezone || null,
          asn:raw.asn || null,
          org:raw.org || null,
          isp:raw.org || null,
          network:raw.network || null,
          latitude:raw.latitude ?? null,
          longitude:raw.longitude ?? null
        };
      }
    } catch {}
  }

  if (workerData) {
    return {
      ...workerData,
      geo: hasGeo ? { ...(directGeo || {}), ...existingGeo } : (directGeo || existingGeo),
      sources: {
        ...(workerData.sources || {}),
        geo: hasGeo ? workerData.sources?.geo : (directGeo ? "ipapi.co（浏览器直连备用）" : workerData.sources?.geo)
      },
      errors: {
        ...(workerData.errors || {}),
        geo: [...(workerData.errors?.geo || []), ...(!hasGeo && !directGeo ? ["Worker 与浏览器备用查询均未返回归属字段"] : [])]
      }
    };
  }
  if (directGeo) {
    return {
      ok:true, ip, geo:directGeo, rdap:null,
      sources:{geo:"ipapi.co（浏览器直连备用）",rdap:null},
      errors:{geo:[workerError || "Worker 查询不可用，已使用浏览器直连备用查询"],rdap:[]},
      partial:true
    };
  }
  return {ok:false,error:[workerError,"ipapi.co 浏览器备用查询也未成功"].filter(Boolean).join("；")};
}

function showDetail(title, rows, note = "") {
  $("detailTitle").textContent = title;
  $("detailBody").innerHTML = rows.map(([k,v]) =>
    `<div class="detail-row"><span>${escapeHtml(k)}</span><b>${escapeHtml(v ?? "未提供")}</b></div>`
  ).join("") + (note ? `<p class="detail-note">${escapeHtml(note)}</p>` : "");
  $("detailPanel").hidden = false;
  $("detailPanel").scrollIntoView({behavior:"smooth", block:"center"});
}

async function openCapabilityDetail(type) {
  const cf = state.worker?.cf || {};
  const ip = $("publicIp").textContent;
  if (type === "webrtc") {
    const wr = state.data.webrtc || {};
    const publicIp = state.data.ip || "";
    const parsed = wr.parsed || [];
    const srflx = parsed.filter(x => x.type === "srflx");
    const relay = parsed.filter(x => x.type === "relay");
    const host = parsed.filter(x => x.type === "host");
    const publicSrflx = srflx.filter(x => x.classification.includes("公网"));
    const differentEgress = publicSrflx.filter(x => x.address && publicIp && x.address !== publicIp);
    let riskTitle = "未发现可确认的公网地址暴露";
    let riskNote = "当前浏览器可能隐藏了部分本地地址，且不同浏览器对 ICE 候选的处理方式不同。";
    if (differentEgress.length) {
      riskTitle = "发现与网页出口不同的 STUN 映射地址";
      riskNote = "这可能表示 WebRTC 流量与普通网页流量走了不同出口，存在代理规则未覆盖 WebRTC 的可能。请结合 VPN 的 WebRTC 防护设置复核；单次差异不等于确定泄漏。";
    } else if (publicSrflx.length) {
      riskTitle = "已获取 STUN 映射公网地址";
      riskNote = "STUN 能看到的映射地址与网页出口一致。它仍然会向 STUN 服务暴露该出口 IP，但本次没有发现与网页出口不同的公网地址。";
    } else if (host.length) {
      riskTitle = "只收集到本地候选或受限候选";
      riskNote = "本地候选可能是私有地址或 mDNS 名称，通常不是公网可路由地址。浏览器隐私策略也可能隐藏地址。";
    }

    showDetail("WebRTC / STUN 泄漏检测", [
      ["检测状态", wr.state || "未知"],
      ["STUN 探测", wr.stunUsed ? "已启用 Google / Cloudflare STUN" : "未启用"],
      ["ICE 候选总数", String(parsed.length)],
      ["host（本地候选）", String(wr.hostCount || 0)],
      ["srflx（STUN 映射）", String(wr.srflxCount || 0)],
      ["relay（中继候选）", String(wr.relayCount || 0)],
      ["网页请求出口 IP", publicIp || "未知"],
      ["与网页出口不同的公网 srflx", String(differentEgress.length)],
      ["初步判断", riskTitle]
    ], riskNote);

    $("detailBody").insertAdjacentHTML("beforeend",
      `<div class="detail-subtitle">ICE 候选地址明细</div>` +
      (parsed.length ? parsed.map((item,i)=>`
        <div class="ice-card">
          <div class="ice-card-head"><b>${i+1}. ${escapeHtml(item.type || "candidate")}</b><span>${escapeHtml(item.protocol || "协议未知").toUpperCase()}</span></div>
          <div class="detail-row"><span>地址</span><b>${escapeHtml(item.address || "浏览器未暴露")}${item.port ? ":"+escapeHtml(item.port) : ""}</b></div>
          <div class="detail-row"><span>地址类型</span><b>${escapeHtml(item.classification)}</b></div>
          ${item.relatedAddress ? `<div class="detail-row"><span>相关地址</span><b>${escapeHtml(item.relatedAddress)}${item.relatedPort ? ":"+escapeHtml(item.relatedPort) : ""}</b></div>` : ""}
          <pre class="candidate-line">${escapeHtml(item.line)}</pre>
        </div>`).join("") : `<p class="detail-note">没有收集到 ICE 候选地址。可能是 STUN 服务不可达、浏览器权限限制或网络屏蔽 UDP。</p>`)
    );
    $("detailBody").insertAdjacentHTML("beforeend", `
      <div class="detail-subtitle">改进建议</div>
      <ul class="detail-advice">
        <li>如果使用 VPN / 代理，检查是否启用了 WebRTC 防泄漏或 UDP 隧道保护。</li>
        <li>如果不需要网页语音/视频，可在浏览器隐私设置或扩展中限制 WebRTC；这可能影响会议、通话和部分网页功能。</li>
        <li>不要仅凭出现私有地址或 mDNS 名称就判定公网泄漏；重点关注与网页出口不同的公网 srflx 地址。</li>
      </ul>
    `);
    return;
  }
  if (type === "ipv4" || type === "ipv6") {
    const is4 = type === "ipv4";
    const browserIpRaw = is4
      ? (state.data.ipv4 || (state.data.ip && /^\d+\./.test(state.data.ip) ? state.data.ip : ""))
      : (state.data.ipv6 || "");
    const browserIp = is4
      ? (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(browserIpRaw) ? browserIpRaw : "")
      : (browserIpRaw.includes(":") ? browserIpRaw : "");
    const workerIp = state.data.workerIp || "";
    // Worker fallback is permitted only for IPv4; it is never used as an IPv6 address.
    const address = browserIp || (is4 && /^\d+\./.test(workerIp) ? workerIp : "");
    if (!address) {
      showDetail(is4 ? "IPv4 地址详情" : "IPv6 地址详情", [
        ["检测结果", "当前未获取到该类型公网地址"],
        ["Worker 观察到的地址", workerIp || "未提供"]
      ], "这表示当前测试出口没有成功返回该协议地址，不代表归属数据库查询失败。请检查网络是否启用该协议，或稍后重新检测。");
      return;
    }
    showDetail("正在查询 IP 归属与注册信息…", [["IP 地址",address],["查询状态","查询中…"]]);
    const info = await lookupIp(address);
    if (!info.ok) {
      showDetail(is4 ? "IPv4 地址详情" : "IPv6 地址详情", [
        ["IP 地址",address], ["归属查询", "失败"], ["失败原因", info.error],
        ...(is4 ? [["Worker 独立请求出口 IP（对照）",workerIp || "未提供"]] : [])
      ], "地址已经检测到；失败的是归属信息查询。可以稍后重试。");
      return;
    }
    const geo = info.geo || {};
    const rdap = info.rdap || {};
    showDetail(is4 ? "IPv4 地址归属与注册信息" : "IPv6 地址归属与注册信息", [
      ["浏览器检测到的 IP",address],
      ...(is4 ? [["Worker 独立请求出口 IP（对照）",workerIp || "未提供"]] : []),
      ["国家 / 地区",geo.country || "数据库未返回"],
      ["省 / 州",geo.region || "数据库未返回"],
      ["城市",geo.city || "数据库未返回"],
      ["邮政编码",geo.postal || "数据库未返回"],
      ["时区",geo.timezone || "数据库未返回"],
      ["ASN",geo.asn || rdap.asn || "数据库未返回"],
      ["网络组织",geo.org || rdap.name || "数据库未返回"],
      ["运营商 / 网络提供商",geo.isp || geo.org || "数据库未返回"],
      ["IP 地址段",geo.network || rdap.cidr || rdap.handle || "注册库未返回"],
      ["注册机构",rdap.registry || "未提供"],
      ["注册实体",rdap.name || "未提供"],
      ["查询来源",[info.sources?.geo,info.sources?.rdap].filter(Boolean).join(" + ") || "多源查询"],
      ...(info.errors?.geo?.length ? [["查询诊断",info.errors.geo.join("；")]] : [])
    ], `浏览器检测到的地址才是本页对应的 ${is4 ? "IPv4" : "IPv6"} 查询对象。Worker 独立请求出口 IP 是另一条连接观察到的地址，不代表本页的 ${is4 ? "IPv4" : "IPv6"}。地理位置来自 IP 数据库估算；RDAP 描述地址段注册信息。${info.errors?.geo?.length ? "归属数据库诊断：" + info.errors.geo.join("；") : ""}`);
    return;
  }
  if (type === "dns") {
    showDetail("DNS 泄漏检测", [
      ["检测机制", "唯一随机子域名 + Cloudflare DNS Analytics"],
      ["服务状态", "检查配置中"],
      ["当前公网出口", state.data.ip || "未知"]
    ], "测试会触发浏览器解析本次专属随机域名，再通过 Cloudflare DNS Analytics 查询权威 DNS 观察到的递归解析器来源 IP。首次使用前需在 Worker 配置只读 Analytics Token、Zone ID 和测试子域。");
    const controls = document.createElement("div");
    controls.className = "dns-test-controls";
    controls.innerHTML = `<button id="startDnsLeakTest" class="primary-btn" type="button">开始真实 DNS 泄漏测试</button><div id="dnsLeakStatus" class="dns-inline-result">点击开始后，浏览器将解析一个一次性随机域名。</div>`;
    $("detailBody").appendChild(controls);
    $("startDnsLeakTest").addEventListener("click", runDnsLeakTest);
    return;
  }
  if (type === "http3") {
    showDetail("HTTP/3 协议检测", [
      ["当前 API 请求协议",state.worker?.httpProtocol || "未知"],
      ["HTTP/3",state.worker?.httpProtocol === "HTTP/3" ? "本次请求使用 HTTP/3" : "本次请求未使用 HTTP/3"],
      ["TLS 版本",cf.tlsVersion || "未知"],
      ["Cloudflare 节点",cf.colo || "未知"]
    ], "这里只能判断浏览器访问本站 Worker 时实际协商的协议；当前请求使用 HTTP/2，不代表其他网站不支持 HTTP/3。");
    return;
  }
  if (type === "cdn") {
    showDetail("Cloudflare / CDN 连接详情", [
      ["Worker 状态",state.worker ? "已连接" : "未连接"],
      ["边缘节点",cf.colo],
      ["国家",cf.country],["城市",cf.city],
      ["HTTP 协议",state.worker?.httpProtocol],
      ["TLS 版本",cf.tlsVersion],
      ["ASN",cf.asn],["网络组织",cf.asOrganization],
      ["出口 IP",ip]
    ], "这些信息描述的是访问本站 Worker 时的 Cloudflare 节点和出口网络，不一定代表访问其他网站时的网络路径。");
  }
}

async function runDnsLeakTest() {
  const button = $("startDnsLeakTest");
  const output = $("dnsLeakStatus");
  button.disabled = true;
  output.textContent = "正在创建一次性测试域名…";
  try {
    const start = await fetch(`${getWorkerUrl()}/api/dns-test/start`, { method:"POST", cache:"no-store" });
    const test = await start.json();
    if (!start.ok || !test.ok) throw new Error(test.error || "DNS 测试服务尚未配置");
    output.textContent = `正在触发解析：${test.qname}。随后查询 Cloudflare DNS Analytics，最多等待 60 秒…`;
    // Force a real network request to a unique hostname. Unlike dns-prefetch,
    // browsers may silently skip speculative prefetches; a fetch starts name resolution.
    // The hostname intentionally has no web service: a network failure is expected.
    const probeController = new AbortController();
    const probeTimer = setTimeout(() => probeController.abort(), 7000);
    try {
      await fetch(`https://${test.qname}/__who_checker_dns_probe__`, {
        mode: "no-cors", credentials: "omit", cache: "no-store",
        signal: probeController.signal
      });
    } catch (_) {
      // Expected for an unconfigured random hostname; DNS resolution was still attempted.
    } finally {
      clearTimeout(probeTimer);
    }
    output.textContent = `已触发随机域名的实际网络请求：${test.qname}。正在查询 Cloudflare DNS Analytics，最多等待 90 秒…`;
    const started = Date.now();
    let result = null;
    while (Date.now() - started < 90000) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const response = await fetch(`${getWorkerUrl()}/api/dns-test/result?qname=${encodeURIComponent(test.qname)}&startedAt=${encodeURIComponent(test.startedAt)}`, { cache:"no-store" });
      result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Cloudflare DNS Analytics 查询失败");
      if (result.observed) break;
    }
    if (!result?.observed) {
      output.textContent = result?.note || "已触发随机域名解析，但 Cloudflare DNS Analytics 暂未记录。可能存在数据延迟，或浏览器未执行 DNS 预取，请稍后重试。";
      return;
    }
    const observations = result.observations || [];
    const enriched = await Promise.all(observations.map(async item => {
      const geo = await lookupIp(item.ip);
      return {...item, country:geo?.geo?.country || item.country, org:geo?.geo?.org || item.org, asn:geo?.geo?.asn || item.asn};
    }));
    const lines = enriched.map((item,i)=>`<div class="detail-row"><span>递归解析器 ${i+1}</span><b>${escapeHtml(item.ip)} · ${escapeHtml(item.country || "地区未知")} · ${escapeHtml(item.org || "组织未知")} ${item.asn ? "· "+escapeHtml(item.asn) : ""}</b></div>`).join("");
    const sameCountry = enriched.some(x => x.country && state.worker?.cf?.country && x.country === state.worker.cf.country);
    output.innerHTML = `<b>已收到 Cloudflare 权威 DNS 查询记录</b>${lines}<p class="detail-note">浏览器网页出口：${escapeHtml(state.data.ip || "未知")}。DNS 解析器来源 IP 是递归 DNS 的出口，不一定与用户所在地或 VPN 出口一致。${sameCountry ? "至少一个解析器的国家与网页出口国家相同。" : "解析器国家与网页出口国家存在差异或信息不足，建议结合 ASN 和网络策略判断。"}国家差异本身不等于 DNS 泄漏；还需结合你预期的 VPN / 网络策略判断。</p>`;
  } catch (error) {
    output.textContent = `DNS 泄漏测试暂不可用：${error?.message || "请求失败"}。请检查 Worker 的 Cloudflare DNS Analytics Token、Zone ID 和测试子域配置。`;
  } finally { button.disabled = false; }
}

function renderAnalysis(report) {
  const good = [];
  const advice = [];

  if (report.worker) good.push("后端接口已连接，能够读取本次请求的公网出口 IP 和 Cloudflare 网络信息。");
  else advice.push("后端接口暂不可用：检查 api.wscldyr.com 的 Worker 部署、域名绑定和网络连接；浏览器本地检测仍可继续。");

  if (report.ip) good.push(`已获取公网出口 IP：${report.ip}。`);
  else advice.push("暂未获取公网 IP：检查当前网络是否允许访问 IP 查询服务。");

  if (report.ipv4) good.push("IPv4 公网连通性测试成功。");
  else advice.push("IPv4 地址未确认：可能是当前网络仅提供 IPv6、代理策略限制，或测试服务不可达。");

  if (report.ipv6) good.push("IPv6 公网连通性测试成功。");
  else advice.push("未检测到可用 IPv6：如果你希望使用 IPv6，可在路由器/网络服务商处确认 IPv6 是否已开通；不需要 IPv6 时可以忽略。");

  if (report.webrtcAvailable) {
    good.push("浏览器支持 WebRTC，并已尝试通过 STUN 收集 ICE 候选地址。");
    if (report.webrtcState === "受限" || report.webrtcState === "未收集到候选地址") {
      advice.push("STUN / ICE 未收集到候选地址。可能是 UDP 被网络屏蔽、STUN 服务不可达或浏览器策略限制；不能据此判断没有泄漏。");
    } else if (report.webrtcDifferentEgress > 0) {
      advice.push(`发现 ${report.webrtcDifferentEgress} 个 STUN 公网映射地址与网页出口 IP 不同。建议检查 VPN 是否覆盖 WebRTC / UDP 流量，并使用其他网络复测。`);
    } else if (report.webrtcSrflx > 0) {
      good.push("已获取 STUN 映射地址，且未发现与网页出口 IP 不同的公网映射地址。");
    } else {
      advice.push("本次没有获得公网 srflx 映射地址。请注意：这可能是浏览器或网络限制，不代表 WebRTC 一定安全。");
    }
  } else {
    advice.push("浏览器未提供 WebRTC API，部分网页实时音视频功能可能受影响。");
  }
  advice.push("DNS 泄漏检测已加入 Cloudflare DNS Analytics 随机域名探测；若尚未配置 Analytics Token 或未取得查询记录，页面会明确提示，不能据此判定无泄漏。");

  if (report.webgl) good.push("WebGL 可用，网页图形渲染能力正常。");
  else advice.push("WebGL 不可用：检查浏览器硬件加速设置和显卡驱动；部分 3D 网页可能无法正常显示。");

  if (report.fontCount > 0) good.push(`检测到 ${report.fontCount} 种常见字体，字体检测正常。`);
  else advice.push("字体检测未获得结果，可能受浏览器隐私防护限制；这不影响大多数网页使用。");

  if (report.tls) good.push(`与本站 Worker 的连接使用 ${report.tls}。`);
  if (report.http) good.push(`与本站 Worker 的连接使用 ${report.http}。`);
  if (report.worker && report.cf?.asOrganization) {
    good.push(`出口网络登记组织为 ${report.cf.asOrganization}（ASN ${report.cf.asn || "未知"}）；这可能是代理/VPN 出口，不一定是本地宽带运营商。`);
  }

  if (report.secure) good.push("当前页面处于安全上下文（HTTPS 或 localhost）。");
  else advice.push("当前页面不是安全上下文。正式部署请使用 HTTPS；部分浏览器 API 在非安全页面会受限。");

  if (!report.connectionApi) {
    advice.push("浏览器未提供 Network Information API，因此无法读取连接类型、估算 RTT 和下行速率；这是浏览器支持差异，不代表网络异常。");
  }

  const score = Math.round([
    report.worker, !!report.ip, report.ipv4, report.ipv6,
    report.webrtcAvailable, report.webgl, report.fontCount > 0, report.secure
  ].filter(Boolean).length / 8 * 100);

  $("analysisIcon").textContent = advice.length === 0 ? "✓" : (good.length >= 4 ? "i" : "!");
  $("analysisTitle").textContent = advice.length === 0 ? "当前检测项目表现良好" : "环境总体可用，存在可优化项目";
  $("analysisSummary").textContent = `本次检测通过 ${good.length} 项观察，整理出 ${advice.length} 条可关注建议。这里评估的是浏览器与网络能力，不是对设备安全性的评分。`;
  $("reportStatus").textContent = `分析完成 · ${good.length} 项正常 · ${advice.length} 条建议`;
  $("analysisGood").innerHTML = good.length
    ? good.map(item => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>暂未发现可确认的正常项目。</li>";
  $("analysisAdvice").innerHTML = advice.length
    ? advice.map(item => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>暂时没有需要特别处理的项目。</li>";
}

async function probeIPv6() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch("https://api6.ipify.org?format=json", { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    return data.ip || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runScan() {
  const b = browserInfo();
  const nav = navigator;
  const scr = screen;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const fonts = detectFonts();
  const webgl = webglFingerprint();

  state.data.browser = b;

  // Worker、Audio、WebRTC 三项互不依赖，並行检测，避免页面长时间卡在“检测中”。
  const [workerResult, audioResult, webrtcResult] = await Promise.all([
    fetchWorker(),
    audioFingerprint(),
    webrtcDetect()
  ]);

  state.worker = workerResult;
  state.data.workerIp = workerResult?.ip || "";
  const workerConfigured = !!getWorkerUrl();
  $("modeBadge").textContent = state.worker
    ? "Worker 在线"
    : (workerConfigured ? "Worker 连接失败" : "本地测试");
  $("ipMode").textContent = state.worker ? "Worker 已连接" : "本地模式";
  $("publicIp").textContent = "检测中…";

  const ip = await getPublicIp();
  state.data.ip = ip;
  state.data.ipv4 = ip && /^\d+\./.test(ip) ? ip : "";
  $("publicIp").textContent = safe(ip, "暂未获取");

  const cf = state.worker?.cf || {};
  $("ipMode").textContent = state.worker ? "Worker 已连接" : (ip ? "公开 IP API" : "本地模式");
  $("geoText").textContent = state.worker
    ? [cf.city, cf.region, cf.country, cf.asOrganization].filter(Boolean).join(" · ") || "已连接 Worker"
    : ip ? "通过公开 IP 服务获取" : "部署 Worker 后可获得更多服务器信息";

  $("networkSummary").innerHTML = [
    ["公网 IP", ip || "未知"],
    ["国家/地区", cf.country || "需 Worker"],
    ["ASN", cf.asn || "需 Worker"],
    ["ISP", cf.asOrganization || "需 Worker"]
  ].map(([k,v]) => `<div class="summary-item"><span>${escapeHtml(k)}</span><b title="${escapeHtml(v)}">${escapeHtml(v)}</b></div>`).join("");

  addRows("browserDetails", [
    ["浏览器", `${b.browser} ${b.version}`],
    ["平台", b.platform],
    ["语言", nav.language],
    ["语言列表", (nav.languages || []).join(", ")],
    ["User-Agent", b.ua],
    ["时区", Intl.DateTimeFormat().resolvedOptions().timeZone],
    ["时间格式区域", Intl.DateTimeFormat().resolvedOptions().locale],
    ["在线状态", nav.onLine ? "在线" : "离线"],
    ["Cookie", nav.cookieEnabled ? "已启用" : "已禁用"],
    ["Do Not Track", nav.doNotTrack || "未设置"],
    ["Secure Context", window.isSecureContext ? "是" : "否"]
  ]);

  addRows("deviceDetails", [
    ["屏幕", `${scr.width} × ${scr.height}`],
    ["可用屏幕", `${scr.availWidth} × ${scr.availHeight}`],
    ["窗口", `${innerWidth} × ${innerHeight}`],
    ["设备像素比", devicePixelRatio],
    ["CPU 核心", nav.hardwareConcurrency],
    ["设备内存", nav.deviceMemory ? `${nav.deviceMemory} GB` : "浏览器未提供"],
    ["触摸点", nav.maxTouchPoints],
    ["平台", b.platform],
    ["方向", matchMedia("(orientation:landscape)").matches ? "横屏" : "竖屏"]
  ]);

  let storage = "可用";
  try { localStorage.setItem("__who_test", "1"); localStorage.removeItem("__who_test"); }
  catch { storage = "不可用"; }

  addRows("privacyDetails", [
    ["JavaScript", "可用"],
    ["WebGL", webgl.fp === "不可用" ? "不可用" : "可用"],
    ["WebRTC", window.RTCPeerConnection ? "可用" : "不可用"],
    ["Clipboard API", navigator.clipboard ? "可用" : "不可用"],
    ["Notifications", "Notification" in window ? "可用" : "不可用"],
    ["Service Worker", "serviceWorker" in navigator ? "可用" : "不可用"],
    ["Local Storage", storage],
    ["IndexedDB", "indexedDB" in window ? "可用" : "不可用"],
    ["Fetch", "fetch" in window ? "可用" : "不可用"],
    ["WebSocket", "WebSocket" in window ? "可用" : "不可用"]
  ]);

  const netItems = [
    ["连接类型", conn?.effectiveType || "浏览器未提供"],
    ["下行估计", conn?.downlink ? `${conn.downlink} Mbps` : "浏览器未提供"],
    ["RTT", conn?.rtt ? `${conn.rtt} ms` : "浏览器未提供"],
    ["省流模式", conn?.saveData ? "开启" : "关闭"],
    ["Referrer", document.referrer || "无"],
    ["协议", location.protocol],
    ["页面来源", location.origin]
  ];

  if (state.worker) {
    netItems.push(
      ["Cloudflare 节点", cf.colo],
      ["TLS", cf.tlsVersion],
      ["HTTP 协议", state.worker.httpProtocol],
      ["国家/地区", cf.country],
      ["城市", cf.city],
      ["ASN", cf.asn],
      ["运营商", cf.asOrganization],
      ["请求 UA", state.worker.headers?.["user-agent"]]
    );
  }
  addRows("networkDetails", netItems);

  const canvasFp = canvasFingerprint();
  $("canvasFp").textContent = canvasFp;
  $("webglFp").textContent = webgl.fp;
  $("fontFp").textContent = `${fonts.count} 个 · ${hash(fonts.list.join("|"))}`;
  state.audioFp = audioResult;
  $("audioFp").textContent = state.audioFp;

  const wr = webrtcResult;
  $("webrtcState").textContent = wr.state;
  $("webrtcInfo").textContent = wr.info;

  $("ipv4State").textContent = ip && /^\d+\./.test(ip) ? "可用" : "未确认";
  $("ipv4Info").textContent = ip && /^\d+\./.test(ip) ? ip : "未获取公网 IPv4";

  const ipv6 = await probeIPv6();
  state.data.ipv6 = ipv6 || "";
  state.data.webrtc = wr;
  $("ipv6State").textContent = ipv6 ? "可用" : "不可用 / 未确认";
  $("ipv6Info").textContent = ipv6 || "当前网络未能连接 IPv6 测试服务";

  $("cdnState").textContent = state.worker ? "已连接" : "本地模式";
  $("cdnInfo").textContent = state.worker
    ? `Cloudflare ${cf.colo || "Edge"} · ${safe(state.worker.httpProtocol, "协议未知")}`
    : "部署 Worker 后显示";

  $("http3State").textContent = state.worker?.httpProtocol === "HTTP/3" ? "可用" : "需服务器判断";
  $("dnsState").textContent = state.worker ? "可发起真实探测" : "需连接 Worker";

  const combined = [
    canvasFp, webgl.fp, state.audioFp, fonts.list.join(","),
    b.ua, nav.language, scr.width, scr.height, nav.hardwareConcurrency,
    devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone
  ].join("|");
  $("overallFp").textContent = hash(combined);

  const checks = [
    !!nav.userAgent, !!scr.width, !!window.WebGLRenderingContext,
    !!window.RTCPeerConnection, !!window.fetch, fonts.count > 0,
    webgl.fp !== "不可用"
  ];
  const score = Math.round(checks.filter(Boolean).length / checks.length * 100);
  $("score").textContent = score;
  $("scoreText").textContent = score >= 80 ? "环境完整" : "部分能力受限";
  $("scoreMeter").style.width = `${score}%`;
  $("scoreDesc").textContent = score >= 80
    ? "浏览器检测能力较完整"
    : "部分浏览器能力受到隐私设置限制";
  renderAnalysis({
    worker: !!state.worker,
    ip,
    ipv4: !!(ip && /^\d+\./.test(ip)),
    ipv6: !!ipv6,
    webrtcAvailable: !!window.RTCPeerConnection,
    webrtcState: wr.state,
    webrtcDifferentEgress: (wr.parsed || []).filter(x => x.type === "srflx" && x.classification.includes("公网") && state.data.ip && x.address !== state.data.ip).length,
    webrtcSrflx: wr.srflxCount || 0,
    webgl: webgl.fp !== "不可用",
    fontCount: fonts.count,
    tls: cf.tlsVersion || null,
    http: state.worker?.httpProtocol || null,
    cf,
    secure: window.isSecureContext,
    connectionApi: !!conn
  });

  $("browserState").textContent = "完成";
  $("networkState").textContent = conn ? "完成" : "部分";
  $("fingerState").textContent = "完成";
  $("scanStatus").textContent = state.worker
    ? "浏览器 + Worker 网络信息检测完成"
    : "浏览器环境检测完成，可连接 Worker 获取更多网络信息";
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.add("tool-highlight");
  setTimeout(() => target.classList.remove("tool-highlight"), 1300);
}

async function runDnsLookup() {
  const name = $("dnsName").value.trim();
  const type = $("dnsType").value;
  const output = $("dnsResult");
  if (!name) { output.textContent = "请先输入域名。"; return; }
  output.textContent = "正在查询…";
  $("runDns").disabled = true;
  try {
    const response = await fetch(`${getWorkerUrl()}/api/dns?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    const data = await response.json();
    if (!response.ok || data.Status !== 0) throw new Error(data.error || `查询失败（HTTP ${response.status}）`);
    const answers = data.Answer || [];
    if (!answers.length) { output.textContent = `查询完成：${name} 没有返回 ${type} 记录。`; return; }
    output.innerHTML = `<div class="dns-meta">${escapeHtml(name)} · ${escapeHtml(type)} · ${answers.length} 条记录</div>` +
      answers.map(item => `<div class="dns-answer"><span>${escapeHtml(item.name || name)}</span><b>${escapeHtml(item.data || "")}</b><small>TTL ${Number(item.TTL) || "—"}</small></div>`).join("");
  } catch (error) {
    output.textContent = `查询失败：${error.message || "网络错误"}`;
  } finally { $("runDns").disabled = false; }
}

document.querySelectorAll("[data-detail]").forEach(button => {
  button.addEventListener("click", () => openCapabilityDetail(button.dataset.detail));
});
$("closeDetail").addEventListener("click", () => { $("detailPanel").hidden = true; });

async function main() {
  await runScan();
}

$("refreshBtn").onclick = () => location.reload();

$("copyIpBtn").onclick = async () => {
  const v = $("publicIp").textContent;
  if (v && v !== "暂未获取") {
    try {
      await navigator.clipboard.writeText(v);
      $("copyIpBtn").textContent = "已复制";
      setTimeout(() => $("copyIpBtn").textContent = "复制 IP", 1200);
    } catch {}
  }
};

$("toggleDetails").onclick = () => {
  document.querySelectorAll(".rows").forEach(x => {
    x.style.display = x.style.display === "none" ? "" : "none";
  });
  $("toggleDetails").textContent =
    $("toggleDetails").textContent === "收起全部" ? "展开全部" : "收起全部";
};


main().catch(e => {
  $("scanStatus").textContent = "检测完成，但部分项目不可用";
  console.error(e);
});
