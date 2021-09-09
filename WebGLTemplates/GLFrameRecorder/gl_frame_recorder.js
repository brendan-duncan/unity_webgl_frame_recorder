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
        "clientWaitSync",
        "deleteSync",
        "fenceSync"
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
            if (this._frameCount == (this._maxFrames + 1)) {
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

        let createCommands = {
            "fenceSync": "deleteSync",
            "createBuffer": "deleteBuffer",
            "createTexture": "deleteTexture",
            "createProgram": "deleteProgram",
            "createShader": "deleteShader"
        };

        let deleteCommands = [
            "deleteSync",
            "deleteBuffer",
            "deleteTexture",
            "deleteProgram",
            "deleteShader"
        ];

        if (this._commentCommands.indexOf(name) != -1 || (lastFrame && (name == "deleteSync" || name == "fenceSync")))
            cs += "//";

        if (c[1] != -1) {
            if (createCommands[name])
                cs += "if(!G[" + c[1] + "])G[" + c[1] + "]=";
            else 
                cs += "G[" + c[1] + "]=";
        }
        let isDeleteCmd = deleteCommands.indexOf(name) != -1;
        if (isDeleteCmd) {
            let b = c[2][0].name;
            cs += "if(G[" + b + "])";
        }
        cs += "gl." + name + "(";
        cs += this._argString(c[2]);
        cs += ");";
        if (isDeleteCmd) {
            let b = c[2][0].name;
            cs += "G[" + b + "]=0;";
        }

        cs += "\n";
        return cs;
    },

    _encodeBase64: function(bytes) {
        const _b2a = [
            "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
            "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
            "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
            "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"
        ];

        let result = '', i, l = bytes.length;
        for (i = 2; i < l; i += 3) {
            result += _b2a[bytes[i - 2] >> 2];
            result += _b2a[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
            result += _b2a[((bytes[i - 1] & 0x0F) << 2) | (bytes[i] >> 6)];
            result += _b2a[bytes[i] & 0x3F];
        }
        if (i === l + 1) {
            result += _b2a[bytes[i - 2] >> 2];
            result += _b2a[(bytes[i - 2] & 0x03) << 4];
            result += "==";
        }
        if (i === l) {
            result += _b2a[bytes[i - 2] >> 2];
            result += _b2a[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
            result += _b2a[(bytes[i - 1] & 0x0F) << 2];
            result += "=";
        }
        return result;
    },

    _arrayToBase64: function(a) {
        return this._encodeBase64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    },

    exportRecord: function() {
        console.log("EXPORTING", this._exportName + ".html");
        let cs = `<html><head></head><body style="text-align: center;"><script>\n`;

        cs += "// Unity WebGL Recording\n";
        cs += "let G = {};\nlet A = []; let F = {}; let X = {};\n";
        cs += "let f = -1;\nlet L=0;\n";
        cs += "function initialize(gl) {\n";
        let line = 0;
        for (let i = 0; i < this._prefixCommands.length; ++i) {
            let c = this._prefixCommands[i];
            if (this._debugLines)
                cs += "L=" + line + "; ";
            cs += this._exportCommand(c, false);
            line++;
        }
        cs += "}\n\n";

        for (let i = 0; i < this._frameCommands.length; ++i) {
            let lastFrame = i == this._frameCommands.length - 1;
            let cmds = this._frameCommands[i];
            cs += "// Frame " + i + "\n";
            cs += "function frame_" + i + "(gl) {\nf = " + i + ";\nF[" + i + "]={};\n";
            for (let j = 0; j < cmds.length; ++j) {
                let c = cmds[j];
                if (this._debugLines)
                    cs += "L=" + line + "; ";
                cs += this._exportCommand(c, lastFrame);
                line++;
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
    if (e == gl.INVALID_ENUM) console.error("ERROR", name, "Frame:" + f, line, "INVALID_ENUM");
    else if (e == gl.INVALID_VALUE) console.error("ERROR", name, "Frame:" + f, line, "INVALID_VALUE");
    else if (e == gl.INVALID_OPERATION) console.error("ERROR", name, "Frame:" + f, line, "INVALID_OPERATION");
    else if (e == gl.INVALID_FRAMEBUFFER_OPERATION) console.error("ERROR", name, "Frame:" + f, line, "INVALID_FRAMEBUFFER_OPERATION");
    else if (e == gl.OUT_OF_MEMORY) console.error("ERROR", name, "Frame:" + f, line, "ERR: OUT_OF_MEMORY");
    else if (e == gl.CONTEXT_LOST_WEBGL) console.error("ERROR", name, "Frame:" + f, line, "CONTEXT_LOST_WEBGL");
}

function decodeBase64(str) {
    const base64codes = [
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63,
        52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255,
        255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255,
        255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
    ];

    function getBase64Code(charCode) {
        if (charCode >= base64codes.length) {
            throw new Error("Unable to parse base64 string.");
        }
        const code = base64codes[charCode];
        if (code === 255) {
            throw new Error("Unable to parse base64 string.");
        }
        return code;
    }

    if (str.length % 4 !== 0) {
        throw new Error("Unable to parse base64 string.");
    }

    const index = str.indexOf("=");
    if (index !== -1 && index < str.length - 2) {
        throw new Error("Unable to parse base64 string.");
    }

    let missingOctets = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0;
    let n = str.length;
    let result = new Uint8Array(3 * (n / 4));
    for (let i = 0, j = 0; i < n; i += 4, j += 3) {
        let buffer =
            getBase64Code(str.charCodeAt(i)) << 18 |
            getBase64Code(str.charCodeAt(i + 1)) << 12 |
            getBase64Code(str.charCodeAt(i + 2)) << 6 |
            getBase64Code(str.charCodeAt(i + 3));
        result[j] = buffer >> 16;
        result[j + 1] = (buffer >> 8) & 0xFF;
        result[j + 2] = buffer & 0xFF;
    }
    return result.subarray(0, result.length - missingOctets);
}

function B64ToA(aType, s) {
    let x = decodeBase64(s);
    return new aType(x.buffer, 0, x.length / aType.BYTES_PER_ELEMENT);
}

function main() {
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

    initialize(gl);
    checkError(gl, "Initialize");

    let frameLabel = document.createElement("div");
    frameLabel.style = "position: absolute; top: 10px; left: 10px; font-size: 24pt; color: #f00;";
    document.body.append(frameLabel);

    let frame = 0;
    let t0 = performance.now();
    function drawFrame() {
        requestAnimationFrame(drawFrame);
        if (frame >= frames.length) frame = frames.length - 1;
        let t1 = performance.now();
        frameLabel.innerText = "F: " + frame + "  T:" + (t1 - t0).toFixed(2);
        t0 = t1;
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
}\n`;

    cs += "A = [\n";
    for (let ai = 0; ai < this._arrayCache.length; ++ai) {
        if (ai != 0) cs += ",";
        let a = this._arrayCache[ai];
        let b64 = this._arrayToBase64(a.array);

        cs += 'B64ToA(' + a.type + ',  "' + b64 + '")\n';
    }
    cs += `];

main();

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

    _recordCommand: function(array, name, args) {
        if (!this._commandToIDMap[name]) {
            this._commandToIDMap[name] = this._lastCommandId;
            this._idToCommandMap[this._lastCommandId] = name;
            this._lastCommandId++;
        }

        let argCopy = [];
        var self = this;

        function _byteSizeForWebGLType(type) {
            type -= 5120;
            if (type == 0) return 1;
            if (type == 1) return 1;
            if (type == 2) return 2;
            if (type == 4) return 4;
            if (type == 6) return 4;
            if (type == 5 || type == 28922 || type == 28520 || type == 30779 || type == 30782) return 4;
            return 2;
        }

        function _colorChannelsInGlTextureFormat(format) {
            var colorChannels = {
                5: 3,
                6: 4,
                8: 2,
                29502: 3,
                29504: 4,
                26917: 2,
                26918: 2,
                29846: 3,
                29847: 4
            };
            return colorChannels[format - 6402] || 1;
        }

        function _heapAccessShiftForWebGLHeap(heap) {
            return 31 - Math.clz32(heap.BYTES_PER_ELEMENT);
        }

        function _validateCacheData(ai, view) {
            let a = self._arrayCache[ai].array;
            if (a.length != view.length) 
                return false;
            for (let i = 0, l = a.length; i < l; ++i) {
                if (a[i] != view[i]) {
                    return false;
                }
            }
            return true;
        }

        function _getCache(heap, offset, length) {
            offset = offset << _heapAccessShiftForWebGLHeap(heap);
            let view = new heap.constructor(heap.buffer, offset, length);

            let cacheIndex = -1;
            for (let ai = 0; ai < self._arrayCache.length; ++ai) {
                let c = self._arrayCache[ai];
                if (c.offset == offset && c.length == length) {
                    if (_validateCacheData(ai, view)) {
                        cacheIndex = ai;
                        break;
                    }
                }
            }

            if (cacheIndex == -1) {
                cacheIndex = self._arrayCache.length;
                let arrayCopy = heap.constructor.from(view);
                self._arrayCache.push({
                    offset: offset,
                    length: length,
                    type: heap.constructor.name,
                    array: arrayCopy
                });
            }
            return cacheIndex;
        }

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
            argCopy.push(args[2]); // target
            argCopy.push(args[3]); // level
            argCopy.push(args[4]); // xoffset
            argCopy.push(args[5]); // yoffset
            argCopy.push(args[6]); // width
            argCopy.push(args[7]); // height
            argCopy.push(args[8]); // format
            argCopy.push(args[9]); // type

            let a = args[10]; // pixels
            let offset = args[11]; // srcOffset
            let w = args[6];
            let h = args[7];
            let format = args[8];
            let type = args[9];
            let channels = _colorChannelsInGlTextureFormat(format);
            let channelSize = _byteSizeForWebGLType(type);
            let len = w * h * channels * channelSize;

            let cacheIndex = _getCache(a, offset, len);

            argCopy.push(new GLRecordArray(cacheIndex));
            argCopy.push(0);
        } else if (name == "texSubImage3D") {
            argCopy.push(args[2]); // target
            argCopy.push(args[3]); // level
            argCopy.push(args[4]); // xoffset
            argCopy.push(args[5]); // yoffset
            argCopy.push(args[6]); // zoffset
            argCopy.push(args[7]); // width
            argCopy.push(args[8]); // height
            argCopy.push(args[9]); // depth
            argCopy.push(args[10]); // format
            argCopy.push(args[11]); // type

            let format = args[10];
            let type = args[11];
            let channels = _colorChannelsInGlTextureFormat(format);
            let channelSize = _byteSizeForWebGLType(type);

            let a = args[12];
            let offset = args[13];
            let w = args[7];
            let h = args[8];
            let d = args[9];
            let len = w * h * d * channels * channelSize;

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
            let length = args[11];

            let cacheIndex = _getCache(a, offset, length);
            argCopy.push(new GLRecordArray(cacheIndex));
            argCopy.push(0);
            argCopy.push(length);
        } else if (name == "uniform1fv" || name == "uniform2fv" || name == "uniform3fv" || name == "uniform4fv") {
            argCopy.push(args[2]);

            let data = args[3];
            let offset = args[4];
            let length = args[5];

            let cacheIndex = _getCache(data, offset, length);
            argCopy.push(new GLRecordArray(cacheIndex));
        } else if (name == "bufferData") {
            argCopy.push(args[2]); // target

            let srcData = args[3];
            let usage = args[4];

            if (args.length == 5) {
                argCopy.push(srcData);
                argCopy.push(usage);
            } else {
                let offset = args[5];
                let length = args[6];

                let cacheIndex = _getCache(srcData, offset, length);

                argCopy.push(new GLRecordArray(cacheIndex));

                argCopy.push(usage);
                argCopy.push(0);
                argCopy.push(length);
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
