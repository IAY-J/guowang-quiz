# JSON 题库生成提示词（直接复制使用）

请生成一份符合“国网通信刷题”导入格式的 JSON 题库，要求如下：

1. 只输出合法 JSON，不要用 Markdown 代码块包裹，不要输出任何额外文字。
2. 顶层结构固定为：

```json
{
  "title": "套题名称",
  "categories": [],
  "composite": { "name": "综合卷", "weights": {} },
  "questions": []
}
```

3. `categories` 只能使用以下 id 和名称：

| id | 名称 |
| --- | --- |
| xingce | 行测 |
| qiye | 企业文化 |
| tongxin | 通信原理 |
| guangxian | 光纤通信 |
| shujuwang | 数据通信网 |
| yidong | 移动通信及其他业务 |
| huiyi | 会议电视 |
| jiaohuan | 交换及接入 |

4. `composite.weights` 只能使用上述专业分类 id，值为正整数。按重点程度从大到小排列：通信原理 > 数据通信网 > 光纤通信 ≈ 移动通信及其他业务 > 交换及接入 > 会议电视。
5. 每题必须包含字段：`id`、`category`、`section`、`type`、`stem`、`options`、`answer`、`score`、`reason`；需要图片时额外加 `images` 数组。
6. `type` 只能是 `single`（单选）、`multiple`（多选）、`judge`（判断）。
7. `section` 只能从以下值中选择：`综合单选`、`专业单选`、`综合多选`、`专业多选`、`专业判断`、`资料分析`。
8. 答案格式：
   - 单选：`answer` 为单个字母，如 `"B"`
   - 多选：`answer` 为非空数组，如 `["A","C"]`
   - 判断：`options` 固定为 `["正确","错误"]`，`answer` 用 `true` 或 `false`
9. 每题必须写 `reason` 解析；`score` 用数字，单选/判断常用 `0.5`，多选常用 `1`。
10. 题目顺序按“单选 → 多选 → 判断”分组，组内顺序可以随机。
11. 需要图片时，把图片地址或 base64 放进 `images` 数组，也可以在题干或选项中用 `![说明](图片地址)`。
12. 生成后自检：JSON 可以解析、字段齐全、答案在选项范围内、`reason` 非空。

## 单题示例

```json
{
  "id": 1,
  "category": "tongxin",
  "section": "专业单选",
  "type": "single",
  "stem": "2PSK 与 2ASK 相比，抗噪声性能更好的是？",
  "options": ["2PSK", "2ASK", "2FSK", "相同"],
  "answer": "A",
  "score": 0.5,
  "reason": "2PSK 信号点间距离最大，抗噪声性能最好。",
  "images": []
}
```
