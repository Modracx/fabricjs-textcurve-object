# **fabricjs-textcurve-object**
============
**`fabricjs-textcurve-object`** is a custom [Fabric.js](http://fabricjs.com/) object that extends `fabric.IText` to render **single-line text along a circular arc**. It supports both **bitmap** and **vector rendering**, offering flexibility between performance and visual fidelity.

This object maintains full **interactive editing capabilities**, just like standard `IText`, including:

- Cursor movement  
- Text selection  
- Keyboard editing

While editing, the text behaves like a normal straight-line `IText` object. During rendering (when not in editing mode), the text follows a circular path based on the configured properties.

---

## 🔑 Key Features

- Curved text rendering on a circular arc  
- Editable like regular `IText`  
- Supports both **vector** and **bitmap** rendering  

---

## ⚙️ Configurable Arc Properties (with Defaults)

| Property     | Default   | Description                                                                 |
|--------------|-----------|-----------------------------------------------------------------------------|
| `diameter`   | `0`       | Diameter of the circular arc the text follows                               |
| `startAngle` | `180`     | Starting angle (in degrees) for text along the arc                          |
| `kerning`    | `0`       | Extra spacing between characters                                            |
| `flipped`    | `false`   | If `true`, text curves inward (inside circle); otherwise, it curves outward |

---

## 💡 Example Usage

```js
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


> note: The bounding box for vector rendering considers the curve as full circle even for an arc.