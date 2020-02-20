/*  Audio tools by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
 */

"use strict";

var ATools = (function () {
  //
  // Init
  //
  var my = {    // public available settings
    ana: []     // Analyser Nodes
  },
  fft = 2048,   // fft Size
  ctx = new AudioContext(), // Audio context
  source,   // Source
  splitter, // Splitter
  isLoading = false, // avoid multiple starts, still possible via DND ;)
  debug = true; // display console logs?

  //
  // Private
  //
  function log(out) {
    if (debug) console.log("ATools:", out);
    if (document.getElementById("stat")) document.getElementById("stat").innerText = out;
  };
  function splitAudio(buf) {
    log("Loaded audio has "+ buf.numberOfChannels +" channels @"+ buf.sampleRate/1000.0 +"kHz");
    log("Destination supports up to "+ ctx.destination.maxChannelCount +" channels");

    if (!WaveSurferAudioContext) {
      ctx = WaveSurferAudioContext;
    } else {
      // Source
      source = ctx.createBufferSource();
    }

    // Routing: Source --> Splitter --> Analyser
    //          Source --> Destination

    // Splitter
    splitter = ctx.createChannelSplitter( buf.numberOfChannels );
    source.connect(splitter); // Input --> Splitter

    // Analyzers
    my.ana = [];  // clear old analyzers
    for (var i = 0; i < buf.numberOfChannels; i++) {
      my.ana.push( ctx.createAnalyser() );
      my.ana[i].fftSize = fft;
      my.ana[i].smoothingTimeConstant = 0.0;
      splitter.connect(my.ana[i], i, 0); // Route each single channel from Splitter --> Analyzer
    }

    if (!WaveSurferAudioContext) {
       // we also want to hear audio
       // wavesurfer does take care by his own
      source.connect(ctx.destination);
    }
    playAudio( buf );
  };
  function playAudio(buf) {
    source.buffer = buf;
    source.start(0);
    log("Audio playback started");
    isLoading = false; // as late as possible
  };

  //
  // Public
  //
  my.log = log;
  my.loadAudio = function(url) {
    log("loadAudio: "+ url);
    if (isLoading) return false; // user already started to load, maybe i will abort old load... ToDo
    isLoading = true; // as soon as possible
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      log("Audio loaded");
      my.decodeAudio(xhr.response);
    }
    xhr.onprogress = function(e) {
      if (e.lengthComputable) {
        var perc = e.loaded / e.total * 100;
        log("Progress: "+ perc.toFixed(1) + "%");
      } else {
        log("Progress: "+ my.formatBytes(e.loaded));
      }
    }
    xhr.send();
  };
  my.formatBytes = function(bytes) {
    // b, kB, MB, GB
    var kilobytes = bytes/1024;
    var megabytes = kilobytes/1024;
    var gigabytes = megabytes/1024;
    if (gigabytes>1) return gigabytes.toFixed(2) +' GB';
    if (megabytes>1) return megabytes.toFixed(2) +' MB';
    if (kilobytes>1) return kilobytes.toFixed(2) +' kB';
    return bytes +' b';
  }
  my.decodeAudio = function(buf) {
    log("decodeAudio");
    my.stopAudio();
    ctx.decodeAudioData(buf, function(buf) {
      splitAudio(buf);
    }, function(e){
      //console.error(e);
      log("Unable to decode audio");
    });
  };
  my.attach = function(buf) {
    log("attach");
    my.stopAudio();
    splitAudio(buf);
  }
  my.stopAudio = function() {
    if (!source) return; // nothing to stop
    log("stopAudio");
    // stop playback
    source.buffer = null;
    source.stop();
    // disconnect everything
    try {
      source.disconnect(splitter);
      for (var i = 0; i < my.ana.length; i++) {
        splitter.disconnect(my.ana[i], i, 0);
      }
    } catch(e) {
      // mostly because audio already ended
      log("Audio was already disconnected");
    }
  };
  my.setFFTsize = function (newSize) {
    fft = newSize;
    for (var i = 0; i < ATools.ana.length; i++) {
      ATools.ana[i].fftSize = fft;
    }
    log("FFT size set to: "+ fft);
  };

  //
  // Exit
  //
  return my;
})();
