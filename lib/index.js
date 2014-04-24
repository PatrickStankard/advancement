'use strict';

var _ = require('underscore'),
    async = require('async'),
    Advancement = require('./Advancement');

module.exports = function() {
  var advancement, args, queue;

  advancement = new Advancement();
  args = _.clone(advancement.args);

  process.argv.slice(2).forEach(function(arg) {
    if (_.isString(arg) === true) {
      arg = arg.split('=');

      arg.forEach(function(val, i, arg) {
        var key, lower, number;

        val = val.trim();
        arg[i] = val;

        switch (i) {
          case 0:
            args[val] = true;

            break;
          case 1:
            key = arg[0];
            lower = val.toLowerCase();
            number = parseInt(val, 10);

            if (lower === 'true') {
              val = true;
            } else if (lower === 'false') {
              val = false;
            } else if (_.isNaN(number) === false) {
              val = number;
            }

            args[key] = val;

            break;
        }
      });
    }
  });

  advancement.args = advancement.mergeObjects(advancement.args, args, {
    strict: true
  });

  queue = async.queue(function(task, callback) {
    task(function(err) {
      if (err) throw err;

      callback();
    });
  }, advancement.args.concurrency);

  queue.drain = function() {
    process.exit(0);
  };

  advancement.getStreams(function(err, res) {
    if (err) throw err;

    res.streams.forEach(function(stream) {
      advancement.getStreamAssets(stream, function(err, res) {
        var output, series;

        if (err) throw err;

        if (res === null) {
          return;
        }

        output = advancement.generateOutputPath(
          res.artist,
          res.title
        );

        series = [
          function(callback) {
            advancement.getCover(res.cover, {
              output: output
            }, callback);
          }
        ];

        res.artwork.forEach(function(artwork) {
          series.push(function(callback) {
            advancement.getArtwork(artwork.url, {
              output: output
            }, callback);
          });
        });

        res.tracks.forEach(function(track) {
          series.push(function(callback) {
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

        queue.push(function(callback) {
          async.series(series, callback);
        });
      });
    });
  });
};
