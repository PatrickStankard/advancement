'use strict';

var fs = require('fs'),
    os = require('os'),
    http = require('http'),
    https = require('https'),
    spawn = require('child_process').spawn,
    Browser = require('zombie'),
    _ = require('underscore'),
    mkdirp = require('mkdirp'),
    ent = require('ent'),
    Advancement;

Advancement = function(args) {
  this.args = this.mergeObjects({
    concurrency: (os.cpus().length / 2),
    overwrite: false,
    outputPath: __dirname + '/../output',
    userAgent: 'advancement'
  }, args, {
    strict: true
  });

  this.args.concurrency = parseInt(
    Math.floor(
      this.args.concurrency
    ), 10
  );

  if (_.isNaN(this.args.concurrency) === true || this.args.concurrency < 1) {
    this.args.concurrency = 1;
  }

  this.options = {
    browser: {
      site: 'http://pitchfork.com',
      userAgent: this.args.userAgent,
      silent: true
    }
  };

  this.regex = {
    string: [{
      find: new RegExp('[|`"]', 'g'),
      replace: ''
    }],
    filename: [{
      find: new RegExp('[^\\w\\s]', 'g'),
      replace: '_'
    }, {
      find: new RegExp('\\s{1,}', 'g'),
      replace: ' '
    }]
  };

  this.year = new Date().getFullYear();
};

Advancement.prototype.mergeObjects = function(base, given, options) {
  var strict;

  if (_.isObject(base) === false) {
    throw new Error('No base params given');
  }

  if (_.isObject(given) === false) {
    return base;
  }

  if (_.isObject(options) === true) {
    if (_.isBoolean(options.strict) === true) {
      strict = options.strict;
    }
  }

  if (_.isUndefined(strict) === true) {
    strict = false;
  }

  if (strict === false) {
    _.extend(base, given);
  } else {
    for (var param in given) {
      if (_.isUndefined(base[param]) === false) {
        if (typeof base[param] === typeof given[param]) {
          base[param] = given[param];
        }
      }
    }
  }

  return base;
};

Advancement.prototype.sanitizeString = function(string, options) {
  var output;

  if (_.isString(string) === false) {
    return output;
  }

  options = this.mergeObjects({
    type: 'string'
  }, options, {
    strict: true
  });

  output = ent.decode(string).trim();

  if (_.isArray(this.regex[options.type]) === false) {
    return output;
  }

  this.regex[options.type].forEach(function(regex) {
    output = output.replace(regex.find, regex.replace);
  });

  output = output.trim();

  return output;
};

Advancement.prototype.generateOutputPath = function(artist, title) {
  var path;

  if (_.isString(artist) === false) {
    throw new Error('No artist given');
  }

  if (_.isString(title) === false) {
    throw new Error('No title given');
  }

  artist = this.sanitizeString(artist, {
    type: 'filename'
  });

  title = this.sanitizeString(title, {
    type: 'filename'
  });

  path = [
    this.args.outputPath,
    artist,
    title
  ].join('/').trim();

  return path;
};

Advancement.prototype.doesPathExist = function(path, callback) {
  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  if (_.isString(path) === false) {
    return callback(new Error('No directory path given'), null);
  }

  fs.exists(path, function(exists) {
    callback(null, exists);
  });
};

Advancement.prototype.ensurePathExists = function(path, callback) {
  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  if (_.isString(path) === false) {
    return callback(new Error('No directory path given'));
  }

  this.doesPathExist(path, function(err, exists) {
    if (err) {
      return callback(err);
    }

    if (exists === true) {
      return callback(null);
    }

    mkdirp(path, function(err) {
      callback(err);
    });
  });
};

Advancement.prototype.getStreams = function(callback) {
  var browser;

  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  browser = new Browser(this.options.browser);

  browser.visit('/advance/', function() {
    var streams, output, x, len;

    streams = browser.body.querySelector(
      'div#page > div#content > div#streams'
    );

    if (streams.length === 0) {
      browser.close();
      return callback(new Error('No streams found'), null);
    }

    streams = streams.querySelectorAll('ul.clearfix > li > div.stream');

    if (streams.length === 0) {
      browser.close();
      return callback(new Error('No streams found'), null);
    }

    output = {
      streams: []
    };

    for (x = 0, len = streams.length; x < len; x++) {
      var stream, cover, result, href, artist, title;

      stream = streams[x].querySelector('div.info > a');
      cover = streams[x].querySelector('div.artwork > a > img');

      result = {};

      if (_.isObject(stream) === true) {
        href = stream.getAttribute('href');

        if (_.isString(href) === true) {
          href = href.trim();

          if (href.length !== 0) {
            result.href = href;
          }
        }

        artist = stream.querySelector('div.artists');

        if (artist.length !== 0) {
          artist = artist.textContent.trim();
        } else {
          artist = 'Unknown Artist';
        }

        result.artist = artist;

        title = stream.querySelector('div.title');

        if (title.length !== 0) {
          title = title.textContent.trim();
        } else {
          title = 'Unknown Title';
        }

        result.title = title;
      }

      if (_.isObject(cover) === true) {
        cover = cover.getAttribute('src');

        if (_.isString(cover) === true) {
          cover = cover.trim();

          if (cover.length !== 0) {
            result.cover = cover;
          }
        }
      }

      if (_.size(result) !== 0) {
        output.streams.push(result);
      }
    }

    browser.close();
    callback(null, output);
  });
};

Advancement.prototype.getStreamAssets = function(stream, callback) {
  var browser, visit;

  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  if (_.isObject(stream) === false) {
    return callback(new Error('No stream given'), null);
  }

  if (_.isString(stream.href) === false) {
    return callback(new Error('No stream href given'), null);
  }

  if (_.isString(stream.artist) === false) {
    return callback(new Error('No stream artist given'), null);
  }

  if (_.isString(stream.title) === false) {
    return callback(new Error('No stream title given'), null);
  }

  if (_.isString(stream.cover) === false) {
    return callback(new Error('No stream cover given'), null);
  }

  browser = new Browser(this.options.browser);

  visit = function() {
    browser.visit(stream.href, function() {
      var count, output, check;

      if (_.isObject(browser.window) === false) {
        browser.close();
        return callback(new Error('Browser window does not exist'), null);
      }

      count = 0;

      output = {
        artist: stream.artist,
        title: stream.title,
        cover: stream.cover,
        artwork: [],
        tracks: []
      };

      check = function() {
        var retry;

        if (_.isArray(browser.window.stream_artwork) === true) {
          output.artwork = browser.window.stream_artwork;
        }

        if (_.isArray(browser.window.stream_tracks) === true) {
          output.tracks = browser.window.stream_tracks;
        }

        retry = output.tracks.length === 0 ||
                _.isUndefined(output.tracks[0].source) === true;

        if (retry === true) {
          count++;

          if (count > 10) {
            browser.close();
            return callback(null, null);
          }

          browser.wait(500 * count, function() {
            check();
          });
        } else {
          browser.close();
          callback(null, output);
        }
      };

      check();
    });
  };

  visit();
};

Advancement.prototype.getCover = function(href, options, callback) {
  var suffix, path;

  if (_.isFunction(callback) === false) {
    callback = function(err) {
      if (err) throw err;
    };
  }

  options = this.mergeObjects({
    output: null
  }, options);

  if (_.isString(href) === false) {
    return callback(new Error('No cover href given'));
  }

  if (_.isString(options.output) === false) {
    return callback(new Error('No cover output path given'));
  }

  suffix = href.split('/');
  suffix = suffix[suffix.length - 1];

  suffix = suffix.split('.');
  suffix = suffix[suffix.length - 1];

  path = options.output + '/folder.' + suffix;

  this.ensurePathExists(options.output, function(err) {
    var cover;

    if (err) {
      return callback(err);
    }

    this.doesPathExist(path, function(err, exists) {
      var protocol;

      if (err) {
        return callback(err);
      }

      if (exists === true && this.args.overwrite === false) {
        return callback(null);
      }

      cover = fs.createWriteStream(path);

      if (href.indexOf('https://') !== -1) {
        protocol = https;
      } else {
        protocol = http;
      }

      protocol.get(href, function(res) {
        res.pipe(cover);

        callback(null);
      });
    }.bind(this));
  }.bind(this));
};

Advancement.prototype.getArtwork = function(href, options, callback) {
  var filename, suffix, path;

  if (_.isFunction(callback) === false) {
    callback = function(err) {
      if (err) throw err;
    };
  }

  if (_.isString(href) === false) {
    return callback(new Error('No artwork href given'));
  }

  options = this.mergeObjects({
    output: null
  }, options);

  if (_.isString(options.output) === false) {
    return callback(new Error('No artwork output path given'));
  }

  filename = href.split('/');
  filename = filename[filename.length - 1];
  filename = filename.split('.');

  suffix = filename[filename.length - 1];

  filename = filename[0];

  filename = this.sanitizeString(filename, {
    type: 'filename'
  });

  suffix = this.sanitizeString(suffix, {
    type: 'filename'
  });

  path = options.output + '/artwork/00 ' + filename + '.' + suffix;

  this.ensurePathExists(options.output + '/artwork', function(err) {
    if (err) throw err;

    this.doesPathExist(path, function(err, exists) {
      var artwork, protocol;

      if (err) {
        return callback(err);
      }

      if (exists === true && this.args.overwrite === false) {
        return callback(null);
      }

      artwork = fs.createWriteStream(path);

      if (href.indexOf('https://') !== -1) {
        protocol = https;
      } else {
        protocol = http;
      }

      protocol.get(href, function(res) {
        res.pipe(artwork);

        callback(null);
      });
    }.bind(this));
  }.bind(this));
};

Advancement.prototype.rtmpToFlvStream = function(rtmp, options, callback) {
  var server, url, number, title, output, mp3;

  options = this.mergeObjects({
    number: null,
    title: null,
    output: null
  }, options);

  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  if (_.isObject(rtmp) === false) {
    return callback(new Error('No RTMP stream given'), null);
  }

  if (_.isString(rtmp.server) === false) {
    return callback(new Error('No RTMP stream server given'), null);
  }

  server = this.sanitizeString(rtmp.server);

  if (_.isString(rtmp.url) === false) {
    return callback(new Error('No RTMP stream URL given'), null);
  }

  url = this.sanitizeString(rtmp.url);

  if (_.isNumber(options.number) === false) {
    return callback(new Error('No track number given'), null);
  }

  number = options.number;

  if (number < 10) {
    number = '0' + number;
  }

  if (_.isString(options.title) === false) {
    return callback(new Error('No track title given'), null);
  }

  title = this.sanitizeString(options.title, {
    type: 'filename'
  });

  if (_.isString(options.output) === false) {
    return callback(new Error('No track output path given'), null);
  }

  output = options.output;

  mp3 = output + '/' + number + ' ' + title + '.mp3';

  this.ensurePathExists(output, function(err) {
    if (err) {
      return callback(err, null);
    }

    this.doesPathExist(mp3, function(err, exists) {
      var rtmpdump;

      if (err) {
        return callback(err, null);
      }

      if (exists === true && this.args.overwrite === false) {
        return callback(null, null);
      }

      rtmpdump = spawn('rtmpdump', [
        '--rtmp', server + '/',
        '--playpath', url
      ]);

      callback(null, rtmpdump);
    }.bind(this));
  }.bind(this));
};

Advancement.prototype.flvStreamToMp3 = function(flv, options, callback) {
  var number, title, output, mp3;

  options = this.mergeObjects({
    number: null,
    title: null,
    output: null
  }, options);

  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  if (_.isObject(flv) === false) {
    return callback(new Error('No FLV stream given'));
  }

  if (_.isNumber(options.number) === false) {
    return callback(new Error('No track number given'));
  }

  number = options.number;

  if (number < 10) {
    number = '0' + number;
  }

  if (_.isString(options.title) === false) {
    return callback(new Error('No track title given'));
  }

  title = this.sanitizeString(options.title, {
    type: 'filename'
  });

  if (_.isString(options.output) === false) {
    return callback(new Error('No track output path given'));
  }

  output = options.output;

  mp3 = output + '/' + number + ' ' + title + '.mp3';

  this.doesPathExist(mp3, function(err, exists) {
    var ffmpeg;

    if (err) {
      return callback(err);
    }

    if (exists === true && this.args.overwrite === false) {
      return callback(null);
    }

    ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', 'pipe:0',
      '-f', 'flv',
      '-vn',
      '-acodec', 'copy',
      mp3
    ]);

    flv.stdout.pipe(ffmpeg.stdin);

    ffmpeg.once('close', function(code) {
      if (code !== 0) {
        return callback(new Error(
          'ffmpeg: ' + mp3 + ' failed with exit code: ' + code
        ));
      }

      callback(null);
    });
  }.bind(this));
};

Advancement.prototype.rtmpToMp3 = function(rtmp, options, callback) {
  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  this.rtmpToFlvStream(rtmp, options, function(err, flv) {
    if (err) {
      return callback(err);
    }

    if (flv === null) {
      return callback(null);
    }

    this.flvStreamToMp3(flv, options, function(err) {
      if (err) {
        return callback(err);
      }

      this.tagMp3(options, callback);
    }.bind(this));
  }.bind(this));
};

Advancement.prototype.tagMp3 = function(options, callback) {
  var artist, album, number, total, title, output, mp3, id3v2;

  if (_.isFunction(callback) === false) {
    throw new Error('No callback given');
  }

  options = this.mergeObjects({
    artist: null,
    album: null,
    number: null,
    total: null,
    title: null,
    output: null
  }, options);

  if (_.isString(options.artist) === false) {
    return callback(new Error('No track artist given'));
  }

  artist = this.sanitizeString(options.artist);

  if (_.isString(options.album) === false) {
    return callback(new Error('No track album given'));
  }

  album = this.sanitizeString(options.album);

  if (_.isNumber(options.number) === false) {
    return callback(new Error('No track number given'));
  }

  number = options.number;

  if (number < 10) {
    number = '0' + number;
  }

  if (_.isNumber(options.total) === false) {
    return callback(new Error('No track total given'));
  }

  total = options.total;

  if (total < 10) {
    total = '0' + total;
  }

  if (_.isString(options.title) === false) {
    return callback(new Error('No track title given'));
  }

  title = this.sanitizeString(options.title);

  if (_.isString(options.output) === false) {
    return callback(new Error('No track output path given'));
  }

  output = options.output;

  mp3 = [
    output,
    '/',
    number,
    ' ',
    this.sanitizeString(title, {
      type: 'filename'
    }),
    '.mp3'
  ].join('');

  id3v2 = spawn('id3v2', [
    '--artist', artist,
    '--album', album,
    '--song', title,
    '--genre', '12',
    '--year', this.year,
    '--track', number + '/' + total,
    mp3
  ]);

  id3v2.once('close', function(code) {
    if (code !== 0) {
      return callback(new Error(
        'id3v2: ' + mp3 + ' failed with exit code: ' + code
      ));
    }

    console.log('NEW: ' + artist + ', "' + title + '"');

    callback(null);
  });
};

module.exports = Advancement;
