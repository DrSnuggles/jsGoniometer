/*  Audio tools by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
 */

"use strict";

var ATools = (function () {
  //
  // Init
  //
  var my = {    // public available settings
    ana: {     // Analyzer
      'L':null,         // left channel
      'R':null,         // right channel
      'C':null,         // center channel
      'LS':null,         // left surround channel
      'RS':null         // right surround channel
    }
  },
  debug = false; // display console logs?

  //
  // Private
  //
  function log(out) {
    if (debug) console.log("ATools:", out);
  };

  //
  // Public
  //
  my.createAnalyzer = function (source) {
    log("splitChannels");

    // analyze source
    if (source.tagName === "AUDIO") {
      log("Audio tag found")
      var audioCtx = new AudioContext();
      try {
        source = audioCtx.createMediaElementSource(source); // creates source from audio tag with at least 2channels
        source.connect(audioCtx.destination); // route source to destination
      } catch(e){
        log("Audio could not re-created");
      }
      log("Audio source created and routed");
    }
    // now we should have GainNode or MediaElementAudioSourceNode
    //log(source);

    var splitter = source.context.createChannelSplitter(2);
    var left = source.context.createStereoPanner();
    var right = source.context.createStereoPanner();
    source.connect(splitter);
    splitter.connect(left, 0);
    splitter.connect(right, 1);
    left.pan.value = -1;
    right.pan.value = 1;
    my.ana.L = source.context.createAnalyser();
    my.ana.R = source.context.createAnalyser();
    //my.ana.L.minDecibels = my.ana.R.minDecibels = -90;
    //my.ana.L.maxDecibels = my.ana.R.maxDecibels = +10;

    left.connect(my.ana.L);
    right.connect(my.ana.R);
    /*
    // was intended for 1 channel signals
    // 1 channel signals they are displayed as left only sources which is not correct
    // BUT createMediaElementSource creates 2 channels from a 1 channel signal... depends on playback device???
    switch (source.channelCount) {
      case 0:
        log("No audio channels found");
        break;
      case 1:
        log("Mono signal found");
        left.connect(anaL);
        right.connect(anaL);
        break;
      case 2:
        log("Stereo signal found");
        left.connect(anaL);
        right.connect(anaR);
        break;
      default:
        log("Multichannel with "+ source.channelCount +" signals found");
        left.connect(anaL);
        right.connect(anaR);
    }
    */

    return my.ana;
  };
  //
  // Exit
  //
  return my;
})();
