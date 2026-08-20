# 题库 JSON 格式

题库数据直接嵌入 `bank-data.js` 作为默认可编辑题库，`sample-bank.json` 用于校验和导出，也支持在首页导入其他 JSON 题库。

## 顶层结构

```json
{
  "title": "套题名称",
  "categories": [
    {"id": "xingce", "name": "行测"},
    {"id": "qiye", "name": "企业文化"},
    {"id": "tongxin", "name": "通信原理"},
    {"id": "guangxian", "name": "光纤通信"},
    {"id": "shujuwang", "name": "数据通信网"},
    {"id": "yidong", "name": "移动通信及其他业务"},
    {"id": "huiyi", "name": "会议电视"},
    {"id": "jiaohuan", "name": "交换及接入"}
  ],
  "composite": {
    "name": "综合卷",
    "weights": {
      "tongxin": 5,
      "guangxian": 5,
      "shujuwang": 5,
      "jiaohuan": 3,
      "yidong": 2,
      "huiyi": 1
    }
  },
  "questions": []
}
```

`categories` 定义分类题库；`composite.weights` 决定综合卷从各专业分类抽题的权重。

## 题目字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 否 | 题号，省略时自动生成 |
| `category` | 是 | 所属分类，如 `tongxin`、`xingce`、`qiye` |
| `section` | 是 | 板块，如 `综合单选`、`专业单选`、`专业多选`、`专业判断`、`资料分析` |
| `type` | 是 | `single` 单选、`multiple` 多选、`judge` 判断 |
| `stem` | 是 | 题干 |
| `options` | 单选/多选必填 | 选项数组，顺序对应 A、B、C、D |
| `answer` | 是 | 单选填 `"B"`；多选填 `["A","C"]`；判断填 `true` 或 `false` |
| `score` | 否 | 分值，省略时默认 0.5 |
| `reason` | 是 | 解析/原因 |
| `images` | 否 | 题目图片数组，每项为图片地址或 base64；也支持 `image` 单图字段 |

判断题固定显示“正确 / 错误”。

题干和选项文本支持 Markdown 图片语法：`![图片说明](图片地址)`，页面会自动渲染图片。导入题库时直接带上 `images` 字段即可，编辑题库里也能填写和预览图片。

## 分类练习与综合卷

- 分类练习取该分类下的全部题目，保留每题原分值，只显示题型和分值。
- 综合卷固定包含全部综合单选、综合多选、资料分析，再按权重抽取专业单选、专业多选、专业判断。
- 每次进入综合卷会随机抽题。
