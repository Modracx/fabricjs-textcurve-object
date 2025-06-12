# fabricjs-textcurve-object

The fabricjs-textcurve-object is a custom Fabric.js object that extends fabric.IText to render single-line text along a circular arc. It supports both bitmap and vector rendering, offering flexibility between performance and visual fidelity.

This object maintains full interactive editing capabilities, just like standard IText, including:

Cursor movement

Text selection

Keyboard editing

While editing, the text behaves like a normal straight-line IText object. During rendering (when not in editing mode), the text follows a circular path based on the configured properties.

Key Features:
Curved Text Rendering on a circular arc

Editable like regular IText

Supports both vector and bitmap rendering

Configurable Arc Properties (with Defaults):
diameter (default: 0) – The diameter of the circular arc the text follows.

startAngle (default: 180) – The angle (in degrees) at which the text starts along the arc.

kerning (default: 0) – Additional spacing between characters, useful for fine-tuning character distribution along the arc.

flipped (default: false) – When true, renders the text inside the circle (inward-facing); otherwise, it renders outward-facing.

This makes it ideal for creating curved text elements such as labels, seals, dials, and decorative text paths with interactive editing support.

Example Usage:
const curvedText = new fabric.TextCurve("Hello, world!", {
  left: 100,
  top: 100,
  diameter: 35,
  kerning: 5,
  fontSize: 32,
  startAngle: 0,
  fill: "#000"
});
canvas.add(curvedText);

note: The bounding box for vector rendering considers the curve as full circle even for an arc.