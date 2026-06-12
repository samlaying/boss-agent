<template>
  <header class="app-header">
    <div class="header-row">
      <span class="dot"></span>
      <h3 class="title">✨ 微光</h3>
      <span class="badge">PRO</span>
    </div>
    <p class="subtitle">一款带夜视功能的职场翻译机</p>
  </header>
</template>

<script setup></script>

<style scoped>
.app-header { padding: 12px 16px; border-bottom: 1px solid rgba(0,190,189,0.2); }
.header-row { display: flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; background: #00bebd; border-radius: 50%; box-shadow: 0 0 8px #00bebd; }
.title { color: #333; font-family: 'Times New Roman', serif; font-size: 18px; margin: 0; }
.badge { background: rgba(0,190,189,0.1); color: #00bebd; border: 1px solid rgba(0,190,189,0.3); font-size: 10px; padding: 2px 6px; border-radius: 4px; }
.subtitle { font-size: 12px; color: #555; margin: 4px 0 0; }
</style>
