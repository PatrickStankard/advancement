advancement
===========

Archive current [Pitchfork Advance](http://pitchfork.com/advance/) streams.

```bash
# prereqs: rtmpdump, ffmpeg, id3v2, node
$ brew install ffmpeg rtmpdump id3v2 node
$ npm install .
$ npm start
```

Outputs the stream's cover, artwork, and audio files
in the ``output`` directory, structured as follows:

```bash
output/Artist/Album/01 Track 01.mp3
output/Artist/Album/artwork/00 Scene_1.mp4
output/Artist/Album/folder.jpg
```
