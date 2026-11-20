// 登录界面海浪动画模块（p5.js 生成，实例模式）
// 由 电子记事本.html 启动时自动加载；运行时依赖同目录 data/p5.min.js 先行加载。
// 参数可在 data/海浪交互可视化.html 中调节；随机种子保存在 localStorage.notepadLoginWaveSeed。
    // 登录界面海浪动画背景（p5.js 生成实例模式，参数可在 日志文件/海浪交互可视化.html 中调节）
    (function initLoginWave() {
        var container = document.getElementById('loginWaveCanvas');
        var overlay = document.getElementById('loginOverlay');
        if (!container || !overlay) return;

        var _waveParams = { seed: 20260928, layers: 8, waveSpeed: 0.28, amplitude: 58,
                            wavelength: 1.0, turbulence: 0.55, foam: 30,
                            colorPalette: ['#8fd3e8', '#2d8fc4', '#0d2b4b'] };
        var _p5inst = null, _t = 0, _foamSeeds = [], _deepBase = null, _midBase = null;
        var _WAVE_OPACITY = 0.5;   // 整片海浪统一透明度 50%
        var _FOAM_OPACITY = 1.0;   // 白点（泡沫）单独透明度，默认 100%

        try {
            if (typeof localStorage !== 'undefined') {
                var _saved = parseInt(localStorage.getItem('notepadLoginWaveSeed'), 10);
                if (_saved && _saved > 0) _waveParams.seed = _saved;
            }
        } catch (e) {}

        function _hexColor(hex) {
            var h = hex.replace('#', '');
            return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
        }

        function _deepToLight(inst, f) {
            var deep = inst.color(_waveParams.colorPalette[2]);
            var mid = inst.color(_waveParams.colorPalette[1]);
            var crest = inst.color(_waveParams.colorPalette[0]);
            if (f < 0.5) return inst.lerpColor(deep, mid, f / 0.5);
            return inst.lerpColor(mid, crest, (f - 0.5) / 0.5);
        }

        function _layerColor(inst, i, layers) {
            var f = i / Math.max(1, layers - 1);
            var r = _ridgeHeight(inst, inst.width * 0.5, i, layers, _t);
            var frac = Math.max(0, Math.min(1, (r.y + r.h) / inst.height));
            return _deepToLight(inst, frac);
        }

        function _ridgeHeight(inst, x, layer, layers, tt) {
            var depth = layer / Math.max(1, layers - 1);       // 0 顶 1 底
            var pad = _waveParams.amplitude * 1.15 + 20;
            var baseY = inst.map(layer, 0, layers - 1, pad, inst.height - pad * 0.45);
            var amp = _waveParams.amplitude * (0.45 + depth * 0.85);
            var wl = _waveParams.wavelength * (1.0 + depth * 0.55);
            var speed = _waveParams.waveSpeed * (0.5 + depth * 1.3);
            var phase = layer * 0.9;
            var y = Math.sin(x * 0.006 * wl + tt * speed * 0.9 + phase) * amp * 0.55
                  + Math.sin(x * 0.013 * wl - tt * speed * 1.4 + phase * 1.7) * amp * 0.30
                  + Math.sin(x * 0.028 * wl + tt * speed * 0.6 + phase * 2.3) * amp * 0.15;
            var nz = inst.noise(x * 0.0016 + layer * 3.7, tt * 0.05) - 0.5;
            y += nz * amp * _waveParams.turbulence * 1.6;
            return { y: baseY, h: y };
        }

        function _drawLayer(inst, layer, layers) {
            var col = _layerColor(inst, layer, layers);
            inst.noStroke();
            inst.fill(inst.red(col), inst.green(col), inst.blue(col), 255);
            inst.beginShape();
            inst.vertex(-40, inst.height + 40);
            for (var x = -40; x <= inst.width + 40; x += 12) {
                var r = _ridgeHeight(inst, x, layer, layers, _t);
                inst.vertex(x, r.y + r.h);
            }
            inst.vertex(inst.width + 40, inst.height + 40);
            inst.endShape(inst.CLOSE);
        }

        function _drawFoam(inst, layers) {
            if (!_foamSeeds.length) return;
            inst.noStroke();
            for (var i = 0; i < _foamSeeds.length; i++) {
                var p = _foamSeeds[i];
                var x = (p.x * inst.width + _t * 12 * p.drift) % (inst.width + 40) - 20;
                if (x < -20) x += inst.width + 40;
                var layer = Math.floor(p.depth * (layers - 1));
                var r = _ridgeHeight(inst, x, layer, layers, _t);
                var y = r.y + r.h + Math.sin(_t * 0.8 + p.phase) * 6 + (1 - p.depth) * 4;
                inst.fill(255, 255, 255, 255);
                inst.ellipse(x, y, p.size * (0.7 + p.depth), p.size * (0.45 + p.depth * 0.5));
            }
        }

        function _sketch(p) {
            p.setup = function () {
                p.createCanvas(p.windowWidth, p.windowHeight);
                p.randomSeed(_waveParams.seed);
                p.noiseSeed(_waveParams.seed);
                _t = 0;
                _deepBase = p.color(_waveParams.colorPalette[2]);
                _midBase = p.color(_waveParams.colorPalette[1]);
                _foamSeeds = [];
                var n = Math.floor(_waveParams.foam * 3);
                for (var i = 0; i < n; i++) {
                    _foamSeeds.push({
                        x: p.random(0, 1), phase: p.random(p.TWO_PI),
                        size: p.random(0.6, 2.6), drift: p.random(0.2, 1.0), depth: p.random(0.15, 1.0)
                    });
                }
                p.clear();
            };
            p.draw = function () {
                p.clear();
                var layers = Math.max(2, Math.round(_waveParams.layers));
                // 全屏底色（最深处），与波浪同透明度，取消天空与海平面分层
                p.noStroke();
                p.drawingContext.globalAlpha = _WAVE_OPACITY;
                var deep = p.color(_waveParams.colorPalette[2]);
                p.fill(p.red(deep), p.green(deep), p.blue(deep));
                p.rect(0, 0, p.width, p.height);
                // 整片海浪铺满屏幕，从下（浅）到上（深）逐渐加深
                for (var L = 0; L < layers; L++) _drawLayer(p, L, layers);
                // 白点（泡沫）单独透明度
                p.drawingContext.globalAlpha = _FOAM_OPACITY;
                _drawFoam(p, layers);
                p.drawingContext.globalAlpha = 1;
                // 按真实帧间隔推进时间，与帧率无关（低帧率设备如麒麟下仍匀速翻涌）
                var _dt = (typeof p.deltaTime === 'number' && p.deltaTime > 0) ? p.deltaTime : 16;
                if (_dt > 50) _dt = 50;   // 限制切后台/卡顿后的时间跳变
                _t += _dt * 0.001;
            };
            p.windowResized = function () {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
                p.clear();
            };
        }

        function _ensureP5(cb) {
            if (typeof window.p5 !== 'undefined') { cb(); return; }
            if (typeof document === 'undefined') return;
            // p5.js 已内联在本文件（见脚本顶部），此处仅在极旧环境兜底加载同目录 data/p5.min.js
            var s = document.createElement('script');
            s.src = 'data/p5.min.js';
            s.onload = cb;
            s.onerror = function () { /* 无内置 p5 时保留纯色背景，不影响登录 */ };
            (document.head || document.documentElement).appendChild(s);
        }

        window.notepadWave = {
            start: function () {
                try { overlay.classList.add('wave'); } catch (e) {}
                if (_p5inst) { try { _p5inst.loop(); } catch (e) {} return; }
                _ensureP5(function () {
                    try {
                        if (typeof window.p5 === 'undefined') return;
                        _p5inst = new window.p5(_sketch, container);
                    } catch (e) { _p5inst = null; }
                });
            },
            stop: function () {
                try { overlay.classList.remove('wave'); } catch (e) {}
                if (_p5inst) { try { _p5inst.noLoop(); } catch (e) {} }
            }
        };

        window.notepadWave.start();
    })();
