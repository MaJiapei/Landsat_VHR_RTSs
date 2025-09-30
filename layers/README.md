# 图层数据复制说明

## 需要复制的文件

请按以下步骤复制 QGIS 导出的数据文件：

### 1. 复制 PredictedRTS 数据
将文件：
```
E:\work\热融滑塌提取-青藏高原\web\qgis2web_2025_09_17-15_56_21_833473\layers\PredictedRTS_4.js
```

复制到：
```
frontend\layers\PredictedRTS.js
```

然后打开 `PredictedRTS.js`，将变量名从 `json_PredictedRTS_4` 改为 `json_PredictedRTS`

### 2. 复制 XiadataRTS 数据
将文件：
```
E:\work\热融滑塌提取-青藏高原\web\qgis2web_2025_09_17-15_56_21_833473\layers\Xiadatain2022_3.js
```

复制到：
```
frontend\layers\XiadataRTS.js
```

然后打开 `XiadataRTS.js`，将变量名从 `json_Xiadatain2022_3` 改为 `json_XiadataRTS`

## 变量名修改示例

原文件中的：
```javascript
var json_PredictedRTS_4 = {
  "type": "FeatureCollection",
  ...
}
```

改为：
```javascript
var json_PredictedRTS = {
  "type": "FeatureCollection",
  ...
}
```

## 注意事项

- 文件可能比较大，请耐心等待复制完成
- 确保文件编码为 UTF-8
- 如果数据文件过大导致浏览器加载缓慢，可以考虑使用后端 API 动态加载数据

