# WebGL Recorder

WebGL Recorder is a debugging tool for WebGL.

It is a playback recorder, designed to capture all WebGL commands and data, with the ability to play back the commands to recreate the render.

It captures all WebGL commands, buffers, and textures, over a given number of frames. It will then generate an HTML file containing javascript with all of the WebGL commands recorded. This generated HTML file can be opened in the browser to play back the recording.

This can be used to diagnose issues with WebGL rendering by eliminating everything but the raw WebGL commands. This is also very helpful for submitting self-contained reproduction examples for bug reports.

## Using With Unity

* Add the Unity/WebGLTemplates folder to your Unity project's Assets folder.
* Select GLFrameRecorder template from the WebGL Player Settings template list.
* Build and run the project. The recording will automatically download as an HTML file after the set number of frames.
* Open the downloaded HTML file to play back the recording.
* Template settings:
  * **Check every command**: Whether to run gl.getError after every command. Default 0.
  * **Export name**: The name of the exported file (without extension). Default "WebGLRecord".
  * **Number of frames**: The number of frames to record. Default 400.
  * 
## Using From HTML

### Load From CDN

You can load the script through a CDN so you don't have to store it locally and make sure you're always using the latest version of the recorder.

```html
<script src="https://cdn.jsdelivr.net/gh/brendan-duncan/webgl_recorder/webgl_recorder.js"></script>
````

### Load From Local Script Reference

If you prefer to host your own version, copy the script to your project and load it by adding the following to your project's HTML.

```html
<script src="webgl_recorder.js"></script>
````

### Start The Recorder

Once the recorder script has been loaded in your app, you can instantiate the recorder by using the following:

```html
<script>
    new WebGLRecorder();
</script>
```

Because the recorder needs to record all commands and data, it starts recording as soon as it is contructed, and will continue recording for the maximum number of frames. **The recorder should be created before any rendering code starts so it has a chance to wrap WebGL.**

The recording will download automatically as an HTML file with embedded Javascript after the maximum number of frames have been recorded.

You can optionally configure the recorder

```html
<script>
    new WebGLRecorder({
        "frames": 100,
        "export": "WebGLRecord",
        "width": 800,
        "height": 600,
        "lines": 0
    });
</script>
```

Where

* **frames** The maximum number of frames to record. Default _400_.
* **export** The basename of the generated HTML file. Default _WebGLRecord_.
* **width** The width of the canvas in the recording. This should match the width of the original canvas. Default _800_.
* **height** The height of the canvas in the recording. This should match the height of the original canvas. Default _600_.
* **lines** if 1, the recorder will do error checking around every command and include specific line numbers where the error occurs. Default _0_.

## Play The Recording

The recording is a self-contained HTML file so you don't need a local server to view it.

Open the downloaded HTML file in a browser to play back the recording.
