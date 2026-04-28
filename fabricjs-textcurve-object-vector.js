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
            "radius",
            "angleSpan",
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

        // Handle both string-key and object-key forms of set()
        set: function (key, value) {
            const changed = this.callSuper("set", key, value);
            const curveProps = ["text", "diameter", "fontSize", "kerning", "startAngle", "flipped"];
            const shouldUpdate = typeof key === "object"
                ? Object.keys(key).some(k => curveProps.includes(k))
                : curveProps.includes(key);
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
            // Skip newlines; add kerning only between chars (n-1 gaps)
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
            const text = this.text;
            const fontSize = this.fontSize;
            const diameter = this.diameter;
            const kerning = this.kerning;
            const flipped = this.flipped;
            const startAngleRad = (this.startAngle * Math.PI) / 180;

            const ctx = fabric.util.createCanvasElement().getContext("2d");
            ctx.font = this._getFontDeclaration();

            // Skip newlines throughout
            const chars = text.split("").filter(c => c !== "\n");
            const n = chars.length;

            // diameter === 0 means flat text — avoid division-by-zero
            if (Math.abs(diameter) < 0.01 || n === 0) {
                this.radius = null;
                this.angleSpan = 0;
                this._charAngles = [];
                this._circleOffsetX = 0;
                this._circleOffsetY = 0;
                this._updateFlatDimensions();
                return;
            }

            // Measure chars; kerning is a gap between chars so (n-1) gaps
            const charWidths = chars.map(ch => ctx.measureText(ch).width);
            let totalWidth = charWidths.reduce((sum, w) => sum + w, 0);
            if (n > 1) totalWidth += kerning * (n - 1);

            const angleSpan = (Math.max(-100, Math.min(100, diameter)) / 100) * 2 * Math.PI;

            // isFinite guard: Infinity is truthy so "|| fallback" wouldn't fire for diameter=0
            const rawRadius = totalWidth / angleSpan;
            const radius = isFinite(rawRadius) && rawRadius !== 0
                ? Math.abs(rawRadius)
                : fontSize * 2;

            // Per-character angles proportional to actual glyph width (proportional fonts)
            const charAngles = charWidths.map((w, i) => {
                const wWithGap = w + (i < n - 1 ? kerning : 0);
                return (wWithGap / totalWidth) * angleSpan; // signed: preserves curve direction
            });

            // --- Tight bounding box -------------------------------------------------
            // dir drives the flip: +1 = normal (top arc), -1 = flipped (bottom arc).
            // Flipped reverses the traversal direction so the first char stays at the
            // same visual position, and translate(0, -dir*radius) moves the char to the
            // correct side. Character orientation follows naturally — no extra rotate(π).
            //
            // With rotation φ and translate(0, -dir*radius):
            //   x = dir·radius·sin(φ),  y = -dir·radius·cos(φ)
            const dir = flipped ? -1 : 1;
            const fontPad = fontSize * 0.5;
            let cumAngle = 0;
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;

            for (let i = 0; i < n; i++) {
                const phi = startAngleRad + dir * (-angleSpan / 2 + cumAngle + charAngles[i] / 2);
                const cx = dir * radius * Math.sin(phi);
                const cy = -dir * radius * Math.cos(phi);
                minX = Math.min(minX, cx - fontPad);
                maxX = Math.max(maxX, cx + fontPad);
                minY = Math.min(minY, cy - fontPad);
                maxY = Math.max(maxY, cy + fontPad);
                cumAngle += charAngles[i];
            }

            const width = Math.max(1, maxX - minX);
            const height = Math.max(1, maxY - minY);

            // Bounding-box centre in circle-relative coordinates
            const boxCenterX = minX + width / 2;
            const boxCenterY = minY + height / 2;

            // In _render, ctx starts at the object centre (= bounding-box centre).
            // Translate by negative of that to reach the circle centre before rotating.
            this._circleOffsetX = -boxCenterX;
            this._circleOffsetY = -boxCenterY;
            // -----------------------------------------------------------------------

            this._charAngles = charAngles;
            this.radius = radius;
            this.angleSpan = angleSpan;
            this.set({ width, height });
        },

        _render: function (ctx) {
            // radius === null signals flat / zero-diameter mode
            if (this.isEditing || this.radius === null) {
                this.callSuper("_render", ctx);
                return;
            }

            const text = this.text;
            const flipped = this.flipped;
            const startAngleDeg = this.startAngle;
            const angleSpan = this.angleSpan;
            const radius = this.radius;
            const charAngles = this._charAngles || [];

            // Skip newlines
            const chars = text.split("").filter(c => c !== "\n");

            ctx.save();

            ctx.font = this._getFontDeclaration();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = this.fill;

            // Move from bounding-box centre to circle centre, then rotate and draw.
            // dir = +1 → top arc (normal), dir = -1 → bottom arc (flipped).
            // Reversing direction keeps the first char at the same visual position.
            // No extra rotate(π) needed — char tops naturally face the circle centre.
            const dir = flipped ? -1 : 1;
            ctx.translate(this._circleOffsetX || 0, this._circleOffsetY || 0);
            ctx.rotate((startAngleDeg * Math.PI) / 180 - dir * angleSpan / 2);

            for (let i = 0; i < chars.length; i++) {
                const ch = chars[i];
                const angle = charAngles[i] ?? 0;
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

            ctx.restore();
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
