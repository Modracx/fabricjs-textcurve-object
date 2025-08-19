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
            this._updateBoundingBox();
        },

        set: function (key, value) {
            const changed = this.callSuper("set", key, value);
            if (
                [
                    "text",
                    "diameter",
                    "fontSize",
                    "kerning",
                    "startAngle",
                    "flipped",
                ].includes(key) &&
                !this.isEditing
            ) {
                this._updateBoundingBox();
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
            this._updateBoundingBox();
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

        _updateBoundingBox: function () {
            const text = this.text;
            const fontSize = this.fontSize;
            const diameter = this.diameter;
            const kerning = this.kerning;

            const ctx = fabric.util.createCanvasElement().getContext("2d");
            ctx.font = this._getFontDeclaration();

            let totalWidth = 0;
            for (let ch of text) {
                totalWidth += ctx.measureText(ch).width + kerning;
            }

            const angleSpan =
                (Math.max(-100, Math.min(100, diameter)) / 100) * 2 * Math.PI;
            const radius = Math.abs(totalWidth / angleSpan) || fontSize * 2;

            const width = 2 * (radius + fontSize);
            const height = 2 * (radius + fontSize);

            this.set({
                width,
                height,
                radius,
                angleSpan,
                _charAngle: angleSpan / text.length,
            });
        },

        _render: function (ctx) {
            if (this.isEditing) {
                this.callSuper("_render", ctx);
                return;
            }

            const text = this.text;
            const kerning = this.kerning;
            const flipped = this.flipped;
            const fontSize = this.fontSize;
            const startAngleDeg = this.startAngle;

            const angleSpan = this.angleSpan;
            const radius = this.radius;
            const anglePerChar = this._charAngle;

            ctx.save();

            ctx.font = this._getFontDeclaration();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = this.fill;

            ctx.translate(-this.width / 2, -this.height / 2);
            ctx.translate(this.width / 2, this.height / 2);
            ctx.rotate((startAngleDeg * Math.PI) / 180);
            ctx.rotate(-angleSpan / 2);

            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                ctx.save();
                ctx.rotate(anglePerChar / 2);
                ctx.translate(0, -radius * (flipped ? -1 : 1));
                ctx.rotate(flipped ? Math.PI : 0);

                if (this.stroke && this.strokeWidth > 0) {
                    ctx.strokeStyle = this.stroke;
                    ctx.lineWidth = this.strokeWidth;
                    ctx.strokeText(ch, 0, 0);
                }

                ctx.fillText(ch, 0, 0);
                ctx.restore();
                ctx.rotate(anglePerChar);
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