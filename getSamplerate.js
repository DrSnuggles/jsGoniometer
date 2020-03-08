/*  getSamplerate by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42

    WebAudio lags of information which samplerate was used in original source
    https://github.com/WebAudio/web-audio-api/issues/30
    and always resamples to audio device sample rate
    https://stackoverflow.com/questions/51252732/javascript-getchanneldata-some-out-of-bounds
 */

"use strict";

var ATools = (function (my) {
  my.getSamplerate = function (buf) {
    var ret = {}; // return object
    var sbuf8 = new Uint8Array(buf);

    // identify type
    var fType = String.fromCharCode(sbuf8[0]) + String.fromCharCode(sbuf8[1]) + String.fromCharCode(sbuf8[2]) + String.fromCharCode(sbuf8[3]) + String.fromCharCode(sbuf8[4]) + String.fromCharCode(sbuf8[5]) + String.fromCharCode(sbuf8[6]) + String.fromCharCode(sbuf8[7]);
    if (fType.substr(0, 4) === "RIFF") {
      fType = "WAV";
      // https://de.wikipedia.org/wiki/RIFF_WAVE
      // http://soundfile.sapp.org/doc/WaveFormat/
      // The default byte ordering assumed for WAVE data files is little-endian. Files written using the big-endian byte ordering scheme have the identifier RIFX instead of RIFF.
      // look for 'fmt '
      var chunkSize = (sbuf8[4]) + (sbuf8[5]<<8) + (sbuf8[6]<<16) + (sbuf8[7]<<24);
      ret.str = getAsString(sbuf8);
      var fmtStart = ret.str.indexOf("fmt ");
      // audioFormat should be 1 else it's comnpressed
      //var audioFormat = (sbuf8[fmtStart+8]) + (sbuf8[fmtStart+9]<<8);
      var numChannels = (sbuf8[fmtStart+10]) + (sbuf8[fmtStart+11]<<8);
      var srate = (sbuf8[fmtStart+12]) + (sbuf8[fmtStart+13]<<8) + (sbuf8[fmtStart+14]<<16) + (sbuf8[fmtStart+15]<<24);
      var bitsPerSample = (sbuf8[fmtStart+22]) + (sbuf8[fmtStart+23]<<8);
    } else if (fType.substr(0, 4) === "fLaC") {
      fType = "FLAC";
      // FLAC
      // https://xiph.org/flac/format.html#def_STREAMINFO
      // big-endian
      var srate = (sbuf8[18]<<12) + (sbuf8[19]<<4) + ((sbuf8[20] & 0b11110000)>>4);
      var numChannels = ((sbuf8[20] & 0b00001110)>>1) + 1; // have to add 1 here
      var bitsPerSample = ((sbuf8[20] & 0b00000001)<<4) + ((sbuf8[21] & 0b11110000)>>4) + 1; // have to add 1 here
    } else if (fType.substr(0, 4) === "OggS") {
      fType = "OGG";
      // https://stackoverflow.com/questions/45231773/how-to-get-sample-rate-by-ogg-vorbis-byte-buffer
      // https://xiph.org/vorbis/doc/Vorbis_I_spec.pdf
      var numChannels = new Uint8Array( buf.slice(39, 40) )[0];
      var srate = new Uint32Array( buf.slice(40, 48) )[0];
      var bitrate = new Uint32Array( buf.slice(48, 52) )[0];
    } else if (fType.substr(0, 3) === "ID3") {
      // MP3
        // read samplerate from frame: https://de.wikipedia.org/wiki/MP3#Frame-Header
        // https://www.mp3-tech.org/programmer/frame_header.html
        // first we need to know ID = MPEG version (2 bits)
        // then we another 2bits (sample rate freq index) and we can look in table which samplerate was used
        /*
        Sampling rate frequency index
        bits	MPEG1     MPEG2	     MPEG2.5
        00    44100 Hz  22050 Hz	 11025 Hz
        01	  48000 Hz	24000 Hz	 12000 Hz
        10	  32000 Hz	16000 Hz	  8000 Hz
        11	  reserv.	  reserv.	   reserv.
        */
        // search for frame header which is identified by Sync = 1111 1111 111
        for (let i = 500; i < sbuf8.length-1; i++) { // before it's not our header
          if (sbuf8[i] === 0xFF && (sbuf8[i+1] & 0b11100000) === 0xE0) {
            //console.log("found frame header sync @"+ i);
            var ID = ((sbuf8[i+1] & 0b00011000)>>3);
            //console.log("ID: "+ID);
            var Layer = ((sbuf8[i+1] & 0b00000110)>>1);
            //console.log("Layer: "+Layer);
            var bitrate = ((sbuf8[i+2] & 0b11110000)>>4); // have to look in table
            //console.log("Bitrate: "+bitrate);
            var srate = ((sbuf8[i+2] & 0b00001100)>>2); // have to look in table
            //console.log("samplerate: "+srate);
            var numChannels = ((sbuf8[i+3] & 0b11000000)>>6); // have to look in table
            //console.log("channels: "+numChannels);
            break; // stop after first hit
          }
        }
        fType = MP3_translate_ID(ID) +" "+ MP3_translate_Layer(Layer);
        srate = MP3_translate_srate(srate, ID);
        numChannels = MP3_translate_numChannels(numChannels);
    } else if (fType.substr(4, 4) === "ftyp") {
      fType = "MP4";
      // http://xhelmboyx.tripod.com/formats/mp4-layout.txt
      // big endian
      //var subtype = ret.str.substr(8, 4); // "avc1", "iso2", "isom", "mmp4", "mp41", "mp42", "mp71", "msnv", "ndas", "ndsc", "ndsh", "ndsm", "ndsp", "ndss", "ndxc", "ndxh", "ndxm", "ndxp", "ndxs"
      ret.str = getAsString(sbuf8);
      var mdhdStart = ret.str.indexOf("mdhd");
      var version = sbuf8[mdhdStart+4];
      //console.log("MP4 Version "+ version);
      if (version === 1) {
        var srate = (sbuf8[mdhdStart+16+8]<<24) + (sbuf8[mdhdStart+17+8]<<16) + (sbuf8[mdhdStart+18+8]<<8) + sbuf8[mdhdStart+19+8];
      } else {
        var srate = (sbuf8[mdhdStart+16]<<24) + (sbuf8[mdhdStart+17]<<16) + (sbuf8[mdhdStart+18]<<8) + sbuf8[mdhdStart+19];
      }
    } else {
      // unknown format
      console.error("getSamplerate found unknown format", ret);
    }

    ret.fType = fType;
    ret.numChannels = numChannels;
    ret.srate = srate;
    ret.bitrate = bitrate;
    ret.bitsPerSample = bitsPerSample;

    return ret;
  } // getSamplerate

  //
  // Helper functions
  //
  function getAsString(buf) {
    var ret = [];
    var strLen = Math.min(buf.length, 1024*1024); // not all the buffer
    for (let i = 0; i < strLen; i++) {
      ret.push( String.fromCharCode(buf[i]) );
    }
    return ret.join("");
  }
  function MP3_translate_ID(i) {
    switch (i) {
      case 0:
        return "MPEG Version 2.5";
      case 1:
        return "reserved";
      case 2:
        return "MPEG Version 2";
      case 3:
        return "MPEG Version 1";
    }
  }
  function MP3_translate_Layer(i) {
    switch (i) {
      case 0:
        return "reserved";
      case 1:
        return "Layer III";
      case 2:
        return "Layer II";
      case 3:
        return "Layer I";
    }
  }
  function MP3_translate_numChannels(i) {
    switch (i) {
      case 0:
        return "Stereo";
      case 1:
        return "Joint Stereo";
      case 2:
        return "2 Mono";
      case 3:
        return "Mono";
    }
  }
  function MP3_translate_srate(i, ID) {
    var div;
    switch (ID) {
      case 0:
        div = 3;
        break;
      case 1:
        div = 0; // not defined
        return 'not allowed';
        break;
      case 2:
        div = 2;
        break;
      case 3:
        div = 1;
        break;
    }

    switch (i) {
      case 0:
        return 44100 / div;
      case 1:
        return 48000 / div;
      case 2:
        return 32000 / div;
      case 3:
        return 'reserved';
    }
  }

  //
  // Exit
  //
  return my;
}(ATools || {}));
