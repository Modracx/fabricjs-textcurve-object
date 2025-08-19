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
        startAngle: 180,

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
            this.startAngle = options.startAngle ?? 180;

            this.originX = options.originX ?? "left";
            this.originY = options.originY ?? "top";
            this._updateCurve();
        },

        set: function (key, value) {
            const changed = this.callSuper("set", key, value);
            if (
                ["text", "diameter", "fontSize", "kerning"].includes(key) &&
                !this.isEditing
            ) {
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
            let w = 0;
            for (let c of this.text) {
                w += ctx.measureText(c).width + this.kerning;
            }
            w = Math.round(w);
            const h = Math.round(this.fontSize * 1.2);

            this.set({ width: w, height: h });
        },

        _updateCurve: function () {
            const rawCanvas = this._createCurvedTextCanvas();
            const trimmed = this._trimCanvas(rawCanvas);
            this._renderedCanvas = trimmed;

            this._offsetX = trimmed._offsetX || 0;
            this._offsetY = trimmed._offsetY || 0;

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

            if (arcF === 0) {
                let tw = 0;
                for (let ch of text) tw += ctx.measureText(ch).width + k;
                const h = fs * 1.2;
                cEl.width = Math.round(tw);
                cEl.height = Math.round(h);
                ctx.font = this._getFontDeclaration();
                ctx.fillStyle = this.fill;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                for (let i = 0, x = 0; i < text.length; i++) {
                    const ch = text[i];
                    const wch = ctx.measureText(ch).width;
                    if (this.stroke && this.strokeWidth > 0) {
                        ctx.strokeStyle = this.stroke;
                        ctx.lineWidth = this.strokeWidth;
                        ctx.strokeText(ch, x, 0);
                    }
                    ctx.fillText(ch, x, 0);
                    x += wch + k;
                }
                return cEl;
            }

            let totalW = 0;
            for (let ch of text) totalW += ctx.measureText(ch).width + k;

            const arc = (Math.max(-100, Math.min(100, arcF)) / 100) * 2 * Math.PI;
            const radius = totalW / Math.abs(arc) || fs * 2;

            cEl.width = Math.round(radius * 4);
            cEl.height = Math.round(radius * 4);
            ctx.font = this._getFontDeclaration();
            ctx.fillStyle = this.fill;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.translate(cEl.width / 2, cEl.height / 2);
            ctx.rotate(-arc / 2);

            const angle = arc / text.length;

            for (let ch of text) {
                ctx.save();
                ctx.rotate(angle / 2);
                ctx.translate(0, -radius * (flipped ? -1 : 1));
                if (this.stroke && this.strokeWidth > 0) {
                    ctx.strokeStyle = this.stroke;
                    ctx.lineWidth = this.strokeWidth;
                    ctx.strokeText(ch, 0, 0);
                }
                ctx.fillText(ch, 0, 0);
                ctx.restore();
                ctx.rotate(angle);
            }

            return cEl;
        },

        _trimCanvas: function (canvas) {
            const ctx = canvas.getContext("2d");
            const w = canvas.width;
            const h = canvas.height;
            const data = ctx.getImageData(0, 0, w, h).data;

            let minX = w,
                minY = h,
                maxX = 0,
                maxY = 0,
                found = false;

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

            trimmed
                .getContext("2d")
                .putImageData(
                    ctx.getImageData(minX, minY, trimmedW, trimmedH),
                    0,
                    0
                );

            trimmed._offsetX = minX;
            trimmed._offsetY = minY;

            return trimmed;
        },

        _render: function (ctx) {
            if (this.isEditing) {
                this.callSuper("_render", ctx);
            } else {
                const c = this._renderedCanvas;
                const offsetX = this._offsetX || 0;
                const offsetY = this._offsetY || 0;
                ctx.drawImage(c, -this.width / 2, -this.height / 2);
            }
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