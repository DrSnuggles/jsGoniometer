/*  Drop handler by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
*/
var dropArea = window;

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults (e) {
  e.preventDefault();
  e.stopPropagation();
}

dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;
  var file = files[0]; // just use first dropped file right now, maybe add playlist support
  var reader = new FileReader();
  var filename = file.name;
  reader.onload = function(ev) {
    ATools.decodeAudio(ev.target.result);
    /* old way via audio tag
    var blob = new Blob([ev.target.result], { type: "audio/wav" });
    myAudio.src = URL.createObjectURL(blob);
    myAudio.play();
    */
  };
  reader.readAsArrayBuffer(file);
}
