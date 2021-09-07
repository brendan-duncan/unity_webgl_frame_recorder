class GLRecordObject {
    constructor(name) {
        this.name = name;
    }
}

class GLRecordArray {
    constructor(index) {
        this.index = index;
    }
}

var GLRecordFrame = {
    _inFrame: false,

    _commandToIDMap: {},
    _idToCommandMap: {},
    _lastCommandId: 1,
    _prefixCommands: [],
    _frameCommands: [],
    _startRecordFrame: false,
    _recordFrame: false,
    _objectIndex: 1,
    _objectMap: new Map(),
    _frameCount: 0,
    _maxFrames: 400,
    _debugLines: 0,
    _currentFrameCommands: null,
    _arrayCache: [],
    _exportName: "WebGLRecord",
    _canvasWidth: 960,
    _canvasHeight: 600,

    _commentCommands: [
        //"getParameter",
    ],

    _excludeCommands: [
        "getError",
    ],

    frameStart: function() {
        this._frameCount++;
        this._inFrame = true;
        if (this._frameCount < this._maxFrames) {
            this._currentFrameCommands = [];
            this._frameCommands.push(this._currentFrameCommands);
        } else {
            if (this._frameCount == this._maxFrames) {
                this.exportRecord();
            }
            this._currentFrameCommands = null;
        }
    },

    frameEnd: function() {
        this._inFrame = false;
        if (this._recordFrame) {
            this.exportCommands();
            this._recordFrame = false;
        }
    },

    _exportCommand: function(c, lastFrame) {
        let cs = "";
        let name = this._idToCommandMap[c[0]];
        if (this._commentCommands.indexOf(name) != -1 || (lastFrame && (name == "deleteSync" || name == "clientWaitSync")))
            cs += "//";

        if (c[1] != -1) {
            cs += "G[" + c[1] + "] = ";
        }
        cs += "gl." + name + "(";
        cs += this._argString(c[2]);
        cs += ");\n";
        return cs;
    },

    _encodeBase64: function(array) {
        let i, s = [], len = array.length;
        for (i = 0; i < len; i++) s.push(String.fromCharCode(array[i]));
        return btoa(s.join(''));
    },

    _arrayToBase64: function(array) {
        return this._encodeBase64(new Uint8Array(array.buffer));
    },

    exportRecord: function() {
        console.log("EXPORTING", this._exportName + ".html");
        let cs = `<html><head></head><body style="text-align: center;"><script>\n`;

        cs += "// Prefix\n";
        cs += "let G = {};\n";
        cs += "let Atypes = [\n";
        for (let ai = 0; ai < this._arrayCache.length; ++ai) {
            if (ai != 0) cs += ",";
            cs += this._arrayCache[ai].type + '\n';
        }
        cs += "];\n";
        cs += "let A = [\n";
        for (let ai = 0; ai < this._arrayCache.length; ++ai) {
            if (ai != 0) cs += ",";
            let a = this._arrayCache[ai].array;

            let arrayStr = this._arrayToBase64(a);
            cs += '"' + arrayStr + '"\n';
        }
        cs += "];\n";
        cs += "let _frame = -1;\nlet L=0;\n";
        cs += "function initialize(gl) {\n";
        let line = 0;
        for (let i = 0; i < this._prefixCommands.length; ++i) {
            let c = this._prefixCommands[i];
            cs += "L=" + line + ";\n";
            line++;
            cs += this._exportCommand(c, false);
        }
        cs += "}\n\n";

        for (let i = 0; i < this._frameCommands.length; ++i) {
            let lastFrame = i == this._frameCommands.length - 1;
            let cmds = this._frameCommands[i];
            cs += "// Frame " + i + "\n";
            cs += "function frame_" + i + "(gl) {\n_frame = " + i + ";\n";
            for (let j = 0; j < cmds.length; ++j) {
                let c = cmds[j];
                if (this._debugLines)
                    cs += "L=" + line + ";\n";
                line++;
                cs += this._exportCommand(c, lastFrame);
            }
            cs += "}\n\n";
        }

        cs += `
let frames = [\n`;
for (let i = 0; i < this._frameCommands.length; ++i) {
    if (i != 0) cs += ', ';
    cs += 'frame_' + i + '\n';
}
cs += `];
function checkError(gl, name) {
    let e = gl.getError();
    let line = ${this._debugLines} ? "Line:" + L : "";
    if (e == gl.INVALID_ENUM) console.error("ERROR", name, "Frame:" + _frame, line, "INVALID_ENUM");
    else if (e == gl.INVALID_VALUE) console.error("ERROR", name, "Frame:" + _frame, line, "INVALID_VALUE");
    else if (e == gl.INVALID_OPERATION) console.error("ERROR", name, "Frame:" + _frame, line, "INVALID_OPERATION");
    else if (e == gl.INVALID_FRAMEBUFFER_OPERATION) console.error("ERROR", name, "Frame:" + _frame, line, "INVALID_FRAMEBUFFER_OPERATION");
    else if (e == gl.OUT_OF_MEMORY) console.error("ERROR", name, "Frame:" + _frame, line, "ERR: OUT_OF_MEMORY");
    else if (e == gl.CONTEXT_LOST_WEBGL) console.error("ERROR", name, "Frame:" + _frame, line, "CONTEXT_LOST_WEBGL");
}
let canvas = document.createElement('canvas');
canvas.width = ${this._canvasWidth};
canvas.height = ${this._canvasHeight};
canvas.style = "width: ${this._canvasWidth}px; height: ${this._canvasHeight}px;";
document.body.append(canvas);
let gl = canvas.getContext("webgl2");

if (${this._debugLines}) {
    for (var m in gl) {
        if (typeof(gl[m]) == 'function') {
            let name = m;
            if (name == "getError") continue;
            let origFunction = gl[m];
            gl[m] = function() {
                let res = origFunction.call(gl, ...arguments);
                checkError(gl, name);
                return res;
            }
        }
    }
}

function decodeBase64(s) {
    let i, d = atob(s), b = new Uint8Array(d.length);
    for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
    return b;
}

function base64ToArray(aType, s) {
    let blob = decodeBase64(s);
    let fLen = blob.length / aType.BYTES_PER_ELEMENT;
    let dView = new DataView(new ArrayBuffer(aType.BYTES_PER_ELEMENT));
    let out = new aType(fLen);
    let p = 0;
    for (let i = 0; i < fLen; ++i) {
        p = i * aType.BYTES_PER_ELEMENT;
        for (let j = 0; j < aType.BYTES_PER_ELEMENT; ++j) {
            dView.setUint8(0, blob[p + j]);
        }
        out[i] = aType == Float32Array ? dView.getFloat32(0, true) :
                 aType == Float64Array ? dView.getFloat64(0, true) :
                 aType == Int16Array ? dView.getInt16(0, true) :
                 aType == Uint16Array ? dView.getUint16(0, true) :
                 aType == Uint8Array ? dView.getUint8(0, true) :
                 aType == Int8Array ? dView.getInt8(0, true) :
                 0;
    }
    return out;
}

// Arrays are stored in base64. Decode them to their original form (Uint8Array, Float32Array, etc).
for (let i = 0; i < A.length; ++i) {
    A[i] = base64ToArray(Atypes[i], A[i]);
}

initialize(gl);
checkError(gl, "Initialize");

let frameLabel = document.createElement("div");
frameLabel.style = "position: absolute; top: 10px; left: 10px; font-size: 24pt; color: #f00;";
document.body.append(frameLabel);

let frame = 0;
function drawFrame() {
    requestAnimationFrame(drawFrame);
    if (frame >= frames.length) frame = frames.length - 1;
    frameLabel.innerText = "Frame: " + frame;
    frames[frame](gl);
    checkError(gl, "FRAME" + frame);
    frame++;
}
requestAnimationFrame(drawFrame);

let resetButton = document.createElement('button');
resetButton.style = "display: block;";
resetButton.innerText = "RESET FRAMES";
resetButton.addEventListener('click', function() {
    initialize(gl);
    checkError(gl, "Initialize");
    frame = 0;
});
document.body.append(resetButton);

</script>
</body>
`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([cs], {type: 'application/javascript'}));
        link.download = (this._exportName || 'WebGLRecord') + ".html";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    recordFrame: function() {
        this._startRecordFrame = true;
    },

    _validateCacheData: function(ai, view) {
        let a = this._arrayCache[ai].array;
        if (a.length != view.length)
            return false;
        for (let i = 0, l = a.length; i < l; ++i) {
            if (a[i] != view[i]) {
                return false;
            }
        }
        return true;
    },

    _recordCommand: function(array, name, args) {
        if (!this._commandToIDMap[name]) {
            this._commandToIDMap[name] = this._lastCommandId;
            this._idToCommandMap[this._lastCommandId] = name;
            this._lastCommandId++;
        }

        let argCopy = [];

        var self = this;
        var _getCache = function(a, offset, len) {
            let cacheIndex = -1;
            let view = new a.constructor(a.buffer, offset, len);
            for (let ai = 0; ai < self._arrayCache.length; ++ai) {
                let c = self._arrayCache[ai];
                if (c.buffer == a.buffer && c.offset == offset && c.length == len) {
                    if (this._validateCacheData(ai, view)) {
                        cacheIndex = ai;
                        break;
                    }
                }
            }
            if (cacheIndex == -1) {
                let array = a.constructor.from(view);
                cacheIndex = self._arrayCache.length;
                self._arrayCache.push({
                    buffer: a.buffer,
                    offset: offset,
                    length: len,
                    type: a.constructor.name,
                    array: array
                });
            }
            return cacheIndex;
        };

        if (name == "bufferSubData") {
            argCopy.push(args[2]);
            argCopy.push(args[3]);

            let a = args[4];
            let offset = args[5];
            let len = args[6];

            let cacheIndex = _getCache(a, offset, len);

            argCopy.push(new GLRecordArray(cacheIndex));
            argCopy.push(0);
            argCopy.push(len);
        } else if (name == "texSubImage2D") {
            argCopy.push(args[2]);
            argCopy.push(args[3]);
            argCopy.push(args[4]);
            argCopy.push(args[5]);
            argCopy.push(args[6]);
            argCopy.push(args[7]);
            argCopy.push(args[8]);
            argCopy.push(args[9]);

            let a = args[10];
            let offset = args[11];
            let w = args[6];
            let h = args[7];
            let len = w * h * 4;

            let cacheIndex = _getCache(a, offset, len);

            argCopy.push(new GLRecordArray(cacheIndex));
            argCopy.push(0);
        } else if (name == "texSubImage3D") {
            argCopy.push(args[2]);
            argCopy.push(args[3]);
            argCopy.push(args[4]);
            argCopy.push(args[5]);
            argCopy.push(args[6]);
            argCopy.push(args[7]);
            argCopy.push(args[8]);
            argCopy.push(args[9]);
            argCopy.push(args[10]);
            argCopy.push(args[11]);

            let a = args[12];
            let offset = args[13];
            let w = args[7];
            let h = args[8];
            let d = args[9];
            let len = w * h * d * 4;

            let cacheIndex = _getCache(a, offset, len);

            argCopy.push(new GLRecordArray(cacheIndex));
            argCopy.push(0);
        } else if (name == "compressedTexSubImage2D") {
            argCopy.push(args[2]);
            argCopy.push(args[3]);
            argCopy.push(args[4]);
            argCopy.push(args[5]);
            argCopy.push(args[6]);
            argCopy.push(args[7]);
            argCopy.push(args[8]);

            let a = args[9];
            let offset = args[10];
            let len = args[11];

            let cacheIndex = _getCache(a, offset, len);
            argCopy.push(new GLRecordArray(cacheIndex));
            argCopy.push(0);
            argCopy.push(len);
        } else if (name == "uniform1fv" || name == "uniform2fv" || name == "uniform3fv" || name == "uniform4fv") {
            argCopy.push(args[2]);

            let a = args[3];
            let offset = args[4];
            let len = args[5];
            let array = [];
            for (let i = offset; i < offset + len; ++i) {
                let f = a[i];
                // what to do here?
                if (f == Infinity || isNaN(f)) {
                    f = 0.0;
                }
                array.push(f);
            }
            argCopy.push(array);
        } else if (name == "bufferData") {
            argCopy.push(args[2]);

            let a = args[3];
            let usage = args[4];

            if (args.length == 5) {
                argCopy.push(a);
                argCopy.push(usage);
            } else {
                let offset = args[5];
                let len = args[6];

                let cacheIndex = -1;
                for (let ai = 0; ai < this._arrayCache.length; ++ai) {
                    let c = this._arrayCache[ai];
                    if (c.buffer == a.buffer && c.offset == offset && c.length == len) {
                        cacheIndex = ai;
                        break;
                    }
                }
                if (cacheIndex == -1) {
                    let view = new a.constructor(a.buffer, offset, len);
                    let array = a.constructor.from(view);
                    cacheIndex = this._arrayCache.length;
                    this._arrayCache.push({
                        buffer: a.buffer,
                        offset: offset,
                        length: len,
                        type: a.constructor.name,
                        array: array
                    });
                }
                argCopy.push(new GLRecordArray(cacheIndex));

                argCopy.push(usage);
                argCopy.push(0);
                argCopy.push(len);
            }
        } else {
            for (let i = 2; i < args.length; ++i) {
                let a = args[i];
                if (a === null || a === undefined) {
                    argCopy.push(a);
                } else if (typeof(a) === "string") {
                    argCopy.push(a);
                } else if (ArrayBuffer.isView(a)) {
                    argCopy.push([]);
                } else if (Array.isArray(a)) {
                    argCopy.push(a);
                } else if (typeof(a) === "object") {
                    let id = this._objectMap.get(a);
                    if (id !== undefined) {
                        argCopy.push(new GLRecordObject(id));
                    } else {
                        argCopy.push(new GLRecordObject(-1));
                    }
                } else {
                    argCopy.push(a);
                }
            }
        }

        let res = typeof(args[1]) == "object" ? this._objectMap.get(args[1]) : -1;

        let cmd = [this._commandToIDMap[name], res, argCopy];
        array.push(cmd);
    },

    recordCommand: function() {
        let name = arguments[0];
        let res = arguments[1];

        if (this._excludeCommands.indexOf(name) != -1)
            return;

        if (typeof(res) == "object") {
            this._objectMap.set(res, this._objectIndex);
            this._objectIndex++;
        }

        if (!this._inFrame)
            this._recordCommand(this._prefixCommands, name, arguments);
        else if (this._currentFrameCommands)
            this._recordCommand(this._currentFrameCommands, name, arguments);
    },

    hookWebGL: function(ctx, errorChecking) {
        if (ctx.glrf_webglAreadyHooked) return;
        ctx.glrf_webglAreadyHooked = true;

        for (let m in ctx) {
            if (typeof(ctx[m]) == "function") {
                if (m != "getError") {
                    let origFunction = ctx[m];
                    if (errorChecking) {
                        ctx[m] = function() {
                            let res = origFunction.call(ctx, ...arguments);
                            self.recordCommand(m, res, ...arguments);
                            let err = ctx.getError();
                            if (err) {
                                console.error("GL ERROR", m, "Code:", err);
                            }
                            return res;
                        };
                    } else {
                        ctx[m] = function() {
                            let res = origFunction.call(ctx, ...arguments);
                            self.recordCommand(m, res, ...arguments);
                            return res;
                        };
                    }
                }
            }
        }

        var self = this;
        window.glrf_requestAnimationFrame = window.requestAnimationFrame;
        window.requestAnimationFrame = function(cb) {
            function glrfCallback() {
                self.frameStart();
                cb(performance.now());
                self.frameEnd();
            }
            window.glrf_requestAnimationFrame(glrfCallback);
        };
    },

    _argString: function(args) {
        var s = "";
        for (let i = 0; i < args.length; ++i) {
            let a = args[i];
            if (s != "") s += ", ";
            if (a === null || a === undefined) {
                s += "null";
            } else if (a instanceof GLRecordObject) {
                s += "G[" + a.name + "]";
            } else if (a instanceof GLRecordArray) {
                s += "A[" + a.index + "]";
            } else if (typeof(a) == "string") {
                s += "`" + a + "`";
            } else if (Array.isArray(a)) {
                s += "[" + this._argString(a) + "]";
            } else if (typeof(a) == "object") {
                if (a.length !== undefined) {
                    s += "[";
                    s += a.toString();
                    s += "]";
                } else {
                    let b = this._objectMap.get(a);
                    if (b) {
                        s += "G[" + b + "]";
                    } else {
                        s += a.constructor.name + JSON.stringify(a);
                    }
                }
            } else {
                s += a;
            }
        }
        return s;
    }
};

function glrf_hookIntoWebGLCanvases() {
    let canvases = document.getElementsByTagName('canvas');
    for (let i = 0; i < canvases.length; ++i) {
        let c = canvases[i];
        if (!c['glrf_getContext']) {
            c['glrf_getContext'] = c['getContext'];
            c['getContext'] = function(a1, a2) {
                let ret = c['glrf_getContext'](a1, a2);
                if (ret) GLRecordFrame.hookWebGL(ret, true);
                return ret;
            };
        }
    }
}

window.exportGLRecord = function() {
    GLRecordFrame.exportRecord();
};

// Get configuration settings from the html in the form:
// <script id="gl_frame_recorder" type="application/json">{
//    "frames": 400,
//    "lines": 0
//    "export": "WebGLRecord",
//    "width": 960,
//    "height": 600
// }</script>
let configData = document.getElementById("gl_frame_recorder");
if (configData) {
    try {
        let data = JSON.parse(configData.text);
        GLRecordFrame._maxFrames = parseInt(data["frames"] || GLRecordFrame._maxFrames);
        GLRecordFrame._exportName = data["export"] || GLRecordFrame._exportName;
        GLRecordFrame._canvasWidth = parseInt(data["width"] || GLRecordFrame._canvasWidth);
        GLRecordFrame._canvasHeight = parseInt(data["height"] || GLRecordFrame._canvasHeight);
        GLRecordFrame._debugLines = parseInt(data["lines"] || GLRecordFrame._debugLines);
    } catch (error) {
        //
    }
}

glrf_hookIntoWebGLCanvases();
window.addEventListener('load', glrf_hookIntoWebGLCanvases);
setTimeout(glrf_hookIntoWebGLCanvases, 100);
