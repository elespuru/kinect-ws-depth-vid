//
//
// Peter Elespuru
//
// Three.js visualizer for Kinect RGB video camera data streamed
// via web socket to the browser in JPG format, with GLSL filters
// for real-time post-processing
//

var container;
var camera, scene, renderer, image, imageContext, imageGradient, texture;
var imgData = new Image();
var mesh, plane, material;
var mouseX = 0;
var mouseY = 0;
var camZ = 0;
var camZRange;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
var _height = 480;
var _width = 640;

var uniforms, attributes;
var shaderCache     = { vertex: '', fragment: '' };

var controls = function() {
  this.glsl_filter = 'default';
};

window.onload = function() {
	if ( !Detector.webgl ) {
		$('#noWebGL').show();
		return;
	}

    var text = new controls();
    var gui = new dat.GUI();
    var filterChange = gui.add(text, 'glsl_filter', [
		'default',
		'invert',
		'crosshatch1',
		'crosshatch2',
		'billboard',
		'dream',
		'gray',
		'halftone',
		'hexpix',
		'pixelation',
		'nvscope',
		'posterize',
		'scanlines',
		'sepia',
		'thermal',
		'vignette'
	]);

	// set up event processing for filter change
	filterChange.onFinishChange(function(value) {
		// update the shaders on the material accordingly
		loadShader('shaders/video/'+value+'.vs','vs-'+value,'vertex');
		loadShader('shaders/video/'+value+'.fs','fs-'+value,'fragment');
		re_init(value);
	});

	// load the default shader (passthrough/noop)
	loadShader('shaders/video/default.vs','vs-default','vertex');
	loadShader('shaders/video/default.fs','fs-default','fragment');
 
	init();
	animate();
}

function connectWebSocket() {
	
	var reconnectDelay, ws;
	reconnectDelay = 10;
	ws = new WebSocket("ws://127.0.0.1:9001");
	ws.binaryType = 'arraybuffer';
	seenKeyFrame = false;
			
	ws.onopen = function() {
		return console.log('Connected to web socket');
	};
			
	ws.onclose = function() {
		console.log("Disconnected: retrying in " + reconnectDelay + "s");
		return setTimeout(connect, reconnectDelay * 1000);
	};

	// from: https://gist.github.com/958841
	function base64FromArrayBuffer(arrayBuffer) {
	  var base64    = '';
	  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

	  var bytes         = new Uint8Array(arrayBuffer);
	  var byteLength    = bytes.byteLength;
	  var byteRemainder = byteLength % 3;
	  var mainLength    = byteLength - byteRemainder;

	  var a, b, c, d;
	  var chunk;

	  // Main loop deals with bytes in chunks of 3
	  for (var i = 0; i < mainLength; i = i + 3) {
	    // Combine the three bytes into a single integer
	    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

	    // Use bitmasks to extract 6-bit segments from the triplet
	    a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
	    b = (chunk & 258048)   >> 12; // 258048   = (2^6 - 1) << 12
	    c = (chunk & 4032)     >>  6; // 4032     = (2^6 - 1) << 6
	    d = chunk & 63;               // 63       = 2^6 - 1

	    // Convert the raw binary segments to the appropriate ASCII encoding
	    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
	  }

	  // Deal with the remaining bytes and padding
	  if (byteRemainder == 1) {
	    chunk = bytes[mainLength];

	    a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

	    // Set the 4 least significant bits to zero
	    b = (chunk & 3)   << 4; // 3   = 2^2 - 1

	    base64 += encodings[a] + encodings[b] + '==';
	  } else if (byteRemainder == 2) {
	    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

	    a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
	    b = (chunk & 1008)  >>  4; // 1008  = (2^6 - 1) << 4

	    // Set the 2 least significant bits to zero
	    c = (chunk & 15)    <<  2; // 15    = 2^4 - 1

	    base64 += encodings[a] + encodings[b] + encodings[c] + '=';
	  }
  
	  return base64;
	}
		
	dataCallback = function(e) {
		// take advantage of dataURI resourcing to dynamically
		// update the img tag that gets drawn to the canvas
		var data = "data:image/jpg;base64," + base64FromArrayBuffer(e.data);
		imgData.src = data;
		
	};
			
	return ws.onmessage = dataCallback;
	
}

function loadShader(shaderURL, name, type) {

    // sync request for now during dev
    $.ajax({
		async: false,
        url: shaderURL,
        dataType: 'text',
        context: {
            name: name,
            type: type
        },
        complete: processShader
    });
}

function processShader( jqXHR, textStatus ) {
    shaderCache[this.type] = jqXHR.responseText;
}

function re_init(filter) {
	// remove the old mesh
	scene.remove(mesh);
	
	material = new THREE.ShaderMaterial( { 
		attributes: attributes,
		uniforms: uniforms,
		vertexShader: shaderCache.vertex,
		fragmentShader: shaderCache.fragment
	});
	
	mesh = new THREE.Mesh( plane, material );
	mesh.scale.x = mesh.scale.y = mesh.scale.z = 1.5;
	scene.add(mesh);
		
	console.log("Re-Initialized using "+filter);
}

function init() {
	
	camZRange = [2000, 200];
	camZ = 1000;

	container = document.createElement( 'div' );
	document.body.appendChild( container );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 1000;
	scene = new THREE.Scene();
	scene.add( camera );

	imgData.onload = function() {}

	image = document.createElement( 'canvas' );
	image.width = _width;
	image.height = _height;

	imageContext = image.getContext( '2d' );
	imageContext.fillStyle = '#000000';
	imageContext.fillRect( 0, 0, _width, _height );

	imageGradient = imageContext.createLinearGradient( 0, 0, 0, _height );
	// at the moment, want raw image, no post processing or gradiant overlay set
	// alpha to 0.0 effectively negates this layer but leaves it in place for future use
	imageGradient.addColorStop( 0.2, 'rgba(240, 240, 240, 0.0)' );
	imageGradient.addColorStop( 1,   'rgba(240, 240, 240, 0.0)' ); //0.8

	texture = new THREE.Texture( image );
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	
	uniforms = {
		"img" : { type: "t", value: 0, texture: texture }
	};
	
	attributes = {
	};
	
//	var material = new THREE.MeshBasicMaterial({map: texture, overdraw: true});
	
	material = new THREE.ShaderMaterial( { 
		attributes: attributes,
		uniforms: uniforms,
		vertexShader: shaderCache.vertex,
		fragmentShader: shaderCache.fragment
	});
	
	plane = new THREE.PlaneGeometry( _width, _height, 4, 4 );
	mesh = new THREE.Mesh( plane, material );
	mesh.scale.x = mesh.scale.y = mesh.scale.z = 1.5;
	scene.add(mesh);

	renderer = new THREE.WebGLRenderer({
		antialias: true
	});
	
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );
	document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	
	$(renderer.domElement).on('mousewheel', function(ev, d, dX, dY) {
		camZ -= dY * 40;
		camZ = Math.max(camZ, camZRange[1]);
		return camZ = Math.min(camZ, camZRange[0]);
	});
	
	connectWebSocket();
	console.log("Initialized!");
	
}

function onDocumentMouseMove(event) {
	mouseX = ( event.clientX - windowHalfX );
	mouseY = ( event.clientY - windowHalfY ) * 0.2;

}

function animate() {
	requestAnimationFrame( animate );
	render();

}

function render() {
	camera.position.x += ( mouseX - camera.position.x ) * 0.05;
	camera.position.y += ( - mouseY - camera.position.y ) * 0.05;
	camera.position.z += ( camZ - camera.position.z) * 0.05;
	camera.lookAt( scene.position );

	imageContext.drawImage( imgData, 0, 0 );
	imageContext.fillStyle = imageGradient;
	imageContext.fillRect( 0, 0, _width, _height );
	if ( texture ) texture.needsUpdate = true;
	
	renderer.render( scene, camera );
	
}
