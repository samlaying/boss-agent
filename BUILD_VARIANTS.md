# Build Variants

Boss Agent现在用一个代码库维护两个产品变体：

- `social`: 社招版，开启自动沟通，关闭实习生硬过滤。
- `intern`: 实习生版，开启自动沟通和实习生硬过滤。

不要再用两个长期分支保存产品差异。通用修复直接进主干；产品差异放在 `variant.js` 的功能开关和 `scripts/build-variants.mjs` 的变体配置里。

## Commands

```bash
npm run build
npm run build:social
npm run build:intern
```

构建结果会输出到：

```text
dist/boss-agent-social/
dist/boss-agent-social.zip
dist/boss-agent-intern/
dist/boss-agent-intern.zip
```

开发时直接加载仓库根目录，会使用当前 `variant.js` 中的默认社招版配置。发布或分发时以 `dist/` 下的构建结果为准。
