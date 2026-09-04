// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 YuanX1a0

globalThis.YXVehDetailConfig = {
    // 输入 /dl 开启或关闭附近载具信息。
    Command: 'dl',

    // 只处理玩家附近的载具，单位为游戏米。
    DrawDistance: 20.0,
    FadeStartDistance: 17.0,
    // 仅刷新候选车辆和文字内容；3D 位置始终逐帧实时读取。
    ScanIntervalMs: 200,
    // 原生 3D draw origin 每帧最多支持 32 个锚点。
    MaxLabels: 32,
    RequireLineOfSight: true,
    HideWhilePaused: true,

    Text: {
        Color: { r: 8, g: 169, b: 212, a: 255 },
        Font: 4,

        // 近距离上限、远距离下限及稳定距离缩放基准。
        WorldScale: 0.87,
        MinScale: 0.15,
        MaxScale: 0.34,
        ReferenceScale: 0.30,
        LineSpacing: 0.025,

        // 微调
        OffsetX: 0.0,
        OffsetY: 0.0,
        OffsetZ: 0.0,

        ShadowDistance: 2,
        EdgeSize: 2
    },

    Labels: {
        Rid: 'RID',
        Model: 'Model',
        Plates: 'Plates',
        Engine: 'Engine',
        Color: 'Color'
    }
};
