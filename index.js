/*jshint esversion: 6 */
/*jslint node: true */
"use strict";

const log = require('./pino.js');
const fs = require('fs');
const path = require('path');
const MPQArchive = exports.MPQArchive = require('empeeku/mpyq').MPQArchive;
const protocol29406 = exports.protocol =  require('./lib/protocol29406');
const version = exports.version = require('./package.json').version;

try {
  var optional = require('storm-replay');
} catch (err) {
  optional = null;
  log.warn('heroprotocol.js is using Javascript extraction, which is notably slower and will be re-written in the future. See README.md for more details.');
}
const storm = optional;

// parsable parts
const HEADER            = exports.HEADER            = 'header';
const DETAILS           = exports.DETAILS           = 'replay.details';
const INITDATA          = exports.INITDATA          = 'replay.initdata';
const GAME_EVENTS       = exports.GAME_EVENTS       = 'replay.game.events';
const MESSAGE_EVENTS    = exports.MESSAGE_EVENTS    = 'replay.message.events';
const TRACKER_EVENTS    = exports.TRACKER_EVENTS    = 'replay.tracker.events';
const ATTRIBUTES_EVENTS = exports.ATTRIBUTES_EVENTS = 'replay.attributes.events';
const FILES             = exports.FILES             = [
  HEADER,
  DETAILS,
  INITDATA,
  GAME_EVENTS,
  MESSAGE_EVENTS,
  TRACKER_EVENTS,
  ATTRIBUTES_EVENTS
];

const decoderMap = {
  [HEADER]:             'decodeReplayHeader',
  [DETAILS]:            'decodeReplayDetails',
  [INITDATA]:           'decodeReplayInitdata',
  [GAME_EVENTS]:        'decodeReplayGameEvents',
  [MESSAGE_EVENTS]:     'decodeReplayMessageEvents',
  [TRACKER_EVENTS]:     'decodeReplayTrackerEvents',
  [ATTRIBUTES_EVENTS]:  'decodeReplayAttributesEvents'
};

const parseStrings = function parseStrings(data) {
  if (!data) return data;
  else if (data instanceof Buffer) return data.toString();
  else if (Array.isArray(data)) return data.map(item => parseStrings(item));
  else if (typeof data === 'object') {
    for (let key in data) {
      data[key] = parseStrings(data[key]);
    }
  }
  return data;
};

let lastUsed, protocol;
let build = 0;

const openArchive = function (file, noCache) {
  log.trace('openArchive() : ' + file + ', ' + noCache);
  let archive, header;

  if (!lastUsed || !(lastUsed instanceof MPQArchive) || file !== lastUsed.filename || noCache) {

    if (typeof file === 'string') {
      try {
        if (!path.isAbsolute(file)) {
          file = path.join(process.cwd(), file);
        }
        archive = new MPQArchive(file);
        archive.filename = file;
      } catch (err) {
        archive = err;
      }
    } else if (file instanceof MPQArchive) {
      // TODO - need to check what happens when instanciating an MPQArchive with
      // invalid path and setup an error accordingly
      archive = file;
    } else {
      archive = new Error('Unsupported parameter: ${file}');
    }

    if (archive instanceof Error) return archive;
    lastUsed = archive;

    // parse header
    archive.data = {};
    header = archive.data[HEADER] = parseStrings(protocol29406.decodeReplayHeader(archive.header.userDataHeader.content));
    // The header's baseBuild determines which protocol to use
    archive.baseBuild = build = header.m_version.m_baseBuild;

    try {
      archive.protocol = require(`./lib/protocol${archive.baseBuild}`);
    } catch (err) {
      archive.error = err;
    }

    // set header to proper protocol
    archive.data[HEADER] = parseStrings(archive.protocol.decodeReplayHeader(archive.header.userDataHeader.content));

    archive.get = function (file) {
      return exports.get(file, archive);
    };

  } else {
    // load archive from cache
    archive = lastUsed;
  }

  return archive;
};

// ensure non-breaking changes
exports.get = (file, archive) => {
  log.debug('get() : ' + file + ', ' + archive);
  if (storm) {
    return exports.extractFile(file, archive);
  } else {
    return exports.extractFileJS(file, archive);
  }
};

// returns the content of a file in a replay archive
exports.extractFileJS = function (archiveFile, archive, keys) {
  log.debug('extractFileJS() : ' + archiveFile + ', ' + archive);
  let data;
  archive = openArchive(archive);

  if (archive instanceof Error) {
    return data;
  }

  if (archive.data[archiveFile] && !keys) {
    data = archive.data[archiveFile];
  } else {
    if (archive.protocol) {

      if ([DETAILS, INITDATA, ATTRIBUTES_EVENTS].indexOf(archiveFile) > -1) {
        log.trace('extractFileJS() : ' + archiveFile + ' - parsing file');
        data = archive.data[archiveFile] =
          parseStrings(archive.protocol[decoderMap[archiveFile]](
            archive.readFile(archiveFile)
          ));
      } else if ([GAME_EVENTS, MESSAGE_EVENTS, TRACKER_EVENTS].indexOf(archiveFile) > -1) {
        log.trace('extractFileJS() : ' + archiveFile + ' - parsing lines iteratively');

        if (keys) {
          // protocol function to call is a generator
          data = [];
          for (let event of archive.protocol[decoderMap[archiveFile]](archive.readFile(archiveFile))) {

            keyLoop:
            // check validity with whitelisted keys
            for (var key in keys) {
              for (var i = 0, j = keys[key].length; i < j; i++) {
                if (parseStrings(event)[key] === keys[key][i]){
                    data.push(parseStrings(event));
                    break keyLoop;
                }
              }
            }

          }

        } else {
          data = archive.data[archiveFile] = [];
          for (let event of archive.protocol[decoderMap[archiveFile]](archive.readFile(archiveFile))) {
            data.push(parseStrings(event));
          }
        }

      } else {
        log.trace('extractFileJS() : ' + archiveFile + ' - not parsing');
        data = archive.data[archiveFile] = archive.readFile(archiveFile);
      }

    }
  }

  return data;
};

/**
 * extract all files from archive via cpp binding
 * @function
 * @param {string} archive - Path of the MPQ archive
 * @returns {object} Object of files as buffers
 */
exports.extractFiles = (archive) => {
  if (typeof archive === 'string') {
    if (!path.isAbsolute(archive)) {
      archive = path.join(process.cwd(), archive);
    }
  }
  log.debug('extractFiles() : ' + archive);
  let header = exports.parseHeader(storm.getHeader(archive).content.data);
  let data = [];

  for (var i = FILES.length - 1; i >= 0; i--) {
    data[FILES[i]] = exports.extractFile(FILES[i], archive);
  }
  return data;
};

/**
 * extract all files from archive via cpp binding
 * @function
 * @param {string} file - Filename to extract
 * @param {string} archive - Path of the MPQ archive
 * @returns {object} Object of files as buffers
 */
exports.extractFile = (file, archive) => {
  if (typeof archive === 'string') {
    if (!path.isAbsolute(archive)) {
      archive = path.join(process.cwd(), archive);
    }
  }
  let build = exports.getVersion(archive);
  log.debug('extractFile() : ' + file + ', ' + archive);

  if (file === 'header') {
    return exports.parseHeader(storm.getHeader(archive).content.data);
  }

  let result = storm.extractFile(archive, file);
  if (result.success == false) {
    log.warn(JSON.stringify(result));
  }

  return exports.parseFile(file, result.content.data, build);
};

/**
 * gets the build version of the replay, and preloads the decoding library
 * @function
 * @param {string} archive - Path of the MPQ archive
 * @returns {integer} Build number
 */
exports.getVersion = (archive) => {
  if (typeof archive === 'string') {
    if (!path.isAbsolute(archive)) {
      archive = path.join(process.cwd(), archive);
    }
  }
  let header = exports.parseHeader(storm.getHeader(archive).content.data);
  protocol = require(`./lib/protocol${header.m_dataBuildNum}`);
  build = header.m_dataBuildNum;
  return header.m_dataBuildNum;
};

/**
 * parses a basic MPQ header
 * @function
 * @param {buffer} buffer - Header content from MPQ archive
 * @returns {object} Header information from file
 */
exports.parseHeader = function (buffer) {
  return parseStrings(protocol29406.decodeReplayHeader(buffer));
};

/**
 * parses a buffer based on a given build
 * @function
 * @param {string} filename - Name of the file to assist in parsing
 * @param {buffer} buffer - Binary file contents from MPQ archive
 * @param {string} build - Build in which to parse the contents
 * @returns {object} File contents
 */
exports.parseFile = function (filename, buffer, build) {
  let data, protocol;

  try {
    protocol = require(`./lib/protocol${build}`);
  } catch (err) {
    return undefined;
  }

  if ([DETAILS, INITDATA, ATTRIBUTES_EVENTS].indexOf(filename) > -1) {
    log.trace('parseFile() : ' + filename + " (build " + build + ") - parsing entire file");
    data = parseStrings(protocol[decoderMap[filename]](buffer));
  } else if ([GAME_EVENTS, MESSAGE_EVENTS, TRACKER_EVENTS].indexOf(filename) > -1) {
    log.trace('parseFile() : ' + filename + " (build " + build + ") - parsing lines iteratively");
    data = [];
    for (let event of protocol[decoderMap[filename]](buffer)) {
      data.push(parseStrings(event));
    }
  } else {
    log.trace('parseFile() : ' + filename + " (build " + build + ") - not parsing");
    data = buffer;
  }

  return data;
};

if (storm !== null) {
  exports.stormVersion = storm.version;
} else {
  exports.stormVersion = undefined;
}
