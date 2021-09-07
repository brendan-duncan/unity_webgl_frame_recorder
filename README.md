# unity_webgl_frame_recorder
Debugging tool for Unity WebGL.
* Add the WebGLTemplates folder to your Unity project's Assets folder.
* Select GLFrameRecorder template from the WebGL Player Settings template list.
* Build and run the project. The recording will automatically download as an HTML file after the set number of frames.
* Open the downloaded HTML file to play back the recording.
* Template settings:
    * * **Check every command**: Whether to run gl.getError after every command. Default 0.
    * * **Export name**: The name of the exported file (without extension). Default "WebGLRecord".
    * **Number of frames**: The number of frames to record. Default 400.
