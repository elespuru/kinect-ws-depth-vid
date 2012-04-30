//
//
// Peter Elespuru
//
// Three.js visualizer for Kinect depth data streamed
// via web socket to the browser
//
// Depth Idea/Derived/Forked from: https://github.com/jawj/websocket-kinect
// 
//

var animate; 
var bgColour;
var camT;
var camYRange;
var camZ;
var camZRange;
var camera;
var currentOutArrayIdx;
var down;
var dvp;
var dynaPan;
var fgColour;
var h;
var i;
var inputH;
var inputW;
var k;
var kvp;
var mesh, material;
var outArrays;
var pLen;
var params;
var particle;
var particleSystem;
var particles;
var prevOutArrayIdx;
var projector;
var pvs;
var qbl;
var qbr;
var qtl;
var qtr;
var rawDataLen;
var renderer;
var scene;
var seenKeyFrame;
var setSize;
var stats;
var sx;
var sy;
var useEvery;
var v;
var w;
var wls;
var x;
var xc;
var y;
var yc;
var _i;
var _len;
var _ref;
var _ref2;
var _ref3;
var _ref4;

var uniforms, attributes;
var shaderCache     = { vertex: '', fragment: '' };

var controls = function() {
  this.glsl_filter = 'default1';
};

window.onload = function() {

	if (!(window.WebGLRenderingContext && document.createElement('canvas').getContext('experimental-webgl') && 
	      window.WebSocket && new WebSocket('ws://.').binaryType)) {
		$('#noWebGL').show();
		return;
	}

    var text = new controls();
    var gui = new dat.GUI();
    var filterChange = gui.add(text, 'glsl_filter', [
		'default1',
		'default2',
		'default3',
		'red1',
		'red2',
		'red3',
		'green1',
		'green2',
		'green3',
		'blue1',
		'blue2',
		'blue3',
		'd2k',
		'hd',
		'heat',
		'heatGreen',
		'heatBlue',
		'heatB2Y',
		'heatG2Y'
	]);

	// set up event processing for filter change
	filterChange.onFinishChange(function(value) {
		// update the shaders on the material accordingly
		loadShader('shaders/depth/'+value+'.vs','vs-'+value,'vertex');
		loadShader('shaders/depth/'+value+'.fs','fs-'+value,'fragment');
		re_init(value);
	});

	// load the default shader (passthrough/noop)
	loadShader('shaders/depth/default1.vs','vs-default1','vertex');
	loadShader('shaders/depth/default1.fs','fs-default1','fragment');
 
	init();
	animate();
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

function re_init( filter ) {
	scene.remove( particleSystem );
	material = new THREE.ShaderMaterial( { 
		attributes: attributes,
		uniforms: uniforms,
		vertexShader: shaderCache.vertex,
		fragmentShader: shaderCache.fragment,
		depthWrite: false
	});
	particleSystem = new THREE.ParticleSystem( particles, material );
	scene.add( particleSystem );
		
	console.log("Re-Initialized using "+filter);
	
}

function init() {
	
	params = {
		stats: 0,
		fog: 1,
		credits: 0,
		ws: "ws://127.0.0.1:9000"
		//ws: "ws://127.0.0.1:9898"
		//ws: "ws://" + window.location.host
	};
	
	bgColour = 0x000000;
	fgColour = 0xffffff;
	inputW = 632;
	inputH = 480;
	useEvery = 4;
	w = inputW / useEvery;
	h = inputH / useEvery;
	Transform.prototype.t = Transform.prototype.transformPoint;
		
	v = function(x, y, z) {
		return new THREE.Vertex(new THREE.Vector3(x, y, z));
	};

	renderer = new THREE.WebGLRenderer({
		antialias: true
	});
		
	camera = new THREE.PerspectiveCamera(45, 1, 10, 20000);
	dvp = (_ref3 = window.devicePixelRatio) != null ? _ref3 : 1;
		
	setSize = function() {
		renderer.setSize(window.innerWidth * dvp, window.innerHeight * dvp);
		renderer.domElement.style.width = window.innerWidth + 'px';
		renderer.domElement.style.height = window.innerHeight + 'px';
		camera.aspect = window.innerWidth / window.innerHeight;
		return camera.updateProjectionMatrix();
	};
		
	setSize();
		
	$(window).on('resize', setSize);
	document.body.appendChild(renderer.domElement);
	renderer.setClearColorHex(bgColour, 1.0);
	renderer.clear();
		
	projector = new THREE.Projector();
	scene = new THREE.Scene();
	scene.add(camera);
		
	if (params.fog) scene.fog = new THREE.FogExp2(bgColour, 0.00033);
		
	uniforms = {
	};
	
	attributes = {
	};
	
	/* default basic material for use without shaders
	material = new THREE.ParticleBasicMaterial({
		color: fgColour,
		size: 2 //useEvery * 3.5
	});
	*/
	
	material = new THREE.ShaderMaterial( { 
		attributes: attributes,
		uniforms: uniforms,
		vertexShader: shaderCache.vertex,
		fragmentShader: shaderCache.fragment,
		depthWrite: true
	});
		
	particles = new THREE.Geometry();
	
	for (y = 0; 0 <= h ? y < h : y > h; 0 <= h ? y++ : y--) {
		for (x = 0; 0 <= w ? x < w : x > w; 0 <= w ? x++ : x--) {
			xc = (x - (w / 2)) * useEvery * 2;
			yc = ((h / 2) - y) * useEvery * 2;
			particle = v(xc, yc, 0);
			particle.usualY = yc;
			particles.vertices.push(particle);
		}
	}
		
	particleSystem = new THREE.ParticleSystem( particles, material );
	scene.add(particleSystem);
	
	$(renderer.domElement).on('mousedown', startCamPan);
	$(renderer.domElement).on('mouseup', stopCamPan);	
	$(renderer.domElement).on('mousemove', doCamPan);
	$(renderer.domElement).on('mousewheel', doCamZoom);
		
	drawControl(false);
	down = false;
	dynaPan = 0;
	sx = sy = 0;
	camZRange = [8000, -2000];
	camZ = 1500;
	camYRange = [-600, 600];
	camT = new Transform();

	seenKeyFrame = null;
	qtl = qtr = qbl = qbr = null;
	pvs = particles.vertices;
	pLen = pvs.length;
	rawDataLen = 5 + pLen;
		
	outArrays = (function() {
		var _results;
		_results = [];
		for (i = 0; i <= 1; i++) {
			_results.push(new Uint8Array(new ArrayBuffer(rawDataLen)));
		}
		return _results;
	})();
		
	_ref4 = [0, 1], currentOutArrayIdx = _ref4[0], prevOutArrayIdx = _ref4[1];
	connectWebSocket();
	console.log("Initialized");

}

function connectWebSocket() {
			
	var reconnectDelay, ws;
	reconnectDelay = 10;
	console.log("Connecting to " + params.ws + " ...");
	ws = new WebSocket(params.ws);
	ws.binaryType = 'arraybuffer';
	seenKeyFrame = false;
			
	ws.onopen = function() {
		return console.log('Connected');
	};
			
	ws.onclose = function() {
		console.log("Disconnected: retrying in " + reconnectDelay + "s");
		return setTimeout(connect, reconnectDelay * 1000);
	};
			
	return ws.onmessage = dataCallback;
}

function dataCallback(e) {
			
	var aByte, byteIdx, bytes, depth, inStream, keyFrame, outStream, pIdx, prevBytes, pv, x, y, _ref5, _ref6;
	_ref5 = [prevOutArrayIdx, currentOutArrayIdx], currentOutArrayIdx = _ref5[0], prevOutArrayIdx = _ref5[1];
	inStream = LZMA.wrapArrayBuffer(new Uint8Array(e.data));
	outStream = LZMA.wrapArrayBuffer(outArrays[currentOutArrayIdx]);
	LZMA.decompress(inStream, inStream, outStream, rawDataLen);
	bytes = outStream.data;
	prevBytes = outArrays[prevOutArrayIdx];
	keyFrame = bytes[0];
			
	if (!(keyFrame || seenKeyFrame)) { return; }
			
	seenKeyFrame = true;
	_ref6 = [bytes[1], bytes[2], bytes[3], bytes[4]], qtl = _ref6[0], qtr = _ref6[1], qbl = _ref6[2], qbr = _ref6[3];
	dynaPan = dynaPan * 0.9 + ((qtr + qbr) - (qtl + qbl)) * 0.1;
	pIdx = 0;
	byteIdx = 5;

	var mnz = 99999.0;
	var mxz = 0.0;
			
	for (y = 0; 0 <= h ? y < h : y > h; 0 <= h ? y++ : y--) {
		for (x = 0; 0 <= w ? x < w : x > w; 0 <= w ? x++ : x--) {
			pv = pvs[pIdx];
			aByte = bytes[byteIdx];
					
			if (!keyFrame) {
				aByte = bytes[byteIdx] = (prevBytes[byteIdx] + aByte) % 256;
			}
					
			if (aByte === 255) {
				pv.position.y = -5000;
			} else {
				pv.position.y = pv.usualY;
				depth = 128 - aByte;
				
				if (depth*10 < mnz) { mnz = depth*10; }
				if (depth*10 > mxz) { mxz = depth*10; }
				
				pv.position.z = depth * 10;
			}
					
			pIdx += 1;
			byteIdx += 1;
		}
	}
		
	var n = 300.0;   // nearest
	var f = -2000.0;  // farthest
	var z = mxz;
	var t2 = ( 1000.0 * n ) / ( f + n - z * ( f - n ) );
	//alert("minz: "+mnz+", maxz: "+mxz+", val: "+t2);
			
	return particleSystem.geometry.__dirtyVertices = true;
}

function togglePlay() {
	
}

function drawControl(playing) {
	var ctx, cvs;
	cvs = $('#control')[0];
	ctx = cvs.getContext('2d');
	ctx.fillStyle = '#fff';
			
	if (playing) {				
		return ctx.fillRect(0, 0, cvs.width, cvs.height);
	} else {
		ctx.clearRect(0, 0, cvs.width, cvs.height);
		ctx.moveTo(0, 0);
		ctx.lineTo(cvs.width, cvs.height / 2);
		ctx.lineTo(0, cvs.height);
		return ctx.fill();
	}
}

function startCamPan(ev) {
	down = true;
	sx = ev.clientX;
	return sy = ev.clientY;
}

function doCamPan(ev) {
	var camY, dx, dy, rotation;
	
	if (down) {
		dx = ev.clientX - sx;
		dy = ev.clientY - sy;
		rotation = dx * 0.0005 * Math.log(camZ);
		camT.rotate(rotation);
		camY = camera.position.y;
		camY += dy * 3;
		if (camY < camYRange[0]) camY = camYRange[0];
		if (camY > camYRange[1]) camY = camYRange[1];
		camera.position.y = camY;
		sx += dx;
		return sy += dy;
	}
}

function doCamZoom(ev, d, dX, dY) {
	camZ -= dY * 40;
	camZ = Math.max(camZ, camZRange[1]);
	return camZ = Math.min(camZ, camZRange[0]);
}

function stopCamPan() {
	return down = false;
}

function animate() {
	requestAnimationFrame( animate );
	render();

}

function render() {
	var _ref4;
	
	renderer.clear();

	// with dynamic panning via data inferences
//	_ref4 = camT.t(0.01 * camZ * dynaPan, camZ);

	// manual panning only, preferred for now...
	_ref4 = camT.t(0.01 * camZ, camZ);
	
	camera.position.x = _ref4[0];
	camera.position.z = _ref4[1];
	camera.lookAt(scene.position);
	
	renderer.render(scene, camera);
	
}
