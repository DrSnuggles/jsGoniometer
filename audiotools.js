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
  debug = false; // display console logs?

  //
  // Private
  //
  function log(out) {
    if (debug) console.log("ATools:", out);
  };
  function splitAudio(buf) {
    log("Loaded audio has "+ buf.numberOfChannels +" channels @"+ buf.sampleRate/1000.0 +"kHz");
    log("Destination supports up to "+ ctx.destination.maxChannelCount +" channels");

    // Routing: Source --> Splitter --> Analyser
    //          Source --> Destination

    // Source
    source = ctx.createBufferSource();

    // Splitter
    splitter = ctx.createChannelSplitter( buf.numberOfChannels );
    log(splitter);
    source.connect(splitter); // Input --> Splitter

    // Analyzers
    my.ana = [];  // clear old analyzers
    for (var i = 0; i < buf.numberOfChannels; i++) {
      my.ana.push( ctx.createAnalyser() );
      my.ana[i].fftSize = fft;
      my.ana[i].smoothingTimeConstant = 0.0;
      splitter.connect(my.ana[i], i, 0); // Route each single channel from Splitter --> Analyzer
    }

    source.connect(ctx.destination); // we also want to hear audio
    playAudio( buf );
  };
  function playAudio(buf) {
    source.buffer = buf;
    source.start(0);
    log("Audio playback started");
  };

  //
  // Public
  //
  my.loadAudio = function(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      my.decodeAudio(xhr.response);
    }
    xhr.send();
  };
  my.decodeAudio = function(buf) {
    my.stopAudio();
    ctx.decodeAudioData(buf, function(buf) {
      splitAudio(buf);
    }, function(e){
      console.error(e);
    });
  };
  my.stopAudio = function() {
    if (!source) return; // nothing to stop
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
    }
  };
  my.setFFTsize = function (newSize) {
    fft = newSize;
    for (var i = 0; i < ATools.ana.length; i++) {
      ATools.ana[i].fftSize = fft;
    }
    log("Meter FFT size set to: "+ fft);
  };

  //
  // Exit
  //
  return my;
})();
