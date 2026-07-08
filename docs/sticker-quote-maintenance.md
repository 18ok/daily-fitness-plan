# 能量贴纸与语录维护说明

## 文件分工

- `src/data/stickerCatalog.js`：贴纸目录。新增贴纸、分类、适用场景时改这里。
- `src/data/quoteLibrary.js`：语录库。新增陪伴文案时改这里。
- `src/data/recommendQuote.js`：推荐规则。根据“夜班后、很累、白班”等状态决定推荐哪张贴纸。

## 新增一张贴纸

1. 把 PNG 放进 `assets/stickers/...` 对应目录。
2. 在 `src/data/stickerCatalog.js` 里导入图片。
3. 在 `stickerCatalog` 里新增一项：

```js
{
  id: 'new_sticker_id',
  label: '贴纸名字',
  category: '鼓励',
  src: newStickerImage,
  tone: 'pink',
  scene: '适合什么时候出现',
  quoteIds: ['quote_id_001'],
}
```

## 新增一条语录

在 `src/data/quoteLibrary.js` 里新增：

```js
{
  id: 'quote_id_001',
  scene: '夜班后',
  mood: '疲劳',
  text: '今天不用一下子变厉害，慢慢做完一点点，也是在认真照顾自己呀。',
}
```

## 文案语气规则

推荐：

- 慢慢来
- 做一点点也算数
- 身体舒服更重要
- 今天这样就很好啦
- 不用跟自己较劲

避免：

- 必须
- 自律
- 燃脂
- 暴瘦
- 管住嘴迈开腿
- 你不努力没人帮你

## 后续网络收集流程

网络内容只做参考，不直接复制。

1. 收集夜班恢复、女生健身小白、便利店饮食、情绪鼓励相关内容。
2. 提炼事实和表达方向。
3. 改写成项目自己的陪伴语气。
4. 放进 `quoteLibrary.js`。
5. 需要匹配贴纸时，在 `stickerCatalog.js` 的 `quoteIds` 里关联。
