# VideoBox 服务端

工具页面是静态网页；解析公开视频和传输下载文件需要运行这个服务端。服务调用本机安装的 `yt-dlp`，不读取 Cookie，也不接受登录信息，只允许 B 站、抖音、快手、西瓜、腾讯、爱奇艺和优酷的网页链接。

## 部署

1. 安装 Node.js 20+ 和最新版 `yt-dlp`，并确保终端中可以运行 `yt-dlp --version`。
2. 在此目录运行 `npm start`。默认监听 `8787` 端口。
3. 为生产环境设置 `ALLOWED_ORIGIN`，例如 `https://nonsense-maker.github.io`。
4. 将反向代理的 `/api/v1/` 转发到这个服务。若前端和服务不在同一域名，在页面之前设置 `window.VIDEOBOX_API_BASE = 'https://你的服务域名/api/v1'`。

服务不会下载需要登录、会员、DRM、付费或其他访问控制的内容。平台可用性会随其公开页面和流格式变化。
