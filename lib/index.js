'use strict';

var async = require('async'),
    Advancement = require('./Advancement');

module.exports = function() {
  var advancement = new Advancement();

  advancement.getStreams(function(err, res) {
    if (err) throw err;

    res.streams.forEach(function(stream) {
      advancement.getStreamAssets(stream, function(err, res) {
        var output, parallel;

        if (err) throw err;

        if (res === null) {
          return false;
        }

        output = [
          __dirname,
          '/../output/',
          advancement.sanitizeString(res.artist, {
            type: 'filename'
          }),
          '/',
          advancement.sanitizeString(res.title, {
            type: 'filename'
          })
        ].join('');

        parallel = [
          function(callback) {
            advancement.getCover(res.cover, {
              output: output
            }, callback);
          }
        ];

        res.artwork.forEach(function(artwork) {
          parallel.push(function(callback) {
            advancement.getArtwork(artwork.url, {
              output: output
            }, callback);
          });
        });

        res.tracks.forEach(function(track) {
          parallel.push(function(callback) {
            advancement.rtmpToMp3(track.source, {
              artist: res.artist,
              album: res.title,
              number: track.idx,
              total: res.tracks.length,
              title: track.title,
              output: output
            }, callback);
          });
        });

        async.parallelLimit(parallel, 5, function(err) {
          if (err) throw err;
        });
      });
    });
  });
};
