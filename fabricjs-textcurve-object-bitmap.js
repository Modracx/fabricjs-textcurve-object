/*!
 * textcurve object for fabric.js
 * Kenneth D'silva (Modracx), Copyright (c) June 2025
 * Licensed under the MIT License – https://opensource.org/licenses/MIT
 */
; (function (fabric) {
    fabric.TextCurve = fabric.util.createClass(fabric.IText, {
        type: "text-curve",

        diameter: 0,
        kerning: 0,
        flipped: false,
        startAngle: 0,

        cacheProperties: fabric.IText.prototype.cacheProperties.concat([
            "diameter",
            "kerning",
            "flipped",
            "startAngle",
        ]),

        initialize: function (text, options = {}) {
            this.callSuper("initialize", text, options);
            this.diameter = options.diameter ?? 0;
            this.kerning = options.kerning ?? 0;
            this.flipped = options.flipped ?? false;
            this.startAngle = options.startAngle ?? 0;

            this.originX = options.originX ?? "left";
            this.originY = options.originY ?? "top";
            this._updateCurve();
        },

        set: function (key, value) {
            const changed = this.callSuper("set", key, value);
            // Bug fixes: added startAngle + flipped (curve params) and all visual
            // properties — bitmap must be regenerated whenever appearance changes
            const triggerProps = [
                "text", "diameter", "fontSize", "kerning", "startAngle", "flipped",
                "fill", "stroke", "strokeWidth",
                "fontFamily", "fontStyle", "fontWeight",
                "underline", "linethrough", "overline",
            ];
            const shouldUpdate = typeof key === "object"
                ? Object.keys(key).some(k => triggerProps.includes(k))
                : triggerProps.includes(key);
            if (shouldUpdate && !this.isEditing) {
                this._updateCurve();
            }
            return changed;
        },

        enterEditing: function () {
            this.callSuper("enterEditing");
            this._updateFlatDimensions();
            this.setCoords();
        },

        exitEditing: function () {
            this.callSuper("exitEditing");
            this._updateCurve();
            this.setCoords();
            this.canvas?.requestRenderAll();
        },

        _updateFlatDimensions: function () {
            const canvasEl = fabric.util.createCanvasElement();
            const ctx = canvasEl.getContext("2d");
            ctx.font = this._getFontDeclaration();
            // Skip newlines; kerning is a gap between chars so (n-1) gaps
            const chars = this.text.split("").filter(c => c !== "\n");
            let w = 0;
            for (let i = 0; i < chars.length; i++) {
                w += ctx.measureText(chars[i]).width;
                if (i < chars.length - 1) w += this.kerning;
            }
            w = Math.round(w);
            const h = Math.round(this.fontSize * 1.2);
            this.set({ width: w, height: h });
        },

        _updateCurve: function () {
            const rawCanvas = this._createCurvedTextCanvas();
            const trimmed = this._trimCanvas(rawCanvas);
            this._renderedCanvas = trimmed;

            this.set({
                width: trimmed.width,
                height: trimmed.height,
            });
        },

        _createCurvedTextCanvas: function () {
            const text = this.text;
            const arcF = this.diameter;
            const flipped = this.flipped;
            const k = this.kerning;
            const fs = this.fontSize;
            const cEl = fabric.util.createCanvasElement();
            const ctx = cEl.getContext("2d");
            ctx.font = this._getFontDeclaration();

            // Skip newlines throughout
            const chars = text.split("").filter(c => c !== "\n");
            const n = chars.length;

            if (arcF === 0 || n === 0) {
                // Flat text: kerning is (n-1) gaps, not n
                let tw = 0;
                for (let i = 0; i < n; i++) {
                    tw += ctx.measureText(chars[i]).width;
                    if (i < n - 1) tw += k;
                }
                cEl.width = Math.round(tw) || 1;
                cEl.height = Math.round(fs * 1.2) || 1;
                ctx.font = this._getFontDeclaration();
                ctx.fillStyle = this.fill;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                let x = 0;
                for (let i = 0; i < n; i++) {
                    const ch = chars[i];
                    const wch = ctx.measureText(ch).width;
                    if (this.stroke && this.strokeWidth > 0) {
                        ctx.strokeStyle = this.stroke;
                        ctx.lineWidth = this.strokeWidth;
                        ctx.strokeText(ch, x, 0);
                    }
                    ctx.fillText(ch, x, 0);
                    x += wch + (i < n - 1 ? k : 0);
                }
                return cEl;
            }

            // Measure chars; kerning is (n-1) gaps
            const charWidths = chars.map(ch => ctx.measureText(ch).width);
            let totalW = charWidths.reduce((sum, w) => sum + w, 0);
            if (n > 1) totalW += k * (n - 1);

            const arc = (Math.max(-100, Math.min(100, arcF)) / 100) * 2 * Math.PI;
            const radius = Math.abs(totalW / arc) || fs * 2;

            // Canvas large enough to contain the full arc including glyph height
            const size = Math.round(2 * (radius + fs));
            cEl.width = size;
            cEl.height = size;
            ctx.font = this._getFontDeclaration();
            ctx.fillStyle = this.fill;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // dir = +1 → top arc (normal), dir = -1 → bottom arc (flipped).
            // Reversing direction keeps the first char at the same visual start position.
            // No extra rotate(π) — char tops naturally face the circle centre on both arcs.
            const dir = flipped ? -1 : 1;

            // Per-character angles proportional to actual glyph width
            const charAngles = charWidths.map((w, i) => {
                const wWithGap = w + (i < n - 1 ? k : 0);
                return (wWithGap / totalW) * arc;
            });

            ctx.translate(size / 2, size / 2);
            ctx.rotate((this.startAngle * Math.PI) / 180 - dir * arc / 2);

            for (let i = 0; i < n; i++) {
                const ch = chars[i];
                const angle = charAngles[i];
                ctx.save();
                ctx.rotate(dir * angle / 2);
                ctx.translate(0, -dir * radius);
                if (this.stroke && this.strokeWidth > 0) {
                    ctx.strokeStyle = this.stroke;
                    ctx.lineWidth = this.strokeWidth;
                    ctx.strokeText(ch, 0, 0);
                }
                ctx.fillText(ch, 0, 0);
                ctx.restore();
                ctx.rotate(dir * angle);
            }

            return cEl;
        },

        _trimCanvas: function (canvas) {
            const ctx = canvas.getContext("2d");
            const w = canvas.width;
            const h = canvas.height;
            const data = ctx.getImageData(0, 0, w, h).data;

            let minX = w, minY = h, maxX = 0, maxY = 0, found = false;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const alpha = data[(y * w + x) * 4 + 3];
                    if (alpha > 0) {
                        found = true;
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            if (!found) return canvas;

            const trimmedW = maxX - minX + 1;
            const trimmedH = maxY - minY + 1;

            const trimmed = fabric.util.createCanvasElement();
            trimmed.width = trimmedW;
            trimmed.height = trimmedH;

            trimmed.getContext("2d").putImageData(
                ctx.getImageData(minX, minY, trimmedW, trimmedH),
                0,
                0
            );

            return trimmed;
        },

        _render: function (ctx) {
            if (this.isEditing) {
                this.callSuper("_render", ctx);
                return;
            }
            const c = this._renderedCanvas;
            if (!c) return; // guard: bitmap not yet initialised
            ctx.drawImage(c, -this.width / 2, -this.height / 2);
        },

        toObject: function (props = []) {
            return this.callSuper("toObject", [
                "diameter",
                "kerning",
                "flipped",
                "startAngle",
                ...props,
            ]);
        },
    });

    fabric.TextCurve.fromObject = function (object, callback, forceAsync) {
        return fabric.Object._fromObject(
            "TextCurve",
            object,
            callback,
            forceAsync
        );
    };
})(typeof fabric !== 'undefined' ? fabric : require('fabric').fabric);
