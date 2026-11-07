# VideoBox 服务端

工具页面是静态网页；解析公开视频和传输下载文件需要运行这个服务端。服务调用本机安装的 `yt-dlp`，不读取 Cookie，也不接受登录信息，只允许 B 站、抖音、快手、西瓜、腾讯、爱奇艺和优酷的网页链接。

## 免费部署到 Render

仓库根目录的 `render.yaml` 已包含部署配置。登录 Render 后选择 **New +** → **Blueprint**，连接此 GitHub 仓库并创建服务即可。Render 会从 Dockerfile 安装 Node、FFmpeg 和最新版 `yt-dlp`，无需在本地安装任何程序。

默认服务名是 `nonsense-game-videobox`，网页已经指向 `https://nonsense-game-videobox.onrender.com/api/v1`。若 Render 提示该名称已被占用，请同时修改 `render.yaml` 中的 `name` 和 `tools/video-box/js/config.js` 中的网址，然后重新部署。

Render 的免费服务在 15 分钟无请求后休眠。首次解析可能需要约一分钟唤醒服务；后续访问正常响应。

服务不会下载需要登录、会员、DRM、付费或其他访问控制的内容。平台可用性会随其公开页面和流格式变化。
