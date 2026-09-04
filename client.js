(function () {
    'use strict';

    var config = globalThis.YXVehDetailConfig;
    var colorNames = globalThis.YXVehicleColorNames;
    var colorRgb = globalThis.YXVehicleColorRgb;

    if (!config || !colorNames || !colorRgb) {
        throw new Error('yx_vehdetail: config.js or vehicle-colors.js was not loaded.');
    }

    var resourceName = GetCurrentResourceName();
    var enabled = false;
    var visibleVehicles = [];
    var modelNames = new Map();
    var modelCenterOffsets = new Map();
    var staticVehicleData = new Map();

    function numberOrZero(value) {
        value = Number(value);
        return Number.isFinite(value) ? value : 0.0;
    }

    function vector3(value) {
        if (Array.isArray(value)) {
            return {
                x: numberOrZero(value[0]),
                y: numberOrZero(value[1]),
                z: numberOrZero(value[2])
            };
        }

        if (value && typeof value === 'object') {
            return {
                x: numberOrZero(value.x !== undefined ? value.x : value[0]),
                y: numberOrZero(value.y !== undefined ? value.y : value[1]),
                z: numberOrZero(value.z !== undefined ? value.z : value[2])
            };
        }

        return { x: 0.0, y: 0.0, z: 0.0 };
    }

    function squaredDistance(a, b) {
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var dz = a.z - b.z;
        return (dx * dx) + (dy * dy) + (dz * dz);
    }

    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }

    function cleanText(value, fallback, maximumLength) {
        var text = value === undefined || value === null ? '' : String(value);
        text = text.replace(/[\r\n\t]+/g, ' ').replace(/~/g, '-').trim();

        if (!text) {
            text = fallback;
        }

        if (maximumLength && text.length > maximumLength) {
            text = text.slice(0, maximumLength);
        }

        return text;
    }

    function normalizeNativeArray(value) {
        if (Array.isArray(value)) {
            return value;
        }

        if (value && typeof value === 'object') {
            return Object.keys(value).map(function (key) {
                return value[key];
            });
        }

        return [];
    }

    function rebuildModelNameIndex() {
        var nextModelNames = new Map();

        if (typeof GetAllVehicleModels === 'function') {
            try {
                var registeredModels = normalizeNativeArray(GetAllVehicleModels());

                for (var index = 0; index < registeredModels.length; index += 1) {
                    var modelName = cleanText(registeredModels[index], '', 64);
                    if (!modelName) {
                        continue;
                    }

                    nextModelNames.set(GetHashKey(modelName) >>> 0, modelName.toUpperCase());
                }
            } catch (error) {
                console.warn('yx_vehdetail: unable to index registered vehicle models:', error);
            }
        }

        modelNames = nextModelNames;
        modelCenterOffsets.clear();
        staticVehicleData.clear();
    }

    function getModelName(vehicle, modelHash) {
        try {
            var archetypeName = cleanText(GetEntityArchetypeName(vehicle), '', 64);
            if (archetypeName) {
                return archetypeName.toUpperCase();
            }
        } catch (error) {
            // Older artifacts fall back to the registered model hash index below.
        }

        var unsignedHash = modelHash >>> 0;
        var indexedName = modelNames.get(unsignedHash);

        if (indexedName) {
            return indexedName;
        }

        try {
            var displayName = cleanText(GetDisplayNameFromVehicleModel(modelHash), '', 64);
            if (displayName && displayName !== 'CARNOTFOUND' && displayName !== 'NULL') {
                return displayName.toUpperCase();
            }
        } catch (error) {
            // The hexadecimal hash below is the final fallback.
        }

        return '0x' + unsignedHash.toString(16).toUpperCase().padStart(8, '0');
    }

    function getModelCenterOffset(modelHash) {
        var cacheKey = modelHash >>> 0;
        var cached = modelCenterOffsets.get(cacheKey);

        if (cached) {
            return cached;
        }

        var minimum = { x: 0.0, y: 0.0, z: 0.0 };
        var maximum = { x: 0.0, y: 0.0, z: 0.0 };

        try {
            var dimensions = GetModelDimensions(modelHash);

            if (Array.isArray(dimensions) && dimensions.length >= 6 && typeof dimensions[0] === 'number') {
                minimum = vector3(dimensions.slice(0, 3));
                maximum = vector3(dimensions.slice(3, 6));
            } else if (Array.isArray(dimensions) && dimensions.length >= 2) {
                minimum = vector3(dimensions[0]);
                maximum = vector3(dimensions[1]);
            } else if (dimensions && typeof dimensions === 'object') {
                minimum = vector3(dimensions.minimum || dimensions.min);
                maximum = vector3(dimensions.maximum || dimensions.max);
            }
        } catch (error) {
            // Entity origin is used if model dimensions are unavailable.
        }

        var center = {
            x: ((minimum.x + maximum.x) * 0.5) + config.Text.OffsetX,
            y: ((minimum.y + maximum.y) * 0.5) + config.Text.OffsetY,
            z: ((minimum.z + maximum.z) * 0.5) + config.Text.OffsetZ
        };

        modelCenterOffsets.set(cacheKey, center);
        return center;
    }

    function getStaticVehicleDataForEntity(vehicle) {
        var modelHash = GetEntityModel(vehicle);
        var cached = staticVehicleData.get(vehicle);

        if (cached && cached.modelHash === modelHash) {
            return cached;
        }

        var data = {
            modelHash: modelHash,
            modelName: getModelName(vehicle, modelHash),
            centerOffset: getModelCenterOffset(modelHash)
        };

        staticVehicleData.set(vehicle, data);
        return data;
    }

    function getRuntimeId(vehicle) {
        try {
            if (NetworkGetEntityIsNetworked(vehicle)) {
                var networkId = Number(NetworkGetNetworkIdFromEntity(vehicle));
                if (Number.isFinite(networkId) && networkId > 0) {
                    return Math.trunc(networkId);
                }
            }
        } catch (error) {
            // A local entity handle is still a valid runtime identifier.
        }

        return Math.trunc(Number(vehicle));
    }

    function getClosestVehicleColorName(red, green, blue) {
        red = clamp(numberOrZero(red), 0, 255);
        green = clamp(numberOrZero(green), 0, 255);
        blue = clamp(numberOrZero(blue), 0, 255);

        var closestName = 'Unknown';
        var closestDistance = Number.POSITIVE_INFINITY;

        for (var colorIndex = 0; colorIndex <= 159; colorIndex += 1) {
            var candidate = colorRgb[colorIndex];
            var candidateName = colorNames[colorIndex];

            if (!candidate || !candidateName) {
                continue;
            }

            var redMean = (red + candidate[0]) * 0.5;
            var redDifference = red - candidate[0];
            var greenDifference = green - candidate[1];
            var blueDifference = blue - candidate[2];

            // Perceptual weighted RGB distance; green differences carry more visual weight.
            var distance = ((2.0 + (redMean / 256.0)) * redDifference * redDifference) +
                (4.0 * greenDifference * greenDifference) +
                ((2.0 + ((255.0 - redMean) / 256.0)) * blueDifference * blueDifference);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestName = candidateName;
            }
        }

        return closestName;
    }

    function getVehicleColorName(vehicle) {
        try {
            if (GetIsVehiclePrimaryColourCustom(vehicle)) {
                var customRgb = normalizeNativeArray(GetVehicleCustomPrimaryColour(vehicle));
                if (customRgb.length >= 3) {
                    return getClosestVehicleColorName(customRgb[0], customRgb[1], customRgb[2]);
                }
            }

            var colors = normalizeNativeArray(GetVehicleColours(vehicle));
            var primaryColor = Math.trunc(numberOrZero(colors[0]));
            return colorNames[primaryColor] || ('Color ' + primaryColor);
        } catch (error) {
            return 'Unknown';
        }
    }

    function makeVehicleLines(vehicle, staticData) {
        var labels = config.Labels;
        var plate = cleanText(GetVehicleNumberPlateText(vehicle), 'N/A', 16);
        var engineHealth = numberOrZero(GetVehicleEngineHealth(vehicle)).toFixed(2);
        var rid = getRuntimeId(vehicle);
        var colorName = getVehicleColorName(vehicle);

        return {
            first: '[' + labels.Rid + ': ' + rid +
                ' | ' + labels.Model + ': ' + staticData.modelName +
                ' | ' + labels.Plates + ': ' + plate + ']',
            second: '[' + labels.Engine + ': ' + engineHealth +
                ' | ' + labels.Color + ': ' + colorName + ']'
        };
    }

    function scanVehicles() {
        if (!enabled) {
            visibleVehicles = [];
            return;
        }

        var playerPed = PlayerPedId();
        if (!playerPed || !DoesEntityExist(playerPed)) {
            visibleVehicles = [];
            return;
        }

        var playerPosition = vector3(GetEntityCoords(playerPed, false));
        var currentVehicle = GetVehiclePedIsIn(playerPed, false);
        var maximumDistanceSquared = config.DrawDistance * config.DrawDistance;
        var pool = normalizeNativeArray(GetGamePool('CVehicle'));
        var nextVisibleVehicles = [];
        var existingEntities = new Set();

        for (var index = 0; index < pool.length; index += 1) {
            var vehicle = Number(pool[index]);

            if (!vehicle || !DoesEntityExist(vehicle) || !IsEntityAVehicle(vehicle)) {
                continue;
            }

            existingEntities.add(vehicle);
            var vehiclePosition = vector3(GetEntityCoords(vehicle, false));
            var distanceSquared = squaredDistance(playerPosition, vehiclePosition);

            if (distanceSquared > maximumDistanceSquared) {
                continue;
            }

            if (config.RequireLineOfSight && vehicle !== currentVehicle && !HasEntityClearLosToEntity(playerPed, vehicle, 17)) {
                continue;
            }

            try {
                var staticData = getStaticVehicleDataForEntity(vehicle);
                var lines = makeVehicleLines(vehicle, staticData);

                nextVisibleVehicles.push({
                    entity: vehicle,
                    distanceSquared: distanceSquared,
                    centerOffset: staticData.centerOffset,
                    firstLine: lines.first,
                    secondLine: lines.second
                });
            } catch (error) {
                // The entity may have despawned between the existence check and native calls.
            }
        }

        // Retain the closest labels when the safety cap is reached.
        nextVisibleVehicles.sort(function (left, right) {
            return left.distanceSquared - right.distanceSquared;
        });

        visibleVehicles = nextVisibleVehicles
            .slice(0, Math.max(1, config.MaxLabels))
            // Draw distant labels first so a nearby label remains visually on top.
            .sort(function (left, right) {
                return right.distanceSquared - left.distanceSquared;
            });

        staticVehicleData.forEach(function (value, entity) {
            if (!existingEntities.has(entity) || !DoesEntityExist(entity)) {
                staticVehicleData.delete(entity);
            }
        });
    }

    function calculateTextScale(distance) {
        // Use a fixed reference FOV. Gameplay FOV and chase-camera distance both
        // fluctuate at speed and would otherwise make the label visibly breathe.
        var perspectiveScale = (config.Text.WorldScale / Math.max(distance, 1.0)) * 2.0 * (100.0 / 70.0);
        return clamp(perspectiveScale, config.Text.MinScale, config.Text.MaxScale);
    }

    function calculateAlpha(distance) {
        var baseAlpha = config.Text.Color.a;
        var fadeStart = clamp(config.FadeStartDistance, 0.0, config.DrawDistance);

        if (distance <= fadeStart || fadeStart >= config.DrawDistance) {
            return baseAlpha;
        }

        var remaining = 1.0 - ((distance - fadeStart) / (config.DrawDistance - fadeStart));
        return Math.round(baseAlpha * clamp(remaining, 0.0, 1.0));
    }

    function getRealtimeVehicleCenter(vehicle, offset) {
        try {
            // Native order: right, forward, up, position. The matrix is read on
            // every frame, so no cached/network sample is used for text position.
            var matrix = normalizeNativeArray(GetEntityMatrix(vehicle));
            if (matrix.length >= 4) {
                var right = vector3(matrix[0]);
                var forward = vector3(matrix[1]);
                var up = vector3(matrix[2]);
                var position = vector3(matrix[3]);

                return {
                    x: position.x + (right.x * offset.x) + (forward.x * offset.y) + (up.x * offset.z),
                    y: position.y + (right.y * offset.x) + (forward.y * offset.y) + (up.y * offset.z),
                    z: position.z + (right.z * offset.x) + (forward.z * offset.y) + (up.z * offset.z)
                };
            }
        } catch (error) {
            // Older artifacts use the per-frame native transform fallback.
        }

        return vector3(GetOffsetFromEntityInWorldCoords(
            vehicle,
            offset.x,
            offset.y,
            offset.z
        ));
    }

    function drawTextLine(text, localY, scale, alpha) {
        var textConfig = config.Text;

        SetTextScale(0.0, scale);
        SetTextFont(textConfig.Font);
        SetTextProportional(true);
        SetTextColour(textConfig.Color.r, textConfig.Color.g, textConfig.Color.b, alpha);
        SetTextCentre(true);
        SetTextDropshadow(textConfig.ShadowDistance, 0, 0, 0, 255);
        SetTextEdge(textConfig.EdgeSize, 0, 0, 0, 255);
        SetTextOutline();

        BeginTextCommandDisplayText('STRING');
        // GTA text components have a small per-component buffer on some game builds.
        for (var offset = 0; offset < text.length; offset += 90) {
            AddTextComponentSubstringPlayerName(text.slice(offset, offset + 90));
        }
        EndTextCommandDisplayText(0.0, localY);
    }

    function drawVehicleDetails(item, playerPosition) {
        var vehicle = item.entity;
        if (!DoesEntityExist(vehicle)) {
            return;
        }

        // Candidate metadata is cached, but its world position never is.
        var worldPosition = getRealtimeVehicleCenter(vehicle, item.centerOffset);
        // Player-to-vehicle distance is independent of the high-speed chase
        // camera, keeping the scale stable while the 3D anchor remains realtime.
        var distance = Math.sqrt(squaredDistance(playerPosition, worldPosition));

        if (distance > config.DrawDistance + 1.0) {
            return;
        }

        var screen = normalizeNativeArray(World3dToScreen2d(worldPosition.x, worldPosition.y, worldPosition.z));

        if (!screen[0]) {
            return;
        }

        var scale = calculateTextScale(distance);
        var alpha = calculateAlpha(distance);

        if (alpha <= 0) {
            return;
        }

        var lineSpacing = config.Text.LineSpacing * (scale / config.Text.ReferenceScale);
        SetDrawOrigin(worldPosition.x, worldPosition.y, worldPosition.z, 0);

        try {
            drawTextLine(item.firstLine, -(lineSpacing * 0.5), scale, alpha);
            drawTextLine(item.secondLine, lineSpacing * 0.5, scale, alpha);
        } finally {
            ClearDrawOrigin();
        }
    }

    RegisterCommand(config.Command, function () {
        enabled = !enabled;

        if (enabled) {
            scanVehicles();
        } else {
            visibleVehicles = [];
        }
    }, false);

    setTick(function () {
        if (!enabled || visibleVehicles.length === 0) {
            return;
        }

        if (config.HideWhilePaused && IsPauseMenuActive()) {
            return;
        }

        var playerPed = PlayerPedId();
        if (!playerPed || !DoesEntityExist(playerPed)) {
            return;
        }

        var playerPosition = vector3(GetEntityCoords(playerPed, false));
        var items = visibleVehicles;

        for (var index = 0; index < items.length; index += 1) {
            drawVehicleDetails(items[index], playerPosition);
        }
    });

    setInterval(scanVehicles, Math.max(50, config.ScanIntervalMs));

    on('onClientResourceStart', function (startedResource) {
        // Addon 载具资源后启动时，重新生成 hash -> spawn name 索引。
        if (startedResource === resourceName) {
            TriggerEvent('chat:addSuggestion', '/' + config.Command, '显示/隐藏附近载具详细信息');
        }

        setTimeout(rebuildModelNameIndex, 250);
    });

    on('onClientResourceStop', function (stoppedResource) {
        if (stoppedResource === resourceName) {
            TriggerEvent('chat:removeSuggestion', '/' + config.Command);
            return;
        }

        setTimeout(rebuildModelNameIndex, 250);
    });

    rebuildModelNameIndex();
}());
