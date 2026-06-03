# Boss 自动沟通日志服务

这个服务接收扩展上传的完整自动沟通日志，并按 JSONL 追加写入本地文件。

## 启动

```bash
cd /path/to/boss-agent
BOSS_LOG_TOKEN='换成你自己的长随机口令' node server/auto_apply_log_server.js
```

默认端口是 `17321`，日志文件在 `server/logs/auto_apply_logs.jsonl`。

## 扩展里填写

- URL: `http://服务器公网IP:17321/log`
- Token: 和 `BOSS_LOG_TOKEN` 一致

## 阿里云注意

- 轻量服务器防火墙和系统防火墙都需要放行端口 `17321`。
- 长期运行建议用 `systemd`、`pm2` 或部署在 Nginx 后面加 HTTPS。
- 不建议裸奔无 token；公网接口至少设置一个长随机 token。
