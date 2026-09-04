# yx_vehdetail

一个无框架依赖的 FiveM standalone 载具详情资源。

## 功能

- 输入 `/dl` 开启或关闭附近全部载具的双行 3D 信息。
- 第一行：`[RID: ... | Model: ... | Plates: ...]`
- 第二行：`[Engine: ... | Color: ...]`
- 文字位于每台载具模型包围盒的真实中心；每帧读取本地实体矩阵并使用原生 3D draw origin，高速移动和旋转时实时跟随。
- 使用青蓝色 `#08A9D4`、Font 4、黑色描边和阴影。
- 支持原版和 addon 载具的 spawn/model 名。
- 支持 GTA V 0–159 主色名称；自定义喷漆会匹配为最接近的 GTA V 颜色名称，界面不会显示 RGB 或十六进制值。
- 距离缩放、远端淡出、视线遮挡与载具缓存均已处理。

## 安装

1. 将整个 `yx_vehdetail` 文件夹放入服务器的 `resources` 目录。
2. 在 `server.cfg` 加入：

   ```cfg
   ensure yx_vehdetail
   ```

3. 进入服务器后输入 `/dl`。

资源只包含客户端 JavaScript，不需要 ESX、QBCore、ox_lib 或数据库。

## 字段说明

- `RID`：优先显示 FiveM 同步载具的 Net ID；本地非网络载具则显示客户端实体句柄。
- `Model`：直接读取载具 archetype，显示实际 spawn/model 名并转为大写。
- `Plates`：显示车牌并移除 GTA 自动补齐的首尾空格。
- `Engine`：直接读取 GTA 原生引擎耐久度，保留两位小数（通常完好值为 `1000.00`）。
- `Color`：显示主车身真实颜色名称，不显示副色；自定义喷漆也只显示名称。

## 调整

所有常用选项都在 `config.js`：

- `DrawDistance`：显示距离。
- `FadeStartDistance`：开始淡出的距离。
- `Text.Color`：文字 RGBA。
- `Text.MinScale` / `Text.MaxScale`：远近字体大小。
- `Text.LineSpacing`：两行间距。
- `Text.OffsetX/Y/Z`：相对载具中心的最终位置微调。

字号按玩家与载具的真实距离计算，不受高速追尾相机和动态 FOV 影响。

## 开源许可证

本项目采用 [GNU General Public License v3.0](LICENSE)，SPDX 标识为 `GPL-3.0-only`。
