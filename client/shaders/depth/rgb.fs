uniform sampler2D map;
varying vec2 vUv;

void main() {

	vec4 color = texture2D( map, vUv );
	vec3 mapRGB = vec3(color.r, color.g, color.b);
				
	// direct map RGB from video
	vec4 cRGB = vec4(mapRGB, smoothstep( 8000.0, -8000.0, gl_FragCoord.z / gl_FragCoord.w ));
				
	// define which of the colors to use for the fragment from the options above
	gl_FragColor = vec4(cRGB);

}

