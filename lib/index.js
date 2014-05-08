'use strict';

var _ = require('underscore'),
    async = require('async'),
    Advancement = require('./Advancement');

module.exports = function() {
  var args, advancement, queue, waterfall,
      parallel;

  args = {};

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

  advancement = new Advancement(args);

  queue = async.queue(function(task, callback) {
    task(function(err) {
      if (err) throw err;

      callback();
    });
  }, advancement.args.concurrency);

  waterfall = {
    functions: []
  };

  parallel = {
    functions: [],
    limit: advancement.args.concurrency
  };

  parallel.generator = function(stream) {
    parallel.functions.push(function(callback) {
      advancement.getStreamAssets(stream, callback);
    });
  };

  waterfall.functions.push(function(callback) {
    advancement.getStreams(callback);
  });

  waterfall.functions.push(function(result, callback) {
    result.streams.forEach(function(stream) {
      parallel.generator(stream);
    });

    async.parallelLimit(parallel.functions, parallel.limit, callback);
  });

  waterfall.functions.push(function(results, callback) {
    results = _.compact(results);

    results.forEach(function(result) {
      var output = advancement.generateOutputPath(
        result.artist,
        result.title
      );

      queue.push(function(callback) {
        advancement.getCover(result.cover, {
          output: output
        }, callback);
      });

      result.artwork.forEach(function(artwork) {
        queue.push(function(callback) {
          advancement.getArtwork(artwork.url, {
            output: output
          }, callback);
        });
      });

      result.tracks.forEach(function(track) {
        queue.push(function(callback) {
          advancement.rtmpToMp3(track.source, {
            artist: result.artist,
            album: result.title,
            number: track.idx,
            total: result.tracks.length,
            title: track.title,
            output: output
          }, callback);
        });
      });

      callback();
    });
  });

  async.waterfall(waterfall.functions, function(err) {
    if (err) throw err;
  });
};
